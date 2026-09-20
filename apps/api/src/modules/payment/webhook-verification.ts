import * as crypto from 'crypto';

/**
 * Pure webhook signature-verification strategies. No NestJS, no I/O — every
 * function here is deterministic over its inputs so the whole security layer
 * is unit-testable (webhook-verification.spec.ts).
 *
 * Rules that apply to every strategy:
 * - digests are computed over the RAW request body, never re-serialized JSON;
 * - comparisons are timing-safe;
 * - timestamped schemes reject stale deliveries (replay protection);
 * - an absent secret/key can never verify: misconfiguration fails closed.
 */

export type WebhookVerificationMethod =
  'hmac-sha512' | 'hmac-sha256-timestamped' | 'rsa' | 'stripe' | 'none';

export interface FreshnessOptions {
  /** Maximum age of the signed timestamp, in seconds. */
  maxAgeSeconds: number;
  /** Tolerated clock skew for timestamps slightly in the future. */
  futureSkewSeconds: number;
}

export const DEFAULT_FRESHNESS: FreshnessOptions = {
  maxAgeSeconds: 300,
  futureSkewSeconds: 60,
};

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Epoch timestamp freshness. Accepts seconds or milliseconds (values >= 1e12
 * are treated as ms). Non-numeric input is stale.
 */
export function isFreshEpochTimestamp(
  raw: string | number | undefined | null,
  options: FreshnessOptions = DEFAULT_FRESHNESS,
): boolean {
  if (raw === undefined || raw === null || raw === '') return false;
  const rawTs = Number(raw);
  if (!Number.isFinite(rawTs)) return false;
  const ts = rawTs >= 1e12 ? rawTs / 1000 : rawTs;
  const ageSec = Date.now() / 1000 - ts;
  return (
    ageSec >= -options.futureSkewSeconds && ageSec <= options.maxAgeSeconds
  );
}

/** HMAC-SHA512 hex digest over the raw body (Moniepoint legacy / Monnify). */
export function verifyHmacSha512Hex(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string | undefined | null,
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqualStr(signature.replace(/^sha512=/i, ''), expected);
}

/**
 * HMAC-SHA256 base64 over `${webhookId}__${timestamp}__${rawBody}`
 * (Moniepoint's documented webhook format). The timestamp travels in a
 * header and is covered by the signature, so freshness is enforced by the
 * caller via isFreshEpochTimestamp AFTER the signature proves genuine.
 */
export function verifyHmacSha256Timestamped(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string | undefined | null,
  webhookId: string | undefined,
  timestamp: string | undefined,
): boolean {
  if (!signature || !secret || !webhookId || !timestamp) return false;
  const signed = `${webhookId}__${timestamp}__${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signed)
    .digest('base64');
  return timingSafeEqualStr(signature, expected);
}

/** RSA-SHA256, base64 signature over the raw body (OPay). */
export function verifyRsaSha256(
  rawBody: Buffer,
  signature: string | undefined,
  publicKey: string | undefined | null,
): boolean {
  if (!signature || !publicKey) return false;
  try {
    return crypto.verify(
      'RSA-SHA256',
      rawBody,
      publicKey,
      Buffer.from(signature, 'base64'),
    );
  } catch {
    return false;
  }
}

/**
 * Stripe-style signature header: `t=<epoch>,v1=<hex>[,v1=...]` where each v1
 * is HMAC-SHA256 hex over `${t}.${rawBody}`. Freshness of `t` is enforced
 * here because the scheme defines it as part of verification.
 */
export function verifyStripeStyle(
  rawBody: Buffer,
  header: string | undefined,
  secret: string | undefined | null,
  options: FreshnessOptions = DEFAULT_FRESHNESS,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim());
  const t = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1s = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || v1s.length === 0) return false;
  if (!isFreshEpochTimestamp(t, options)) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody.toString('utf8')}`)
    .digest('hex');
  return v1s.some((v1) => timingSafeEqualStr(v1, expected));
}

export interface MoniepointVerificationInput {
  rawBody: Buffer;
  /** The first present signature header value (several header names are live). */
  signature: string | undefined;
  secret: string;
  webhookId?: string;
  timestamp?: string;
}

/**
 * Moniepoint accepts two formats depending on which dashboard/integration
 * configured the webhook: HMAC-SHA512 hex over the raw body, or the
 * documented timestamped HMAC-SHA256. Returns which format matched so the
 * caller can apply the freshness window to the timestamped one.
 */
export function verifyMoniepointSignature(
  input: MoniepointVerificationInput,
): 'sha512' | 'sha256' | null {
  if (!input.signature) return null;
  if (verifyHmacSha512Hex(input.rawBody, input.signature, input.secret)) {
    return 'sha512';
  }
  if (
    verifyHmacSha256Timestamped(
      input.rawBody,
      input.signature,
      input.secret,
      input.webhookId,
      input.timestamp,
    )
  ) {
    return 'sha256';
  }
  return null;
}

export interface GenericVerificationInput {
  method: WebhookVerificationMethod | null | undefined;
  rawBody: Buffer;
  signature: string | undefined;
  secret?: string | null;
  publicKey?: string | null;
  webhookId?: string;
  timestamp?: string;
  freshness?: FreshnessOptions;
}

export interface GenericVerificationResult {
  ok: boolean;
  reason?:
    | 'unsupported-method'
    | 'missing-signature'
    | 'missing-secret'
    | 'missing-public-key'
    | 'mismatch'
    | 'stale';
}

/**
 * Strategy dispatcher for the generic provider pipeline. 'none' NEVER
 * verifies: a webhook provider without a real verification method must not
 * auto-settle money, so it fails closed here.
 */
export function verifyWebhookSignature(
  input: GenericVerificationInput,
): GenericVerificationResult {
  const freshness = input.freshness ?? DEFAULT_FRESHNESS;
  switch (input.method) {
    case 'hmac-sha512': {
      if (!input.secret) return { ok: false, reason: 'missing-secret' };
      if (!input.signature) return { ok: false, reason: 'missing-signature' };
      return verifyHmacSha512Hex(input.rawBody, input.signature, input.secret)
        ? { ok: true }
        : { ok: false, reason: 'mismatch' };
    }
    case 'hmac-sha256-timestamped': {
      if (!input.secret) return { ok: false, reason: 'missing-secret' };
      if (!input.signature) return { ok: false, reason: 'missing-signature' };
      const ok = verifyHmacSha256Timestamped(
        input.rawBody,
        input.signature,
        input.secret,
        input.webhookId,
        input.timestamp,
      );
      if (!ok) return { ok: false, reason: 'mismatch' };
      return isFreshEpochTimestamp(input.timestamp, freshness)
        ? { ok: true }
        : { ok: false, reason: 'stale' };
    }
    case 'rsa': {
      if (!input.publicKey) return { ok: false, reason: 'missing-public-key' };
      if (!input.signature) return { ok: false, reason: 'missing-signature' };
      return verifyRsaSha256(input.rawBody, input.signature, input.publicKey)
        ? { ok: true }
        : { ok: false, reason: 'mismatch' };
    }
    case 'stripe': {
      if (!input.secret) return { ok: false, reason: 'missing-secret' };
      if (!input.signature) return { ok: false, reason: 'missing-signature' };
      return verifyStripeStyle(
        input.rawBody,
        input.signature,
        input.secret,
        freshness,
      )
        ? { ok: true }
        : { ok: false, reason: 'mismatch' };
    }
    default:
      return { ok: false, reason: 'unsupported-method' };
  }
}

/** sha256 hex of the raw body — the ledger's replay/dedupe key. */
export function hashWebhookPayload(rawBody: Buffer): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

import * as crypto from 'crypto';
import {
  hashWebhookPayload,
  isFreshEpochTimestamp,
  timingSafeEqualStr,
  verifyHmacSha256Timestamped,
  verifyHmacSha512Hex,
  verifyMoniepointSignature,
  verifyRsaSha256,
  verifyStripeStyle,
  verifyWebhookSignature,
} from './webhook-verification';

const raw = Buffer.from(JSON.stringify({ reference: 'ref-1', amount: 50000 }));
const secret = 'test-secret';

describe('timingSafeEqualStr', () => {
  it('matches equal strings and rejects different or empty ones', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualStr('', '')).toBe(true);
  });
});

describe('verifyHmacSha512Hex', () => {
  const sig = crypto.createHmac('sha512', secret).update(raw).digest('hex');

  it('accepts a valid signature, with or without the sha512= prefix', () => {
    expect(verifyHmacSha512Hex(raw, sig, secret)).toBe(true);
    expect(verifyHmacSha512Hex(raw, `sha512=${sig}`, secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyHmacSha512Hex(Buffer.from('{"x":1}'), sig, secret)).toBe(
      false,
    );
  });

  it('rejects the wrong secret and fails closed without one', () => {
    expect(verifyHmacSha512Hex(raw, sig, 'other')).toBe(false);
    expect(verifyHmacSha512Hex(raw, sig, undefined)).toBe(false);
    expect(verifyHmacSha512Hex(raw, undefined, secret)).toBe(false);
  });
});

describe('verifyHmacSha256Timestamped', () => {
  const webhookId = 'wh-1';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${webhookId}__${ts}__${raw.toString('utf8')}`)
    .digest('base64');

  it('accepts a valid timestamped signature', () => {
    expect(verifyHmacSha256Timestamped(raw, sig, secret, webhookId, ts)).toBe(
      true,
    );
  });

  it('rejects when any covered component changes', () => {
    expect(verifyHmacSha256Timestamped(raw, sig, secret, 'wh-2', ts)).toBe(
      false,
    );
    expect(
      verifyHmacSha256Timestamped(raw, sig, secret, webhookId, '123'),
    ).toBe(false);
    expect(
      verifyHmacSha256Timestamped(
        Buffer.from('{}'),
        sig,
        secret,
        webhookId,
        ts,
      ),
    ).toBe(false);
  });

  it('fails closed on missing inputs', () => {
    expect(verifyHmacSha256Timestamped(raw, sig, secret, undefined, ts)).toBe(
      false,
    );
    expect(
      verifyHmacSha256Timestamped(raw, sig, undefined, webhookId, ts),
    ).toBe(false);
  });
});

describe('isFreshEpochTimestamp', () => {
  it('accepts now, in seconds and milliseconds', () => {
    expect(isFreshEpochTimestamp(Math.floor(Date.now() / 1000))).toBe(true);
    expect(isFreshEpochTimestamp(Date.now())).toBe(true);
  });

  it('rejects stale and far-future timestamps', () => {
    expect(isFreshEpochTimestamp(Math.floor(Date.now() / 1000) - 301)).toBe(
      false,
    );
    expect(isFreshEpochTimestamp(Math.floor(Date.now() / 1000) + 61)).toBe(
      false,
    );
  });

  it('rejects garbage', () => {
    expect(isFreshEpochTimestamp('not-a-number')).toBe(false);
    expect(isFreshEpochTimestamp(undefined)).toBe(false);
    expect(isFreshEpochTimestamp('')).toBe(false);
  });
});

describe('verifyRsaSha256', () => {
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const sig = crypto
    .sign('RSA-SHA256', raw, keys.privateKey)
    .toString('base64');

  it('accepts a valid signature', () => {
    expect(verifyRsaSha256(raw, sig, keys.publicKey)).toBe(true);
  });

  it('rejects a signature from a different key', () => {
    const other = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const wrong = crypto
      .sign('RSA-SHA256', raw, other.privateKey)
      .toString('base64');
    expect(verifyRsaSha256(raw, wrong, keys.publicKey)).toBe(false);
  });

  it('returns false (never throws) on a malformed key or signature', () => {
    expect(verifyRsaSha256(raw, 'aW52YWxpZA==', keys.publicKey)).toBe(false);
    expect(verifyRsaSha256(raw, sig, 'not-a-key')).toBe(false);
    expect(verifyRsaSha256(raw, undefined, keys.publicKey)).toBe(false);
  });
});

describe('verifyStripeStyle', () => {
  const makeHeader = (t: number, body: Buffer, key = secret) => {
    const v1 = crypto
      .createHmac('sha256', key)
      .update(`${t}.${body.toString('utf8')}`)
      .digest('hex');
    return `t=${t},v1=${v1}`;
  };

  it('accepts a valid, fresh header', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyStripeStyle(raw, makeHeader(t, raw), secret)).toBe(true);
  });

  it('accepts when one of several v1 entries matches', () => {
    const t = Math.floor(Date.now() / 1000);
    const good = makeHeader(t, raw);
    const header = `t=${t},v1=deadbeef,${good.split(',')[1]}`;
    expect(verifyStripeStyle(raw, header, secret)).toBe(true);
  });

  it('rejects a stale timestamp even with a valid digest', () => {
    const t = Math.floor(Date.now() / 1000) - 301;
    expect(verifyStripeStyle(raw, makeHeader(t, raw), secret)).toBe(false);
  });

  it('rejects a tampered body and a wrong secret', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeStyle(Buffer.from('{}'), makeHeader(t, raw), secret),
    ).toBe(false);
    expect(verifyStripeStyle(raw, makeHeader(t, raw, 'other'), secret)).toBe(
      false,
    );
  });

  it('fails closed on malformed headers', () => {
    expect(verifyStripeStyle(raw, 'v1=abc', secret)).toBe(false);
    expect(verifyStripeStyle(raw, 't=123', secret)).toBe(false);
    expect(verifyStripeStyle(raw, undefined, secret)).toBe(false);
  });
});

describe('verifyMoniepointSignature', () => {
  it('identifies the sha512 format', () => {
    const sig = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    expect(
      verifyMoniepointSignature({ rawBody: raw, signature: sig, secret }),
    ).toBe('sha512');
  });

  it('identifies the timestamped sha256 format', () => {
    const ts = String(Date.now());
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`wh-1__${ts}__${raw.toString('utf8')}`)
      .digest('base64');
    expect(
      verifyMoniepointSignature({
        rawBody: raw,
        signature: sig,
        secret,
        webhookId: 'wh-1',
        timestamp: ts,
      }),
    ).toBe('sha256');
  });

  it('returns null for an invalid signature', () => {
    expect(
      verifyMoniepointSignature({ rawBody: raw, signature: 'bad', secret }),
    ).toBeNull();
  });
});

describe('verifyWebhookSignature dispatcher', () => {
  it("fails closed for method 'none' and unknown methods", () => {
    expect(
      verifyWebhookSignature({
        method: 'none',
        rawBody: raw,
        signature: 'x',
        secret,
      }),
    ).toEqual({ ok: false, reason: 'unsupported-method' });
    expect(
      verifyWebhookSignature({
        method: undefined,
        rawBody: raw,
        signature: 'x',
        secret,
      }),
    ).toEqual({ ok: false, reason: 'unsupported-method' });
  });

  it('reports missing credentials distinctly from mismatches', () => {
    expect(
      verifyWebhookSignature({
        method: 'hmac-sha512',
        rawBody: raw,
        signature: 'x',
        secret: null,
      }),
    ).toEqual({ ok: false, reason: 'missing-secret' });
    expect(
      verifyWebhookSignature({
        method: 'rsa',
        rawBody: raw,
        signature: 'x',
        publicKey: null,
      }),
    ).toEqual({ ok: false, reason: 'missing-public-key' });
  });

  it('enforces freshness for the timestamped hmac method', () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 301);
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`wh-1__${staleTs}__${raw.toString('utf8')}`)
      .digest('base64');
    expect(
      verifyWebhookSignature({
        method: 'hmac-sha256-timestamped',
        rawBody: raw,
        signature: sig,
        secret,
        webhookId: 'wh-1',
        timestamp: staleTs,
      }),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('verifies each supported method end to end', () => {
    const sha512 = crypto
      .createHmac('sha512', secret)
      .update(raw)
      .digest('hex');
    expect(
      verifyWebhookSignature({
        method: 'hmac-sha512',
        rawBody: raw,
        signature: sha512,
        secret,
      }).ok,
    ).toBe(true);

    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto
      .createHmac('sha256', secret)
      .update(`${t}.${raw.toString('utf8')}`)
      .digest('hex');
    expect(
      verifyWebhookSignature({
        method: 'stripe',
        rawBody: raw,
        signature: `t=${t},v1=${v1}`,
        secret,
      }).ok,
    ).toBe(true);
  });
});

describe('hashWebhookPayload', () => {
  it('is deterministic and body-sensitive', () => {
    expect(hashWebhookPayload(raw)).toBe(hashWebhookPayload(raw));
    expect(hashWebhookPayload(raw)).not.toBe(
      hashWebhookPayload(Buffer.from('{}')),
    );
    expect(hashWebhookPayload(raw)).toMatch(/^[0-9a-f]{64}$/);
  });
});

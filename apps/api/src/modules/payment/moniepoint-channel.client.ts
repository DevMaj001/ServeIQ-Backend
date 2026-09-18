import { Injectable, Logger } from '@nestjs/common';

/**
 * OAuth token from the Moniepoint Channel/ERP API (POST /v1/auth), per the
 * "Push Payment Request (API Reference)" docs. `tokenType.value` is "bearer";
 * the token is sent as `Authorization: Bearer <accessToken>` on downstream
 * calls. `jti` is the token id, `scope` "profile".
 */
export interface MoniepointChannelToken {
  accessToken: string;
  tokenType: { value: 'bearer' };
  expiresIn: number;
  scope: string;
  jti: string;
}

/** HTTP-level failure from the Moniepoint Channel API (non-2xx). */
export class MoniepointChannelError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: any,
  ) {
    super(message);
    this.name = 'MoniepointChannelError';
  }
}

/**
 * Thrown by the constructor when required env is missing. This is a DIFFERENT
 * auth model from the POS API key (MoniepointApiClient): these are OAuth
 * client credentials exchanged for a bearer token via /v1/auth, not a key sent
 * directly as Bearer. Failing at construction (crash-early) beats failing at
 * the first call, and mirrors the central validate-env.ts gate.
 */
export class MoniepointChannelConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `MoniepointChannelClient is not configured — missing: ${missing.join(
        ', ',
      )}. The Channel/ERP client credentials are distinct from the POS API ` +
        `key and must be set explicitly. See apps/api/.env.example.`,
    );
    this.name = 'MoniepointChannelConfigError';
  }
}

const REQUIRED_ENV = [
  'MONIEPOINT_CHANNEL_BASE_URL',
  'MONIEPOINT_CLIENT_ID',
  'MONIEPOINT_CLIENT_API_KEY',
] as const;

type ChannelEnvKey = (typeof REQUIRED_ENV)[number];

const TOKEN_REFRESH_SKEW_MS = 60_000;

/** Trimmed env value, or null for unset / whitespace-only (e.g. `VAR=`). */
function env(name: ChannelEnvKey): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export const MONIEPOINT_PAYMENT_METHODS = [
  'CARD_PURCHASE',
  'POS_TRANSFER',
  'ANY',
] as const;
export type MoniepointPaymentMethod =
  (typeof MONIEPOINT_PAYMENT_METHODS)[number];

/**
 * Explicit per-tenant configuration, used by MoniepointErpService to build a
 * client bound to ONE branch's Moniepoint credential. When omitted, the
 * constructor reads the shared platform env config instead.
 */
export interface MoniepointChannelClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Push Payment Request body (POST /v1/transactions) per the confirmed
 * "Push Payment Request (API Reference)" contract. `merchantReference` must be
 * unique per transaction — Moniepoint rejects a duplicate with HTTP 400
 * `{"message":"Transaction exists"}`.
 */
export interface MoniepointPushPaymentRequest {
  terminalSerial: string;
  amount: number;
  merchantReference: string;
  /** Only "PURCHASE" is supported by the API. */
  transactionType: 'PURCHASE';
  paymentMethod?: MoniepointPaymentMethod;
}

/**
 * Client for the Moniepoint Channel/ERP push-payment API (OAuth client
 * credentials exchanged for a bearer token).
 *
 * Auth: POST /v1/auth with `{ clientId, clientSecret }` -> bearer token; the
 * token is forwarded as `Authorization: Bearer <accessToken>` on /v1/transactions.
 * Tokens last `expiresIn` seconds (observed 24h in sandbox) and are cached
 * until near-expiry — re-auth only when needed.
 *
 * Configuration (env, platform default): MONIEPOINT_CHANNEL_BASE_URL,
 * MONIEPOINT_CLIENT_ID, MONIEPOINT_CLIENT_API_KEY. All three are REQUIRED
 * when no explicit config is supplied: the constructor throws
 * MoniepointChannelConfigError if any is unset — there is no fallback host.
 * Pass a MoniepointChannelClientConfig to bind the client to a specific
 * branch's credential instead.
 *
 * NOTE: there is a SINGLE base URL (https://channel.moniepoint.com) for both
 * sandbox and production; the environment is declared by which client
 * credential is used (pick "Sandbox" when creating the credential). The
 * moniepoint-pos-backend-service.development.moniepoint.com hostname seen in
 * the Confluence docs is a stale hyperlink target, not a second host.
 */
@Injectable()
export class MoniepointChannelClient {
  private readonly logger = new Logger(MoniepointChannelClient.name);

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  /**
   * @param config Optional per-tenant credential config. When given, it wins
   * over env and the missing-env guard is skipped entirely (the caller is
   * responsible for providing complete values).
   */
  constructor(config?: MoniepointChannelClientConfig) {
    if (config) {
      this.baseUrl = config.baseUrl;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      return;
    }
    const missing = REQUIRED_ENV.filter((key) => !env(key));
    if (missing.length > 0) {
      throw new MoniepointChannelConfigError(missing);
    }
    this.baseUrl = env('MONIEPOINT_CHANNEL_BASE_URL')!;
    this.clientId = env('MONIEPOINT_CLIENT_ID')!;
    this.clientSecret = env('MONIEPOINT_CLIENT_API_KEY')!;
  }

  /**
   * Exchange client credentials for a bearer token (POST /v1/auth) and cache
   * it until near-expiry. Reuses the cached token when still valid, so
   * downstream calls don't re-authenticate per request.
   */
  async authenticate(): Promise<MoniepointChannelToken> {
    if (
      this.cachedToken &&
      Date.now() < this.cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS
    ) {
      this.logger.debug('reusing cached Channel bearer token');
      return {
        accessToken: this.cachedToken.value,
        tokenType: { value: 'bearer' },
        expiresIn: Math.floor((this.cachedToken.expiresAt - Date.now()) / 1000),
        scope: 'profile',
        jti: '',
      };
    }

    const token: MoniepointChannelToken = await this.request('/v1/auth', {
      method: 'POST',
      body: { clientId: this.clientId, clientSecret: this.clientSecret },
    });
    this.cachedToken = {
      value: token.accessToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
    };
    return token;
  }

  /** Reset the cached token, forcing the next call to re-authenticate. */
  invalidateToken(): void {
    this.cachedToken = null;
  }

  /**
   * Push a payment request to a POS terminal (POST /v1/transactions).
   * Success is HTTP 202 Accepted with no body. Requires a valid bearer token
   * (obtained/cached via authenticate()).
   */
  async pushPayment(request: MoniepointPushPaymentRequest): Promise<void> {
    const { accessToken } = await this.authenticate();
    await this.request('/v1/transactions', {
      method: 'POST',
      bearerToken: accessToken,
      body: request,
      expectedStatus: 202,
    });
  }

  private async request(
    path: string,
    opts?: {
      method?: 'GET' | 'POST';
      bearerToken?: string;
      body?: Record<string, any>;
      expectedStatus?: number;
    },
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${path}`);
    this.logger.debug(`Moniepoint Channel ${opts?.method ?? 'GET'} ${path}`);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (opts?.bearerToken) {
      headers.Authorization = `Bearer ${opts.bearerToken}`;
    }

    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (
      !res.ok ||
      (opts?.expectedStatus !== undefined && res.status !== opts.expectedStatus)
    ) {
      const message =
        body?.message ??
        body?.error ??
        `HTTP ${res.status} (expected ${opts?.expectedStatus ?? '2xx'})`;
      throw new MoniepointChannelError(
        `${path} failed: ${message}`,
        res.status,
        body,
      );
    }
    return body;
  }
}

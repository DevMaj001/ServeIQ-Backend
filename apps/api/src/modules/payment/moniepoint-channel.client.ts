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
        `key and must be set explicitly. Do not guess MONIEPOINT_CHANNEL_BASE_URL: ` +
        `it is UNCONFIRMED pending a Moniepoint support reply (see apps/api/.env.example).`,
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

/** Trimmed env value, or null for unset / whitespace-only (e.g. `VAR=`). */
function env(name: ChannelEnvKey): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

/**
 * Client for the Moniepoint Channel/ERP push-payment API (OAuth client
 * credentials exchanged for a bearer token).
 *
 * Auth: POST /v1/auth with `{ clientId, clientSecret }` -> bearer token.
 *
 * Configuration (env): MONIEPOINT_CHANNEL_BASE_URL, MONIEPOINT_CLIENT_ID,
 * MONIEPOINT_CLIENT_API_KEY. All three are REQUIRED: the constructor throws
 * MoniepointChannelConfigError if any is unset — there is no fallback host.
 *
 * NOTE: the sandbox base URL is UNCONFIRMED pending pos-integrations@moniepoint.com
 * (sources disagree: channel.moniepoint.com vs pos.moniepoint.com vs
 * moniepoint-pos-backend-service.development.moniepoint.com). Do not treat the
 * configured value as green-lit until resolved.
 */
@Injectable()
export class MoniepointChannelClient {
  private readonly logger = new Logger(MoniepointChannelClient.name);

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    const missing = REQUIRED_ENV.filter((key) => !env(key));
    if (missing.length > 0) {
      throw new MoniepointChannelConfigError(missing);
    }
    this.baseUrl = env('MONIEPOINT_CHANNEL_BASE_URL')!;
    this.clientId = env('MONIEPOINT_CLIENT_ID')!;
    this.clientSecret = env('MONIEPOINT_CLIENT_API_KEY')!;
  }

  /** Exchange client credentials for a bearer token (POST /v1/auth). */
  async authenticate(): Promise<MoniepointChannelToken> {
    return this.request('/v1/auth', {
      method: 'POST',
      body: { clientId: this.clientId, clientSecret: this.clientSecret },
    });
  }

  private async request(
    path: string,
    opts?: { method?: 'GET' | 'POST'; body?: Record<string, any> },
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${path}`);
    this.logger.debug(`Moniepoint Channel ${opts?.method ?? 'GET'} ${path}`);

    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
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
    if (!res.ok) {
      const message = body?.message ?? body?.error ?? `HTTP ${res.status}`;
      throw new MoniepointChannelError(
        `${path} failed: ${message}`,
        res.status,
        body,
      );
    }
    return body;
  }
}

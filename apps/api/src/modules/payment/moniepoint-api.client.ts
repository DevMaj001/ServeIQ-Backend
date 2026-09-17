import { Injectable, Logger } from '@nestjs/common';

export type MoniepointEventStatus = 'SUCCESS' | 'PENDING' | 'FAILED';

/**
 * Moniepoint webhook subscription event (SubscriptionEventModel in the
 * official POS API spec). `status` FAILED/PENDING/SUCCESS describes the
 * DELIVERY of an event to our registered endpoint, and `payload` carries the
 * same body a webhook would have delivered. `retryTimes` counts delivery
 * attempts; a future `retryAt` means Moniepoint is still going to try again.
 */
export interface MoniepointSubscriptionEvent {
  id: string;
  subscriptionId: string;
  idempotentId?: string;
  eventType?: string;
  payload: Record<string, any>;
  retryTimes?: number;
  retryAt?: string;
  status: MoniepointEventStatus;
  subjectUrn?: string;
  endpointUrl?: string;
  createdAt?: string;
}

export interface MoniepointEventPage {
  content: MoniepointSubscriptionEvent[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

export interface MoniepointEventLog {
  id: string;
  subscriptionId: string;
  subscriptionEventId: string;
  status: MoniepointEventStatus;
  message?: string;
  createdAt?: string;
}

export interface MoniepointEventLogPage {
  content: MoniepointEventLog[];
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/**
 * TransactionResponse in the official POS API spec (GET /v1/transactions and
 * GET /v1/transactions/merchants/{merchantReference}). This is the ONLY
 * documented place accountName / nubanAccount exist — the webhook payload
 * (SubscriptionEventModel.payload) is a free-form `object` in the spec and is
 * NOT guaranteed to carry these fields.
 */
export interface MoniepointTransaction {
  id?: string;
  createdAt?: string;
  modifiedAt?: string;
  clientId?: string;
  businessOwnerId?: number;
  terminalSerial?: string;
  terminalHardwareId?: number;
  requestAmount?: number;
  transactionReference?: string;
  merchantReference?: string;
  transactionType?: string;
  requestPaymentMethod?: string;
  actualPaymentMethod?: string;
  actualAmount?: number;
  processingStatus?: string;
  responseCode?: string;
  responseMessage?: string;
  metaData?: string;
  accountNumber?: string;
  accountName?: string;
  nubanAccount?: string;
  queueStatus?: string;
  callbackUrl?: string;
  callbackNotified?: boolean;
}

export interface MoniepointIntrospection {
  scopes: string[];
  businesses: Array<{ id: number; businessName: string }>;
  authMethod: 'API_KEY';
  environment: 'SANDBOX' | 'PROD';
}

export interface MoniepointListEventsParams {
  statuses?: MoniepointEventStatus[];
  eventTypes?: string[];
  from?: Date;
  to?: Date;
  page?: number;
  size?: number;
}

export interface MoniepointResendEventsParams {
  statuses?: MoniepointEventStatus[];
  eventTypes?: string[];
  from?: Date;
  to?: Date;
}

export class MoniepointApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: any,
  ) {
    super(message);
    this.name = 'MoniepointApiError';
  }
}

const ISO_DATE = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Client for the Moniepoint POS API (https://api.pos.moniepoint.com).
 *
 * Reconciliation uses the webhook subscription delivery model, NOT a deposits
 * poll: we ask Moniepoint which event DELIVERIES it failed/pending'd, then
 * resend or alert — the registered webhook URL is the only delivery target.
 *
 * Auth: `Authorization: Bearer <apiKey>` (verified via GET /v1/introspect).
 * No request body signing is required for API calls.
 *
 * Configuration (env): MONIEPOINT_API_BASE_URL, MONIEPOINT_API_KEY,
 * MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID (uuid of the subscription the operator
 * registered for this deployment).
 */
@Injectable()
export class MoniepointApiClient {
  private readonly logger = new Logger(MoniepointApiClient.name);

  private readonly baseUrl = process.env.MONIEPOINT_API_BASE_URL || null;
  private readonly apiKey = process.env.MONIEPOINT_API_KEY || null;
  private readonly subscriptionId =
    process.env.MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID || null;

  /** Whether the client can call the external API at all. */
  get isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.subscriptionId);
  }

  async introspect(): Promise<MoniepointIntrospection> {
    return this.request('/v1/introspect');
  }

  async listSubscriptionEvents(
    params: MoniepointListEventsParams = {},
  ): Promise<MoniepointEventPage> {
    const query = this.buildQuery(params);
    return this.request('/v1/webhook-subscription-events', { query });
  }

  /** Per-delivery-attempt logs for one event (SubscriptionEventLogModel).
   *  Each attempt carries its own status and — critically for the auto-resend
   *  decision — a free-form `message` describing why that attempt failed. */
  async listEventLogs(
    subscriptionEventId: string,
    params: { page?: number; size?: number } = {},
  ): Promise<MoniepointEventLogPage> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.size !== undefined) query.size = String(params.size);
    return this.request(
      `/v1/webhook-subscription-events/${encodeURIComponent(subscriptionEventId)}/logs`,
      { query },
    );
  }

  /** Fetch the outcome of a transaction by merchant reference
   *  (GET /v1/transactions/merchants/{merchantReference}). Returns the full
   *  TransactionResponse shape, which is where accountName/nubanAccount live
   *  — these are NOT guaranteed on the webhook payload. */
  async getMerchantTransaction(
    merchantReference: string,
  ): Promise<MoniepointTransaction> {
    return this.request(
      `/v1/transactions/merchants/${encodeURIComponent(merchantReference)}`,
    );
  }

  /** Force Moniepoint to resend failed/pending deliveries matching filters.
   *  Only PENDING and FAILED events are actually re-delivered. */
  async resendEvents(
    params: MoniepointResendEventsParams = {},
  ): Promise<MoniepointEventLogPage> {
    const query = this.buildQuery(params);
    return this.request('/v1/webhook-subscription-events/resend', {
      method: 'POST',
      query,
    });
  }

  private buildQuery(
    params: MoniepointListEventsParams,
  ): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {
      subscriptionId: this.subscriptionId!,
    };
    if (params.statuses?.length) query.status = params.statuses;
    if (params.eventTypes?.length) query.eventType = params.eventTypes;
    if (params.from) query.from = ISO_DATE(params.from);
    if (params.to) query.to = ISO_DATE(params.to);
    if (params.page !== undefined) query.page = String(params.page);
    if (params.size !== undefined) query.size = String(params.size);
    return query;
  }

  private async request(
    path: string,
    opts?: {
      method?: 'GET' | 'POST';
      query?: Record<string, string | string[]>;
    },
  ): Promise<any> {
    if (!this.isConfigured) {
      throw new MoniepointApiError(
        'MoniepointApiClient is not configured (check MONIEPOINT_API_BASE_URL / MONIEPOINT_API_KEY / MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID)',
        0,
      );
    }
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(opts?.query ?? {})) {
      for (const v of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(key, v);
      }
    }

    this.logger.debug(`Moniepoint API ${opts?.method ?? 'GET'} ${path}`);
    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
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
      throw new MoniepointApiError(
        `${path} failed: ${message}`,
        res.status,
        body,
      );
    }
    return body;
  }
}

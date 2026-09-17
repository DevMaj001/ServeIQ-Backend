import { Injectable, Logger } from '@nestjs/common';

export interface MoniepointDeposit {
  reference: string;
  amount_kobo: number;
  account_number: string;
  timestamp: Date;
  status: string;
}

/**
 * Moniepoint API client — reconciliation scaffold.
 *
 * The webhook is currently the ONLY path that records a deposit. This client
 * exists so a periodic reconciliation job can cross-check Moniepoint's own
 * transaction/deposit history for money that landed but never triggered a
 * webhook (dropped webhook, signature failure, unresolved amount, etc).
 *
 * Gate: the client no-ops (returns []) when credentials are not configured,
 * so the reconcile scheduler can run safely in every environment.
 *
 * Configuration (env vars):
 *  - MONIEPOINT_API_BASE_URL: API base URL (e.g. https://api.moniepoint.com)
 *  - MONIEPOINT_API_KEY:      API key used for authentication
 *  - MONIEPOINT_API_SECRET:   API secret (signature/digest credential)
 *
 * TODO: Fill in the real Moniepoint endpoint/auth contract once production
 *  credentials and API documentation are available. The method below is a
 *  structural placeholder that returns [] and logs when unimplemented.
 */
@Injectable()
export class MoniepointApiClient {
  private readonly logger = new Logger(MoniepointApiClient.name);

  private readonly baseUrl: string | null = process.env.MONIEPOINT_API_BASE_URL || null;
  private readonly apiKey: string | null = process.env.MONIEPOINT_API_KEY || null;
  private readonly apiSecret: string | null = process.env.MONIEPOINT_API_SECRET || null;

  /** Whether the client is safe/capable of calling the external API. */
  get isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.apiSecret);
  }

  /**
   * Fetch deposits recorded by Moniepoint after `since` for a destination
   * account (or across all accounts when `accountNumber` is omitted).
   */
  async fetchDeposits(since: Date, accountNumber?: string): Promise<MoniepointDeposit[]> {
    if (!this.isConfigured) {
      this.logger.debug(
        'Moniepoint reconciliation: API not configured, skipping deposit fetch',
      );
      return [];
    }

    try {
      // TODO: implement the real call, e.g.
      //   GET {baseUrl}/api/v1/deposits?since={since.toISOString()}&account={accountNumber}
      // with `Authorization: Bearer {apiKey}` and a request signature.
      this.logger.warn(
        'Moniepoint reconciliation: fetchDeposits not implemented yet ' +
          `(baseUrl=${this.baseUrl} since=${since.toISOString()} account=${accountNumber ?? 'any'})`,
      );
      return [];
    } catch (err) {
      this.logger.error(
        `Moniepoint reconciliation: fetchDeposits failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }
}
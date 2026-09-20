import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  WebhookEvent,
  WebhookOutcome,
  WebhookSignatureStatus,
} from './entities/webhook-event.entity';

export interface WebhookEventRecord {
  provider: string;
  branchId?: string | null;
  reference?: string | null;
  amountKobo?: number | null;
  billId?: string | null;
  payloadHash: string;
  signatureStatus: WebhookSignatureStatus;
  outcome: WebhookOutcome;
  httpStatus?: number;
  errorMessage?: string | null;
  payload?: Record<string, any> | null;
}

/** Payload rows are for debugging; cap their size so a hostile or gigantic
 *  delivery can never bloat the ledger. */
const MAX_PAYLOAD_JSON_BYTES = 8 * 1024;

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventRepo: Repository<WebhookEvent>,
  ) {}

  /**
   * Append one delivery to the ledger. Never throws: the ledger is
   * observability, and a logging failure must never turn a settled payment
   * into a 500 (which would make the provider retry a success).
   */
  async record(entry: WebhookEventRecord): Promise<void> {
    try {
      let payload = entry.payload ?? null;
      if (payload) {
        try {
          if (
            Buffer.byteLength(JSON.stringify(payload), 'utf8') >
            MAX_PAYLOAD_JSON_BYTES
          ) {
            payload = { truncated: true };
          }
        } catch {
          payload = { unserializable: true };
        }
      }
      await this.eventRepo.save(
        this.eventRepo.create({
          provider: entry.provider,
          branch_id: entry.branchId ?? null,
          reference: entry.reference ?? null,
          amount_kobo: entry.amountKobo ?? null,
          bill_id: entry.billId ?? null,
          payload_hash: entry.payloadHash,
          signature_status: entry.signatureStatus,
          outcome: entry.outcome,
          http_status: entry.httpStatus ?? 200,
          error_message: entry.errorMessage ?? null,
          payload,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to record webhook event (${entry.provider}/${entry.outcome}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Replay dedupe: has a byte-identical delivery already been verified and
   * settled? Only settled/already-settled outcomes count — a delivery that
   * previously errored must be allowed to retry. Fails open (false) on query
   * errors so a ledger outage can never block real payments; the bill-level
   * idempotency claim still prevents double settlement.
   */
  async hasSettledPayload(
    provider: string,
    payloadHash: string,
  ): Promise<boolean> {
    try {
      const count = await this.eventRepo.count({
        where: {
          provider,
          payload_hash: payloadHash,
          signature_status: In(['verified', 'simulated']),
          outcome: In(['settled', 'already_paid', 'duplicate']),
        },
      });
      return count > 0;
    } catch (err) {
      this.logger.error(
        `Replay-dedupe lookup failed for ${provider}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async list(filters: {
    provider?: string;
    branchId?: string;
    outcome?: string;
    signatureStatus?: string;
    limit?: number;
    before?: Date;
  }): Promise<WebhookEvent[]> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.created_at', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    if (filters.provider)
      qb.andWhere('e.provider = :provider', { provider: filters.provider });
    if (filters.branchId)
      qb.andWhere('e.branch_id = :branchId', { branchId: filters.branchId });
    if (filters.outcome)
      qb.andWhere('e.outcome = :outcome', { outcome: filters.outcome });
    if (filters.signatureStatus)
      qb.andWhere('e.signature_status = :sig', {
        sig: filters.signatureStatus,
      });
    if (filters.before)
      qb.andWhere('e.created_at < :before', { before: filters.before });
    return qb.getMany();
  }

  /**
   * Per-provider health for the super-admin dashboard: last delivery, last
   * verified delivery, last settlement, and outcome counts over a window.
   */
  async providerHealth(windowHours = 24): Promise<
    Array<{
      provider: string;
      last_event_at: Date | null;
      last_verified_at: Date | null;
      last_settled_at: Date | null;
      total: number;
      settled: number;
      invalid_signature: number;
      unverifiable: number;
      amount_mismatch: number;
      no_bill: number;
      errors: number;
    }>
  > {
    const since = new Date(Date.now() - windowHours * 3600 * 1000);
    const rows: Array<Record<string, any>> = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.provider', 'provider')
      .addSelect('MAX(e.created_at)', 'last_event_at')
      .addSelect(
        `MAX(e.created_at) FILTER (WHERE e.signature_status IN ('verified','simulated'))`,
        'last_verified_at',
      )
      .addSelect(
        `MAX(e.created_at) FILTER (WHERE e.outcome = 'settled')`,
        'last_settled_at',
      )
      .addSelect('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE e.outcome = 'settled')`, 'settled')
      .addSelect(
        `COUNT(*) FILTER (WHERE e.signature_status = 'invalid')`,
        'invalid_signature',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE e.signature_status = 'unverifiable')`,
        'unverifiable',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE e.outcome = 'amount_mismatch')`,
        'amount_mismatch',
      )
      .addSelect(`COUNT(*) FILTER (WHERE e.outcome = 'no_bill')`, 'no_bill')
      .addSelect(`COUNT(*) FILTER (WHERE e.outcome = 'error')`, 'errors')
      .where('e.created_at >= :since', { since })
      .groupBy('e.provider')
      .getRawMany();
    return rows.map((r) => ({
      provider: r.provider,
      last_event_at: r.last_event_at ?? null,
      last_verified_at: r.last_verified_at ?? null,
      last_settled_at: r.last_settled_at ?? null,
      total: Number(r.total ?? 0),
      settled: Number(r.settled ?? 0),
      invalid_signature: Number(r.invalid_signature ?? 0),
      unverifiable: Number(r.unverifiable ?? 0),
      amount_mismatch: Number(r.amount_mismatch ?? 0),
      no_bill: Number(r.no_bill ?? 0),
      errors: Number(r.errors ?? 0),
    }));
  }
}

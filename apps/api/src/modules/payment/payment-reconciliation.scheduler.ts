import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Notification } from '../notification/entities/notification.entity';
import { NotificationService } from '../notification/notification.service';
import { MoniepointErpPush } from './entities/moniepoint-erp-push.entity';
import {
  MoniepointApiClient,
  MoniepointEventStatus,
  MoniepointSubscriptionEvent,
} from './moniepoint-api.client';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Heuristic mapping of Moniepoint transaction `processingStatus`/`responseCode`
 * values. The primary completion signal for a push is the bill being settled by
 * the existing webhook path; this lookup is the fallback. The exact status
 * enum values are only confirmed by a real pushed transaction, so these regexes
 * are deliberately conservative — an unrecognized status keeps the push pending
 * instead of risking a wrong settlement.
 */
const PROCESSING_SUCCESS_RE = /SUCCESS|COMPLETED|AUTH|PAID/i;
const PROCESSING_FAILURE_RE = /FAILED|DECLINED|REVERSED|ERROR/i;

const isSuccessfulProcessingStatus = (status?: string): boolean =>
  !!status && PROCESSING_SUCCESS_RE.test(status);

const isFailedProcessingStatus = (
  status?: string,
  responseCode?: string,
): boolean =>
  (!!status && PROCESSING_FAILURE_RE.test(status)) ||
  (!!responseCode && PROCESSING_FAILURE_RE.test(responseCode));

/**
 * Periodically asks Moniepoint which webhook DELIVERIES it could not get to
 * us, and alerts on the ones that stopped retrying. This is the delivery-led
 * reconciliation model: Moniepoint is the source of truth for delivery
 * success, not a deposits poll.
 *
 * - FAILED events whose next retry (`retryAt`) is in the past or absent have
 *   stopped; they get a PAYMENT_RECONCILIATION alert (never silently dropped).
 * - PENDING events are skipped while Moniepoint is still retrying (future
 *   `retryAt`, or recently created with no retry scheduled yet); only a
 *   pending event that has lingered past MONIEPOINT_PENDING_STALE_MINUTES
 *   without a scheduled retry is treated as stuck and alerted.
 *
 * We deliberately do NOT auto-resend: our hardened webhook rejects
 * unverifiable/unmatched deliveries with 403, so a resend would re-403 and
 * loop. The alert carries the event id so staff can resend (client
 * `resendEvents`) once the underlying bill is in place.
 *
 * Guarded: the whole job no-ops unless the client is configured.
 */
@Injectable()
export class PaymentReconciliationScheduler {
  private readonly logger = new Logger(PaymentReconciliationScheduler.name);

  constructor(
    @InjectRepository(PosTerminal)
    private posTerminalRepo: Repository<PosTerminal>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(MoniepointErpPush)
    private erpPushRepo: Repository<MoniepointErpPush>,
    private moniepointClient: MoniepointApiClient,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile() {
    if (!this.moniepointClient.isConfigured) {
      return;
    }

    const windowMinutes =
      Number(process.env.MONIEPOINT_RECONCILE_WINDOW_MINUTES) || 360;
    const from = new Date(Date.now() - windowMinutes * 60_000);
    const to = new Date();

    try {
      for (const event of await this.deliveryEvents(['FAILED'], from, to)) {
        if (this.isStillRetrying(event)) continue;
        await this.handleUnresolvedDelivery(event, 'failed');
      }
      for (const event of await this.deliveryEvents(['PENDING'], from, to)) {
        if (this.isStillRetrying(event)) continue;
        await this.handleUnresolvedDelivery(event, 'stuck-pending');
      }
    } catch (err) {
      this.logger.error(
        `[monniepoint][reconcile] run failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Resolve the outcome of ERP push-payments (moniepoint_erp_pushes).
   *
   * Completion signal model (reuses the existing POS integration surface —
   * no new webhook/subscription): when the guest pays at the terminal,
   * Moniepoint emits a POS event that our existing webhook settles the linked
   * bill with; the platform POS API (`getMerchantTransaction`) is the
   * directed fallback lookup.
   *
   *   - linked bill paid            -> push marked `paid` (webhook settled it)
   *   - POS lookup reports failure   -> `declined` + branch alert
   *   - no signal before stale cut-  -> `expired` + branch alert (guest never
   *     off (MONIEPOINT_PUSH_STALE_    completed; a re-push derives a fresh
   *     MINUTES, default 60)            reference)
   *
   * Note: a branch whose push targets a SANDBOX credential while the platform
   * MONIEPOINT_API_KEY points at PROD will not resolve via the lookup — the
   * push stays `pending` until the stale alert (webhook settlement works
   * either way).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileErpPushes(): Promise<void> {
    const staleMinutes =
      Number(process.env.MONIEPOINT_PUSH_STALE_MINUTES) || 60;
    const lookupDelayMinutes =
      Number(process.env.MONIEPOINT_PUSH_LOOKUP_DELAY_MINUTES) || 2;
    const staleCutoff = Date.now() - staleMinutes * 60_000;

    let pending: MoniepointErpPush[];
    try {
      pending = await this.erpPushRepo.find({ where: { status: 'pending' } });
    } catch (err) {
      this.logger.error(
        `[monniepoint][erp] could not load pending pushes: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    for (const push of pending) {
      try {
        const pushedAt = push.pushed_at
          ? new Date(push.pushed_at).getTime()
          : Date.now();
        if (pushedAt <= staleCutoff) {
          push.status = 'expired';
          push.error =
            'No completion signal before the push expired — guest never completed the payment';
          await this.erpPushRepo.save(push);
          await this.alertErpPush(push, 'expired');
          continue;
        }
        if (Date.now() - pushedAt < lookupDelayMinutes * 60_000) continue;

        if (push.bill_id) {
          const bill = await this.billRepo.findOne({
            where: { id: push.bill_id },
          });
          if (bill?.paid_at) {
            push.status = 'paid';
            push.paid_at = bill.paid_at;
            await this.erpPushRepo.save(push);
            continue;
          }
        }

        if (this.moniepointClient.isConfigured) {
          const tx = await this.moniepointClient.getMerchantTransaction(
            push.merchant_reference,
          );
          if (isSuccessfulProcessingStatus(tx.processingStatus)) {
            push.status = 'paid';
            push.paid_at = tx.modifiedAt ? new Date(tx.modifiedAt) : new Date();
            await this.erpPushRepo.save(push);
          } else if (
            isFailedProcessingStatus(tx.processingStatus, tx.responseCode)
          ) {
            push.status = 'declined';
            push.error =
              tx.responseMessage ?? tx.processingStatus ?? 'Declined';
            await this.erpPushRepo.save(push);
            await this.alertErpPush(push, 'declined');
          }
        }
      } catch (err) {
        // Not found yet (404) and transient errors keep the push pending for
        // the next run — never crash the whole pass.
        this.logger.debug(
          `[monniepoint][erp] lookup pending ref=${push.merchant_reference}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async deliveryEvents(
    statuses: MoniepointEventStatus[],
    from: Date,
    to: Date,
  ): Promise<MoniepointSubscriptionEvent[]> {
    const events: MoniepointSubscriptionEvent[] = [];
    const size = 100;
    for (let page = 0; ; page++) {
      const result = await this.moniepointClient.listSubscriptionEvents({
        statuses,
        from,
        to,
        page,
        size,
      });
      events.push(...result.content);
      if (
        !result.content.length ||
        result.last ||
        page >= (result.totalPages || 1) - 1
      ) {
        break;
      }
    }
    return events;
  }

  /** True when Moniepoint still plans another delivery attempt. */
  private isStillRetrying(
    event: MoniepointSubscriptionEvent,
    now = new Date(),
  ): boolean {
    if (event.retryAt && new Date(event.retryAt).getTime() > now.getTime()) {
      return true;
    }
    if (event.status === 'PENDING' && !event.retryAt) {
      const staleMinutes =
        Number(process.env.MONIEPOINT_PENDING_STALE_MINUTES) || 120;
      const created = event.createdAt ? new Date(event.createdAt) : now;
      return now.getTime() - created.getTime() < staleMinutes * 60_000;
    }
    return false;
  }

  private async handleUnresolvedDelivery(
    event: MoniepointSubscriptionEvent,
    reason: 'failed' | 'stuck-pending',
  ): Promise<void> {
    const { reference } = this.extractPayloadReferences(event);

    if (reference) {
      const settled = await this.billRepo.findOne({
        where: { payment_reference: reference },
      });
      if (settled?.paid_at) return;
    }

    const branch = await this.resolveEventBranch(event);
    if (!branch) {
      this.logger.warn(
        `[monniepoint][reconcile] no branch anchor for delivery event=${event.id} ref=${reference ?? 'n/a'} — manual review required`,
      );
      return;
    }

    if (
      await this.alreadyAlerted(
        branch.id,
        'payment_reconciliation',
        'event_id',
        event.id,
      )
    ) {
      return;
    }

    await this.notificationService.create({
      branch_id: branch.id,
      user_id: null,
      type: 'payment_reconciliation',
      title:
        reason === 'failed'
          ? 'Failed Moniepoint Webhook Delivery'
          : 'Stuck Moniepoint Webhook Delivery',
      message: this.alertMessage(event, reason, reference),
      data: {
        event_id: event.id,
        event_type: event.eventType ?? null,
        reference: reference ?? null,
        status: event.status,
        retry_times: event.retryTimes ?? 0,
        retry_at: event.retryAt ?? null,
        endpoint_url: event.endpointUrl ?? null,
        reason,
        detected_at: new Date().toISOString(),
      },
    });
    this.logger.warn(
      `[monniepoint][reconcile] alerted ${reason} delivery event=${event.id} ref=${reference ?? 'n/a'} branch=${branch.id}`,
    );
  }

  private alertMessage(
    event: MoniepointSubscriptionEvent,
    reason: 'failed' | 'stuck-pending',
    reference: string | null,
  ): string {
    const refPart = reference ? ` (ref: ${reference})` : '';
    const retryPart =
      event.retryTimes && event.retryTimes > 0
        ? ` after ${event.retryTimes} attempt(s)`
        : '';
    const endpoint = event.endpointUrl ? ` Target: ${event.endpointUrl}.` : '';
    if (reason === 'failed') {
      return `Moniepoint could not deliver a webhook${refPart}${retryPart}.${endpoint}`;
    }
    return `A pending Moniepoint webhook${refPart} has not been retried in time.${endpoint}`;
  }

  private async alreadyAlerted(
    branchId: string,
    type: string,
    dataKey: string,
    dataValue: string,
  ): Promise<boolean> {
    const existing = await this.notificationRepo.findOne({
      where: {
        branch_id: branchId,
        type,
        data: Raw((column) => `${column}::jsonb->>'${dataKey}' = :dataValue`, {
          dataValue,
        }),
      },
    });
    return !!existing;
  }

  /** Alert the tenant that a push expired without payment or was declined. */
  private async alertErpPush(
    push: MoniepointErpPush,
    outcome: 'expired' | 'declined',
  ): Promise<void> {
    const branch = await this.branchRepo.findOne({
      where: { id: push.branch_id },
    });
    if (!branch) {
      this.logger.warn(
        `[monniepoint][erp] alert skipped — branch ${push.branch_id} not found for push ${push.id}`,
      );
      return;
    }
    if (
      await this.alreadyAlerted(
        branch.id,
        'erp_push',
        'merchant_reference',
        push.merchant_reference,
      )
    ) {
      return;
    }

    const message =
      outcome === 'declined'
        ? `The pushed payment was declined${push.error ? `: ${push.error}` : ''}. You can retry the push in the app.`
        : 'The pushed payment expired without the guest completing it. Re-push from the app when ready.';

    await this.notificationService.create({
      branch_id: branch.id,
      user_id: null,
      type: 'erp_push',
      title:
        outcome === 'declined'
          ? 'Declined Moniepoint Push'
          : 'Expired Moniepoint Push',
      message,
      data: {
        push_id: push.id,
        merchant_reference: push.merchant_reference,
        terminal_serial: push.terminal_serial,
        amount_kobo: push.amount_kobo,
        bill_id: push.bill_id,
        status: push.status,
        outcome,
        detected_at: new Date().toISOString(),
      },
    });
    this.logger.warn(
      `[monniepoint][erp] alerted ${outcome} push=${push.id} ref=${push.merchant_reference} branch=${push.branch_id}`,
    );
  }

  private extractPayloadReferences(event: MoniepointSubscriptionEvent): {
    reference: string | null;
    terminal: string | null;
    accountNumber: string | null;
  } {
    const payload = event.payload ?? {};
    const nested = payload.data ?? {};
    const reference =
      payload.reference ??
      payload.paymentReference ??
      payload.transactionReference ??
      payload.merchantReference ??
      nested.reference ??
      nested.paymentReference ??
      null;
    const terminal =
      payload.terminalId ??
      payload.terminal_id ??
      payload.terminal ??
      payload.posTerminalId ??
      nested.terminalId ??
      null;
    const accountNumber =
      payload.destinationAccountInformation?.accountNumber ??
      payload.account_number ??
      payload.accountNumber ??
      nested.account_number ??
      nested.accountNumber ??
      null;
    return { reference, terminal, accountNumber };
  }

  private async resolveEventBranch(
    event: MoniepointSubscriptionEvent,
  ): Promise<Branch | null> {
    const { reference, terminal, accountNumber } =
      this.extractPayloadReferences(event);

    if (terminal) {
      let term: PosTerminal | null = null;
      if (UUID_RE.test(terminal)) {
        term = await this.posTerminalRepo.findOne({ where: { id: terminal } });
      }
      if (!term) {
        term = await this.posTerminalRepo.findOne({
          where: { label: terminal },
        });
      }
      if (term) {
        return this.branchRepo.findOne({ where: { id: term.branch_id } });
      }
    }

    if (accountNumber) {
      const byAccount = await this.findBranchByAccount(accountNumber);
      if (byAccount) return byAccount;
    }

    if (reference) {
      const bill = await this.billRepo.findOne({
        where: { payment_reference: reference },
      });
      if (bill) {
        if (bill.tab_id) {
          const tab = await this.tabRepo.findOne({
            where: { id: bill.tab_id },
          });
          if (tab) {
            return this.branchRepo.findOne({ where: { id: tab.branch_id } });
          }
        }
        if (bill.branch_id) {
          return this.branchRepo.findOne({ where: { id: bill.branch_id } });
        }
      }
    }
    return null;
  }

  private async findBranchByAccount(
    accountNumber: string,
  ): Promise<Branch | null> {
    const branches = await this.branchRepo.find();
    for (const branch of branches) {
      const provider = this.findMoniepointProvider(branch);
      const config = provider?.config ?? {};
      const configured =
        config.account_number ?? config.accountNumber ?? config.account;
      if (configured && String(configured) === accountNumber) {
        return branch;
      }
    }
    return null;
  }

  private findMoniepointProvider(branch: Branch): any {
    const providers = Array.isArray(branch.settings?.payment_providers)
      ? branch.settings.payment_providers
      : [];
    return providers.find((p: any) => p?.name === 'monniepoint') || null;
  }
}

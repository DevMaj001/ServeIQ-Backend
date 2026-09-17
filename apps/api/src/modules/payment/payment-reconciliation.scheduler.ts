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
import {
  MoniepointApiClient,
  MoniepointEventStatus,
  MoniepointSubscriptionEvent,
} from './moniepoint-api.client';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    if (await this.alreadyAlerted(branch.id, event.id)) return;

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
    eventId: string,
  ): Promise<boolean> {
    const existing = await this.notificationRepo.findOne({
      where: {
        branch_id: branchId,
        type: 'payment_reconciliation',
        data: Raw((column) => `${column}::jsonb->>'event_id' = :eventId`, {
          eventId,
        }),
      },
    });
    return !!existing;
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

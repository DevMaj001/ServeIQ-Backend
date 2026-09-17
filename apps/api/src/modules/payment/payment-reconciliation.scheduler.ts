import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Notification } from '../notification/entities/notification.entity';
import { NotificationService } from '../notification/notification.service';
import { MoniepointApiClient } from './moniepoint-api.client';

/**
 * Periodically cross-checks Moniepoint's own deposit history against bills
 * that were settled via webhook, flagging any deposit that never produced a
 * settlement or already-produced alert.
 *
 * Scaffold: fully guarded — the whole job no-ops unless
 * MONIEPOINT_API_BASE_URL / MONIEPOINT_API_KEY / MONIEPOINT_API_SECRET are set.
 * Runs every 5 minutes; re-checks a rolling window (default 6 hours) and
 * dedupes alerts by transaction reference in the notifications table so a
 * deposit is never alerted twice.
 */
@Injectable()
export class PaymentReconciliationScheduler {
  private readonly logger = new Logger(PaymentReconciliationScheduler.name);

  constructor(
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
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

    const since = new Date(
      Date.now() -
        ((Number(process.env.MONIEPOINT_RECONCILE_WINDOW_MINUTES) || 360) *
          60_000),
    );

    const branches = await this.branchRepo.find();
    for (const branch of branches) {
      const provider = this.findMoniepointProvider(branch);
      if (!provider) continue;
      const account = provider.config?.account_number
        ?? provider.config?.accountNumber
        ?? provider.config?.account;
      if (!account) continue;

      try {
        const deposits = await this.moniepointClient.fetchDeposits(since, account);
        for (const deposit of deposits) {
          if (deposit.status !== 'SUCCESS') continue;
          await this.reconcileDeposit(branch, deposit);
        }
      } catch (err) {
        this.logger.error(
          `Reconciliation failed for branch ${branch.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async reconcileDeposit(branch: Branch, deposit: any): Promise<void> {
    const { reference } = deposit;
    if (!reference) return;

    // Already settled a bill with this reference, or already alerted?
    const settled = await this.billRepo.findOne({
      where: { payment_reference: reference },
    });
    if (settled?.paid_at) return;

    const alreadyAlerted = await this.notificationRepo.findOne({
      where: { branch_id: branch.id, type: 'payment_reconciliation' },
    });
    if (
      alreadyAlerted?.data &&
      typeof alreadyAlerted.data === 'object' &&
      (alreadyAlerted.data as any).reference === reference
    ) {
      return;
    }

    this.logger.warn(
      `[monniepoint][reconcile] deposit without webhook settlement ref=${reference} branch=${branch.id}`,
    );
    await this.notificationService.create({
      branch_id: branch.id,
      user_id: null,
      type: 'payment_reconciliation',
      title: 'Unsettled Moniepoint Deposit',
      message: `A deposit of ₦${((deposit.amount_kobo ?? 0) / 100).toFixed(2)} (ref: ${reference}) has no matching settlement. Check the payment webhook was delivered.`,
      data: { reference, account_number: deposit.account_number, reason: 'reconcile', detected_at: new Date().toISOString() },
    });
  }

  private findMoniepointProvider(branch: Branch): any {
    const providers = Array.isArray(branch.settings?.payment_providers)
      ? branch.settings.payment_providers
      : [];
    return providers.find((p: any) => p?.name === 'monniepoint') || null;
  }
}
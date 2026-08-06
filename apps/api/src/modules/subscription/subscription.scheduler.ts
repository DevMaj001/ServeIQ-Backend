import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOverdueSubscriptions() {
    const now = new Date();

    const trialingExpired = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.TRIALING,
        trial_ends_at: LessThan(now),
      },
    });

    for (const sub of trialingExpired) {
      sub.status = SubscriptionStatus.EXPIRED;
      this.logger.log(
        `Subscription ${sub.id} (branch ${sub.branch_id}): trial ended → expired`,
      );
    }
    if (trialingExpired.length) {
      await this.subscriptionRepo.save(trialingExpired);
    }

    const pastDueExpired = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        grace_period_ends_at: LessThan(now),
      },
    });

    for (const sub of pastDueExpired) {
      sub.status = SubscriptionStatus.EXPIRED;
      this.logger.log(
        `Subscription ${sub.id} (branch ${sub.branch_id}): grace period ended → expired`,
      );
    }
    if (pastDueExpired.length) {
      await this.subscriptionRepo.save(pastDueExpired);
    }

    const canceledExpired = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.CANCELED,
        current_period_end: LessThan(now),
      },
    });

    for (const sub of canceledExpired) {
      sub.status = SubscriptionStatus.EXPIRED;
      this.logger.log(
        `Subscription ${sub.id} (branch ${sub.branch_id}): canceled period ended → expired`,
      );
    }
    if (canceledExpired.length) {
      await this.subscriptionRepo.save(canceledExpired);
    }
  }
}

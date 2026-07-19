import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Subscription, SubscriptionStatus } from '../../modules/subscription/entities/subscription.entity';
import { SubscriptionRequiredException } from '../../modules/subscription/exceptions/subscription-required.exception';

const EXCLUDED_MATCHES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/waiter-login',
  '/api/v1/auth/send-email-verification',
  '/api/v1/auth/verify-email',
  '/api/v1/roles/my-permissions',
  '/api/v1/subscriptions/initialize',
  '/api/v1/webhooks/paystack',
];

const EXCLUDED_PREFIXES = ['/api/v1/auth/', '/api/v1/subscriptions/', '/api/v1/webhooks/paystack', '/api/v1/public/', '/api/v1/tracking/'];

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path: string = request.route?.path || request.path;

    if (this.isExcluded(path)) {
      return true;
    }

    for (const prefix of EXCLUDED_PREFIXES) {
      if (path.startsWith(prefix)) {
        return true;
      }
    }

    // Super admins bypass the subscription check entirely
    if (request.user?.role === 'superadmin') {
      return true;
    }

    let branchId: string | undefined;

    if (request.user?.branchId) {
      branchId = request.user.branchId;
    } else {
      const authHeader = request.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7);
          const payload = this.jwtService.verify(token);
          branchId = payload.branchId;
        } catch {
          return true;
        }
      } else {
        return true;
      }
    }

    if (!branchId) {
      return true;
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branchId },
    });

    if (!subscription) {
      throw new SubscriptionRequiredException('no_subscription', 'subscribe');
    }

    return this.evaluateSubscription(subscription);
  }

  private evaluateSubscription(sub: Subscription): boolean {
    const now = Date.now();

    if (sub.trial_ends_at && sub.trial_ends_at.getTime() > now) {
      return true;
    }

    if (sub.grace_period_ends_at && sub.grace_period_ends_at.getTime() > now) {
      return true;
    }

    if (sub.current_period_end && sub.current_period_end.getTime() > now && sub.status === SubscriptionStatus.CANCELED) {
      return true;
    }

    switch (sub.status) {
      case SubscriptionStatus.ACTIVE:
        return true;

      case SubscriptionStatus.TRIALING:
        if (sub.trial_ends_at && sub.trial_ends_at.getTime() > now) {
          return true;
        }
        throw new SubscriptionRequiredException('expired', 'subscribe');

      case SubscriptionStatus.PAST_DUE:
        if (sub.grace_period_ends_at && sub.grace_period_ends_at.getTime() > now) {
          return true;
        }
        throw new SubscriptionRequiredException('past_due', 'retry_payment');

      case SubscriptionStatus.CANCELED:
        if (sub.current_period_end && sub.current_period_end.getTime() > now) {
          return true;
        }
        throw new SubscriptionRequiredException('canceled', 'subscribe');

      case SubscriptionStatus.EXPIRED:
        throw new SubscriptionRequiredException('expired', 'subscribe');
    }

    throw new SubscriptionRequiredException('no_subscription', 'subscribe');
  }

  private isExcluded(path: string): boolean {
    return EXCLUDED_MATCHES.some((excluded) => path === excluded);
  }
}

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Subscription, SubscriptionStatus } from '../../modules/subscription/entities/subscription.entity';

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
  '/api/v1/subscriptions/initialize',
  '/api/v1/webhooks/paystack',
];

const EXCLUDED_PREFIXES = ['/api/v1/auth/', '/api/v1/subscriptions/', '/api/v1/webhooks/paystack'];

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
      throw new HttpException(
        { statusCode: 402, message: 'Subscription required' },
        HttpStatus.PAYMENT_REQUIRED,
      );
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
        break;

      case SubscriptionStatus.PAST_DUE:
        if (sub.grace_period_ends_at && sub.grace_period_ends_at.getTime() > now) {
          return true;
        }
        break;

      case SubscriptionStatus.CANCELED:
      case SubscriptionStatus.EXPIRED:
        break;
    }

    throw new HttpException(
      { statusCode: 402, message: 'Subscription required' },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  private isExcluded(path: string): boolean {
    return EXCLUDED_MATCHES.some((excluded) => path === excluded);
  }
}

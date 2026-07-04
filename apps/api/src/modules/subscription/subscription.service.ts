import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';

const Paystack = require('paystack');

@Injectable()
export class SubscriptionService {
  private paystack: any;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (secretKey) {
      this.paystack = new Paystack(secretKey);
    }
  }

  async createTrialSubscription(branchId: string, manager?: EntityManager): Promise<Subscription> {
    const repo = manager ? manager.getRepository(Subscription) : this.subscriptionRepo;
    const subscription = repo.create({
      branch_id: branchId,
      status: SubscriptionStatus.TRIALING,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    return repo.save(subscription);
  }

  async initialize(branchId: string, planId: string) {
    const plan = await this.planRepo.findOne({ where: { id: planId, is_active: true } });
    if (!plan) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: { business: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const business = branch.business;
    const customerEmail = business.email;

    let subscription = await this.subscriptionRepo.findOne({ where: { branch_id: branchId } });

    let customerCode = subscription?.paystack_customer_code ?? null;

    if (!customerCode) {
      const customerResp = await this.paystack.customer.create({ email: customerEmail });
      customerCode = customerResp.data.customer_code;
    }

    let paystackPlanCode = plan.paystack_plan_code;
    if (!paystackPlanCode) {
      throw new BadRequestException('Plan has not been configured with a Paystack plan code');
    }

    const initializeResp = await this.paystack.transaction.initialize({
      amount: plan.price,
      email: customerEmail,
      plan: paystackPlanCode,
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    });

    if (subscription) {
      subscription.plan_id = planId;
      subscription.paystack_customer_code = customerCode;
      subscription.status = SubscriptionStatus.TRIALING;
      await this.subscriptionRepo.save(subscription);
    } else {
      subscription = this.subscriptionRepo.create({
        branch_id: branchId,
        plan_id: planId,
        paystack_customer_code: customerCode,
        status: SubscriptionStatus.TRIALING,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      await this.subscriptionRepo.save(subscription);
    }

    return {
      authorization_url: initializeResp.data.authorization_url,
      access_code: initializeResp.data.access_code,
      reference: initializeResp.data.reference,
    };
  }

  async handleChargeSuccess(data: any) {
    const customerEmail = data.customer?.email;
    if (!customerEmail) return;

    const business = await this.businessRepo.findOne({ where: { email: customerEmail } });
    if (!business) return;

    const branch = await this.branchRepo.findOne({ where: { business_id: business.id } });
    if (!branch) return;

    let subscription = await this.subscriptionRepo.findOne({ where: { branch_id: branch.id } });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = new Date(data.created_at);
    subscription.current_period_end = new Date(data.subscription?.next_payment_date || Date.now() + 30 * 24 * 60 * 60 * 1000);
    subscription.paystack_customer_code = data.customer?.customer_code || subscription.paystack_customer_code;
    subscription.paystack_subscription_code = data.subscription?.subscription_code || subscription.paystack_subscription_code;
    subscription.trial_ends_at = null;

    await this.subscriptionRepo.save(subscription);
  }

  async handleSubscriptionCreate(data: any) {
    const customerCode = data.customer?.customer_code;
    if (!customerCode) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { paystack_customer_code: customerCode },
    });
    if (!subscription) return;

    subscription.paystack_subscription_code = data.subscription_code;

    await this.subscriptionRepo.save(subscription);
  }

  async handleInvoicePaymentFailed(data: any) {
    const customerEmail = data.customer?.email;
    if (!customerEmail) return;

    const business = await this.businessRepo.findOne({ where: { email: customerEmail } });
    if (!business) return;

    const branch = await this.branchRepo.findOne({ where: { business_id: business.id } });
    if (!branch) return;

    const subscription = await this.subscriptionRepo.findOne({ where: { branch_id: branch.id } });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.grace_period_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.subscriptionRepo.save(subscription);
  }

  async handleSubscriptionDisable(data: any) {
    const subscriptionCode = data.subscription_code;
    if (!subscriptionCode) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { paystack_subscription_code: subscriptionCode },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.CANCELED;

    await this.subscriptionRepo.save(subscription);
  }

  async getCurrent(branchId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branchId },
      relations: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this branch');
    }
    return subscription;
  }

  async cancel(branchId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branchId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this branch');
    }
    if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.PAST_DUE) {
      throw new BadRequestException('Only active or past-due subscriptions can be canceled');
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceled_at = new Date();
    await this.subscriptionRepo.save(subscription);

    if (subscription.paystack_subscription_code) {
      try {
        const sub = await this.paystack.subscription.get(subscription.paystack_subscription_code);
        const token = sub?.data?.email_token;
        if (token) {
          await this.paystack.subscription.disable({
            code: subscription.paystack_subscription_code,
            token,
          });
        }
      } catch {
        // if Paystack disable fails, local cancel is still recorded
      }
    }

    return subscription;
  }

  async extendGracePeriod(dto: { branch_id: string; days: number }) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: dto.branch_id },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this branch');
    }

    subscription.grace_period_ends_at = new Date(Date.now() + dto.days * 24 * 60 * 60 * 1000);
    if (subscription.status === SubscriptionStatus.EXPIRED) {
      subscription.status = SubscriptionStatus.PAST_DUE;
    }

    await this.subscriptionRepo.save(subscription);
    return subscription;
  }

  async adminGrant(dto: { branch_id: string; plan_id: string; current_period_end?: string }) {
    const plan = await this.planRepo.findOne({ where: { id: dto.plan_id, is_active: true } });
    if (!plan) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const branch = await this.branchRepo.findOne({ where: { id: dto.branch_id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    let subscription = await this.subscriptionRepo.findOne({ where: { branch_id: dto.branch_id } });

    if (subscription) {
      subscription.plan_id = dto.plan_id;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.current_period_start = new Date();
      subscription.current_period_end = dto.current_period_end
        ? new Date(dto.current_period_end)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      subscription.trial_ends_at = null;
      subscription.grace_period_ends_at = null;
      subscription.canceled_at = null;
    } else {
      subscription = this.subscriptionRepo.create({
        branch_id: dto.branch_id,
        plan_id: dto.plan_id,
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: dto.current_period_end
          ? new Date(dto.current_period_end)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    await this.subscriptionRepo.save(subscription);
    return subscription;
  }

  async verifyPaystackSignature(signature: string, body: string): Promise<boolean> {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) return false;

    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
    return hash === signature;
  }
}

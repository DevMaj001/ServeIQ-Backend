import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
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

  async createTrialSubscription(
    branchId: string,
    manager?: EntityManager,
  ): Promise<Subscription> {
    const repo = manager
      ? manager.getRepository(Subscription)
      : this.subscriptionRepo;
    const subscription = repo.create({
      branch_id: branchId,
      status: SubscriptionStatus.TRIALING,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    return repo.save(subscription);
  }

  async initialize(branchId: string, planId: string) {
    if (!this.paystack) {
      throw new BadRequestException(
        'Payment gateway (Paystack) is not configured',
      );
    }

    const isUUIDRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let plan = null;
    if (isUUIDRegex.test(planId)) {
      plan = await this.planRepo.findOne({
        where: { id: planId, is_active: true },
      });
    } else {
      if (planId.startsWith('fallback-')) {
        const inner = planId.slice('fallback-'.length);
        const parts = inner.split('-');
        if (parts.length >= 1) {
          const name = parts[0];
          const currency =
            parts.length >= 2
              ? parts[parts.length - 1].toUpperCase()
              : undefined;
          const qb = this.planRepo
            .createQueryBuilder('p')
            .where('LOWER(p.name) = LOWER(:name)', { name })
            .andWhere('p.is_active = :active', { active: true })
            .orderBy('p.created_at', 'ASC')
            .take(1);
          if (currency) {
            qb.andWhere('p.currency = :currency', { currency });
          }
          plan = await qb.getOne();
        }
      }
    }
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

    let subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branchId },
    });

    let customerCode = subscription?.paystack_customer_code ?? null;

    if (!customerCode) {
      let customerResp;
      try {
        customerResp = await this.paystack.customer.create({
          email: customerEmail,
        });
      } catch (e) {
        throw new BadRequestException(
          `Paystack customer creation failed: ${e.message}`,
        );
      }
      if (!customerResp?.status) {
        throw new BadRequestException(
          customerResp?.message || 'Failed to create Paystack customer',
        );
      }
      customerCode = customerResp.data?.customer_code;
      if (!customerCode) {
        throw new BadRequestException('Failed to create Paystack customer');
      }
    }

    const paystackPlanCode = plan.paystack_plan_code;
    if (!paystackPlanCode) {
      throw new BadRequestException(
        'Plan has not been configured with a Paystack plan code',
      );
    }

    let initializeResp;
    try {
      initializeResp = await this.paystack.transaction.initialize({
        amount: plan.price,
        email: customerEmail,
        plan: paystackPlanCode,
        channels: [
          'card',
          'bank',
          'ussd',
          'qr',
          'mobile_money',
          'bank_transfer',
        ],
      });
    } catch (e) {
      throw new BadRequestException(
        `Paystack transaction initialization failed: ${e.message}`,
      );
    }

    if (!initializeResp?.status) {
      throw new BadRequestException(
        initializeResp?.message || 'Failed to initialize Paystack transaction',
      );
    }

    if (subscription) {
      subscription.plan_id = plan.id;
      subscription.paystack_customer_code = customerCode;
      subscription.status = SubscriptionStatus.TRIALING;
      await this.subscriptionRepo.save(subscription);
    } else {
      subscription = this.subscriptionRepo.create({
        branch_id: branchId,
        plan_id: plan.id,
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

    const business = await this.businessRepo.findOne({
      where: { email: customerEmail },
    });
    if (!business) return;

    const branch = await this.branchRepo.findOne({
      where: { business_id: business.id },
    });
    if (!branch) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branch.id },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = new Date(
      this.toDateFromPaystack(data.created_at) ?? Date.now(),
    );
    subscription.current_period_end = new Date(
      this.toDateFromPaystack(data.subscription?.next_payment_date) ??
        Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
    subscription.paystack_customer_code =
      data.customer?.customer_code || subscription.paystack_customer_code;
    subscription.paystack_subscription_code =
      data.subscription?.subscription_code ||
      subscription.paystack_subscription_code;
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

    const business = await this.businessRepo.findOne({
      where: { email: customerEmail },
    });
    if (!business) return;

    const branch = await this.branchRepo.findOne({
      where: { business_id: business.id },
    });
    if (!branch) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branch.id },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.grace_period_ends_at = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

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

  async getPlans(includeInactive = false) {
    const plans = await this.planRepo.find({
      where: includeInactive ? {} : { is_active: true },
      order: { price: 'ASC' },
    });

    if (plans.length === 0) {
      const allPlans = await this.planRepo.find();
      if (allPlans.length > 0) {
        const inactiveOnly = allPlans.every((p) => !p.is_active);
        console.error(
          'CRITICAL: No active plans found. ' +
            (inactiveOnly
              ? 'All plans are inactive!'
              : 'Database is missing plans entirely.'),
          allPlans.map((p) => ({
            name: p.name,
            currency: p.currency,
            is_active: p.is_active,
          })),
        );
      } else {
        console.error(
          'CRITICAL: No plans found in database at all. Seed migration may not have run.',
        );
      }
    }

    const seen = new Set<string>();
    return plans.filter((p) => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Admin plan management
  async createPlan(dto: any) {
    const existing = await this.planRepo.findOne({
      where: { name: dto.name, currency: dto.currency },
    });
    if (existing) {
      throw new ConflictException(
        `Plan "${dto.name}" already exists for currency ${dto.currency}`,
      );
    }
    const plan = this.planRepo.create({
      name: dto.name,
      price: dto.price,
      currency: dto.currency,
      billing_interval: dto.billing_interval || 'monthly',
      features: dto.features ?? {
        max_tables: 20,
        max_waiters: 15,
        reporting_enabled: true,
      },
      is_active: dto.is_active ?? true,
      paystack_plan_code: dto.paystack_plan_code ?? null,
    });
    return this.planRepo.save(plan);
  }

  async updatePlan(id: string, dto: any) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  async deletePlan(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    await this.planRepo.remove(plan);
    return { id };
  }

  async togglePlanActive(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    plan.is_active = !plan.is_active;
    return this.planRepo.save(plan);
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
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.PAST_DUE
    ) {
      throw new BadRequestException(
        'Only active or past-due subscriptions can be canceled',
      );
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceled_at = new Date();
    await this.subscriptionRepo.save(subscription);

    if (subscription.paystack_subscription_code) {
      try {
        const sub = await this.paystack.subscription.get(
          subscription.paystack_subscription_code,
        );
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

    subscription.grace_period_ends_at = new Date(
      Date.now() + dto.days * 24 * 60 * 60 * 1000,
    );
    if (subscription.status === SubscriptionStatus.EXPIRED) {
      subscription.status = SubscriptionStatus.PAST_DUE;
    }

    await this.subscriptionRepo.save(subscription);
    return subscription;
  }

  async adminGrant(dto: {
    branch_id: string;
    plan_id: string;
    current_period_end?: string;
  }) {
    const plan = await this.planRepo.findOne({
      where: { id: dto.plan_id, is_active: true },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const branch = await this.branchRepo.findOne({
      where: { id: dto.branch_id },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    let subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: dto.branch_id },
    });

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

  async verifyPaystackSignature(
    signature: string,
    body: string,
  ): Promise<boolean> {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) return false;

    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
    return hash === signature;
  }

  private toDateFromPaystack(value: any): number | undefined {
    if (!value) return undefined;
    if (typeof value === 'number') {
      return value > 1e12 ? value : value * 1000;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Subscription, SubscriptionStatus } from '../subscription/entities/subscription.entity';
import { Plan } from '../subscription/entities/plan.entity';
import { UserRole } from '../../common/shared';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
  ) {}

  async getStats() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalBusinesses = await this.businessRepo.count();
    const activeBusinesses = await this.businessRepo.count({ where: { is_active: true } });
    const totalBranches = await this.branchRepo.count();
    const totalOwners = await this.userRepo.count({ where: { role: UserRole.OWNER } });
    const totalManagers = await this.userRepo.count({ where: { role: UserRole.MANAGER } });
    const totalWaiters = await this.userRepo.count({ where: { role: UserRole.WAITER } });
    const totalCashiers = await this.userRepo.count({ where: { role: UserRole.CASHIER } });

    const revenueResult = await this.billRepo
      .createQueryBuilder('bill')
      .select('COALESCE(SUM(bill.total_kobo), 0)', 'total')
      .where('bill.paid_at IS NOT NULL')
      .getRawOne();
    const totalRevenueKobo = Number(revenueResult?.total ?? 0);

    const newBusinessesThisMonth = await this.businessRepo
      .createQueryBuilder('b')
      .where('b.created_at >= :firstOfMonth', { firstOfMonth })
      .getCount();

    const statusBreakdown = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(s.id)', 'count')
      .groupBy('s.status')
      .getRawMany();

    const planBreakdown = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('COALESCE(p.name, \'free_trial\')', 'plan')
      .addSelect('COUNT(s.id)', 'count')
      .leftJoin('s.plan', 'p')
      .groupBy('COALESCE(p.name, \'free_trial\')')
      .getRawMany();

    const totalSubscriptions = statusBreakdown.reduce((sum, r) => sum + Number(r.count), 0);
    const activeSubscriptions = statusBreakdown
      .filter(r => r.status === 'active' || r.status === 'trialing')
      .reduce((sum, r) => sum + Number(r.count), 0);
    const expiredSubscriptions = statusBreakdown
      .filter(r => r.status === 'expired')
      .reduce((sum, r) => sum + Number(r.count), 0);
    const pastDueSubscriptions = statusBreakdown
      .filter(r => r.status === 'past_due')
      .reduce((sum, r) => sum + Number(r.count), 0);

    const recentBusinesses = await this.businessRepo.find({
      order: { created_at: 'DESC' },
      take: 5,
    });

    return {
      total_businesses: totalBusinesses,
      active_businesses: activeBusinesses,
      inactive_businesses: totalBusinesses - activeBusinesses,
      total_branches: totalBranches,
      total_owners: totalOwners,
      total_managers: totalManagers,
      total_waiters: totalWaiters,
      total_cashiers: totalCashiers,
      total_staff: totalManagers + totalWaiters + totalCashiers,
      total_revenue_kobo: totalRevenueKobo,
      new_businesses_this_month: newBusinessesThisMonth,
      total_subscriptions: totalSubscriptions,
      active_subscriptions: activeSubscriptions,
      expired_subscriptions: expiredSubscriptions,
      past_due_subscriptions: pastDueSubscriptions,
      subscription_active: activeSubscriptions,
      subscription_expired: expiredSubscriptions,
      subscription_past_due: pastDueSubscriptions,
      subscription_trialing: statusBreakdown.find(r => r.status === 'trialing')?.count || 0,
      subscription_canceled: statusBreakdown.find(r => r.status === 'canceled')?.count || 0,
      subscription_breakdown: planBreakdown.map((r: any) => ({
        plan: r.plan || 'free_trial',
        count: Number(r.count),
      })),
      subscription_status_breakdown: statusBreakdown.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      recent_businesses: recentBusinesses.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        type: b.type,
        email: b.email,
        is_active: b.is_active,
        subscription_plan: b.subscription_plan,
        created_at: b.created_at,
      })),
    };
  }

  async getBusinesses(params: {
    page: number;
    per_page: number;
    search?: string;
    status?: string;
    plan?: string;
  }) {
    const qb = this.businessRepo
      .createQueryBuilder('b');

    if (params.search) {
      qb.andWhere('(b.name ILIKE :search OR b.email ILIKE :search OR b.slug ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    if (params.status === 'active') {
      qb.andWhere('b.is_active = :isActive', { isActive: true });
    } else if (params.status === 'inactive') {
      qb.andWhere('b.is_active = :isActive', { isActive: false });
    }

    if (params.plan) {
      qb.andWhere('b.subscription_plan = :plan', { plan: params.plan });
    }

    const total = await qb.getCount();

    qb.orderBy('b.created_at', 'DESC')
      .skip((params.page - 1) * params.per_page)
      .take(params.per_page);

    const businesses = await qb.getMany();

    const businessIds = businesses.map(b => b.id);

    const branchCounts: Record<string, number> = {};
    if (businessIds.length > 0) {
      const counts = await this.branchRepo
        .createQueryBuilder('br')
        .select('br.business_id', 'business_id')
        .addSelect('COUNT(br.id)', 'count')
        .where('br.business_id IN (:...ids)', { ids: businessIds })
        .groupBy('br.business_id')
        .getRawMany();
      for (const c of counts) {
        branchCounts[c.business_id] = Number(c.count);
      }
    }

    const owners = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.full_name', 'u.email'])
      .where('u.role = :role AND u.business_id IN (:...ids)', {
        role: UserRole.OWNER,
        ids: businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'],
      })
      .getMany();
    const ownerMap: Record<string, User> = {};
    for (const o of owners) {
      ownerMap[o.business_id] = o;
    }

    const branchSubscriptionMap: Record<string, { status: string; plan: string | null; expires_at: string | null }> = {};
    if (businessIds.length > 0) {
      const branches = await this.branchRepo
        .createQueryBuilder('br')
        .select(['br.id', 'br.business_id'])
        .where('br.business_id IN (:...ids)', { ids: businessIds })
        .getMany();
      const branchIds = branches.map(br => br.id);
      if (branchIds.length > 0) {
        const subscriptions = await this.subscriptionRepo
          .createQueryBuilder('s')
          .leftJoinAndSelect('s.plan', 'p')
          .where('s.branch_id IN (:...branchIds)', { branchIds })
          .getMany();
        const branchToBusiness = new Map(branches.map(br => [br.id, br.business_id]));
        for (const sub of subscriptions) {
          const businessId = branchToBusiness.get(sub.branch_id);
          if (businessId) {
            branchSubscriptionMap[businessId] = {
              status: sub.status,
              plan: sub.plan?.name || 'free_trial',
              expires_at: sub.current_period_end ? sub.current_period_end.toISOString() : null,
            };
          }
        }
      }
    }

    return {
      data: businesses.map(b => {
        const sub = branchSubscriptionMap[b.id] || {};
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          type: b.type,
          email: b.email,
          phone: b.phone,
          is_active: b.is_active,
          subscription_plan: sub.plan || b.subscription_plan,
          subscription_status: sub.status || null,
          subscription_expires_at: sub.expires_at || null,
          owner_name: ownerMap[b.id]?.full_name || null,
          owner_email: ownerMap[b.id]?.email || null,
          branch_count: branchCounts[b.id] ?? 0,
          address: b.address,
          created_at: b.created_at,
        };
      }),
      total,
      page: params.page,
      per_page: params.per_page,
    };
  }

  async updateBusiness(id: string, dto: UpdateBusinessDto) {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (dto.name !== undefined) business.name = dto.name;
    if (dto.is_active !== undefined) business.is_active = dto.is_active;
    if (dto.subscription_plan !== undefined) business.subscription_plan = dto.subscription_plan;

    return this.businessRepo.save(business);
  }

  async extendBusinessSubscription(dto: { business_id: string; days?: number }) {
    const business = await this.businessRepo.findOne({ where: { id: dto.business_id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const branch = await this.branchRepo.findOne({ where: { business_id: dto.business_id, is_active: true } });
    if (!branch) {
      throw new NotFoundException('No active branch found for this business');
    }

    const days = dto.days ?? 30;
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let subscription = await this.subscriptionRepo.findOne({ where: { branch_id: branch.id } });

    if (subscription) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.current_period_start = new Date();
      subscription.current_period_end = periodEnd;
      subscription.trial_ends_at = null;
      subscription.grace_period_ends_at = null;
      subscription.canceled_at = null;
    } else {
      subscription = this.subscriptionRepo.create({
        branch_id: branch.id,
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: periodEnd,
      });
    }

    await this.subscriptionRepo.save(subscription);
    return { business_id: business.id, branch_id: branch.id, subscription };
  }
}

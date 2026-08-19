import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { Bill } from '../bill/entities/bill.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscription/entities/subscription.entity';
import { Plan } from '../subscription/entities/plan.entity';
import { UserRole } from '../../common/shared';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { PlatformPaymentProvider } from './entities/platform-payment-provider.entity';
import {
  CreatePlatformPaymentProviderDto,
  UpdatePlatformPaymentProviderDto,
} from './dto/platform-payment-provider.dto';
import { SyncQueue } from '../sync/sync.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ShiftTemplate } from '../shift/entities/shift-template.entity';
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
} from '../shift/dto/shift-template.dto';
import { BillingInterval } from '../subscription/entities/plan.entity';

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
    @InjectRepository(PlatformPaymentProvider)
    private paymentProviderRepo: Repository<PlatformPaymentProvider>,
    @InjectRepository(SyncQueue)
    private syncQueueRepo: Repository<SyncQueue>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(ShiftTemplate)
    private shiftTemplateRepo: Repository<ShiftTemplate>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getRevenue(params?: { months?: number }) {
    const months = Math.max(1, Math.min(24, params?.months || 12));
    const since = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - months + 1,
      1,
    );

    const subs = await this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.plan', 'p')
      .where('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .addSelect(['p.price', 'p.currency', 'p.billing_interval'])
      .getMany();

    const mrr: Record<string, number> = {};
    let recurring = 0;
    for (const sub of subs) {
      const plan = sub.plan;
      if (!plan) continue;
      const monthly =
        plan.billing_interval === BillingInterval.YEARLY
          ? plan.price / 12
          : plan.price;
      mrr[plan.currency] = (mrr[plan.currency] || 0) + monthly;
      recurring += 1;
    }
    const arr: Record<string, number> = {};
    for (const currency of Object.keys(mrr)) arr[currency] = mrr[currency] * 12;

    const revResult = await this.dataSource.query(
      `SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, SUM(total_kobo) AS total
       FROM bills WHERE paid_at IS NOT NULL AND paid_at >= $1
       GROUP BY 1 ORDER BY 1 ASC`,
      [since],
    );
    const bizResult = await this.dataSource.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*) AS total
       FROM businesses WHERE created_at >= $1
       GROUP BY 1 ORDER BY 1 ASC`,
      [since],
    );

    return {
      mrr,
      arr,
      recurring_subscribers: recurring,
      monthly_revenue: revResult.map((r: any) => ({
        month: r.month,
        revenue_kobo: Number(r.total) || 0,
      })),
      monthly_new_businesses: bizResult.map((r: any) => ({
        month: r.month,
        count: Number(r.total) || 0,
      })),
    };
  }

  async getSystemHealth() {
    let dbConnected = false;
    let dbLatencyMs: number | null = null;
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      dbLatencyMs = Date.now() - start;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const pendingSync = await this.syncQueueRepo.count({
      where: { status: 'pending' },
    });
    const failedSync = await this.syncQueueRepo.count({
      where: { status: 'failed' },
    });
    const totalSync = await this.syncQueueRepo.count();

    const mem = process.memoryUsage();
    const now = new Date();

    return {
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: now.toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      database: {
        connected: dbConnected,
        latency_ms: dbLatencyMs,
      },
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      process: {
        pid: process.pid,
        memory_used_mb: Math.round(mem.rss / 1024 / 1024),
        memory_heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        cpu_cores: require('os').cpus().length,
        load_avg: (require('os').loadavg() || [0, 0, 0]).slice(0, 3),
      },
      sync_queue: {
        total: totalSync,
        pending: pendingSync,
        failed: failedSync,
      },
    };
  }

  async getAuditLogs(params: {
    action?: string;
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    business_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const pageNum = Math.max(1, params.page || 1);
    const limitNum = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (pageNum - 1) * limitNum;

    const applyFilters = (qb: any) => {
      if (params.business_id)
        qb.andWhere('bus.id = :businessId', { businessId: params.business_id });
      if (params.action)
        qb.andWhere('a.action = :action', { action: params.action });
      if (params.user_id)
        qb.andWhere('a.user_id = :userId', { userId: params.user_id });
      if (params.entity_type)
        qb.andWhere('a.entity_type = :entityType', {
          entityType: params.entity_type,
        });
      if (params.entity_id)
        qb.andWhere('a.entity_id = :entityId', { entityId: params.entity_id });
      if (params.date_from || params.date_to) {
        const from = params.date_from
          ? new Date(params.date_from)
          : new Date('2000-01-01');
        const to = params.date_to ? new Date(params.date_to) : new Date();
        qb.andWhere('a.created_at = :range', { range: Between(from, to) });
      }
      return qb;
    };

    const countQb = applyFilters(
      this.auditLogRepo
        .createQueryBuilder('a')
        .leftJoin('branches', 'b', 'a.branch_id = b.id')
        .leftJoin('businesses', 'bus', 'b.business_id = bus.id')
        .leftJoin('users', 'u', 'a.user_id = u.id'),
    );
    const total = await countQb.getCount();

    const rowQb = applyFilters(
      this.auditLogRepo
        .createQueryBuilder('a')
        .leftJoin('branches', 'b', 'a.branch_id = b.id')
        .leftJoin('businesses', 'bus', 'b.business_id = bus.id')
        .leftJoin('users', 'u', 'a.user_id = u.id')
        .addSelect([
          'a.id',
          'a.branch_id',
          'a.user_id',
          'a.action',
          'a.entity_id',
          'a.entity_type',
          'a.payload',
          'a.created_at',
          'b.name as branch_name',
          'bus.name as business_name',
          'bus.currency as business_currency',
          'u.full_name as user_name',
          'u.email as user_email',
          'u.role as user_role',
        ])
        .orderBy('a.created_at', 'DESC')
        .skip(skip)
        .take(limitNum),
    );
    const rows = await rowQb.getRawMany();
    const data = rows.map((a: any) => ({
      id: a.a_id,
      branch_id: a.a_branch_id,
      branch_name: a.branch_name ?? null,
      user_id: a.a_user_id ?? null,
      user_name: a.user_name ?? null,
      user_email: a.user_email ?? null,
      user_role: a.user_role ?? null,
      business_name: a.business_name ?? null,
      business_currency: a.business_currency ?? null,
      action: a.a_action,
      entity_id: a.a_entity_id ?? null,
      entity_type: a.a_entity_type ?? null,
      payload: a.a_payload ?? null,
      created_at: a.a_created_at,
    }));
    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getStats() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalBusinesses = await this.businessRepo.count();
    const activeBusinesses = await this.businessRepo.count({
      where: { is_active: true },
    });
    const totalBranches = await this.branchRepo.count();
    const totalOwners = await this.userRepo.count({
      where: { role: UserRole.OWNER },
    });
    const totalManagers = await this.userRepo.count({
      where: { role: UserRole.MANAGER },
    });
    const totalWaiters = await this.userRepo.count({
      where: { role: UserRole.WAITER },
    });
    const totalCashiers = await this.userRepo.count({
      where: { role: UserRole.CASHIER },
    });

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
      .select("COALESCE(p.name, 'free_trial')", 'plan')
      .addSelect('COUNT(s.id)', 'count')
      .leftJoin('s.plan', 'p')
      .groupBy("COALESCE(p.name, 'free_trial')")
      .getRawMany();

    const totalSubscriptions = statusBreakdown.reduce(
      (sum, r) => sum + Number(r.count),
      0,
    );
    const activeSubscriptions = statusBreakdown
      .filter((r) => r.status === 'active' || r.status === 'trialing')
      .reduce((sum, r) => sum + Number(r.count), 0);
    const expiredSubscriptions = statusBreakdown
      .filter((r) => r.status === 'expired')
      .reduce((sum, r) => sum + Number(r.count), 0);
    const pastDueSubscriptions = statusBreakdown
      .filter((r) => r.status === 'past_due')
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
      subscription_trialing:
        statusBreakdown.find((r) => r.status === 'trialing')?.count || 0,
      subscription_canceled:
        statusBreakdown.find((r) => r.status === 'canceled')?.count || 0,
      subscription_breakdown: planBreakdown.map((r: any) => ({
        plan: r.plan || 'free_trial',
        count: Number(r.count),
      })),
      subscription_status_breakdown: statusBreakdown.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      recent_businesses: recentBusinesses.map((b) => ({
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
    const qb = this.businessRepo.createQueryBuilder('b');

    if (params.search) {
      qb.andWhere(
        '(b.name ILIKE :search OR b.email ILIKE :search OR b.slug ILIKE :search)',
        {
          search: `%${params.search}%`,
        },
      );
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

    const businessIds = businesses.map((b) => b.id);

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
        ids:
          businessIds.length > 0
            ? businessIds
            : ['00000000-0000-0000-0000-000000000000'],
      })
      .getMany();
    const ownerMap: Record<string, User> = {};
    for (const o of owners) {
      ownerMap[o.business_id] = o;
    }

    const branchSubscriptionMap: Record<
      string,
      { status: string; plan: string | null; expires_at: string | null }
    > = {};
    const branchesByBusiness: Record<string, { id: string; name: string }[]> =
      {};
    if (businessIds.length > 0) {
      const branches = await this.branchRepo
        .createQueryBuilder('br')
        .select(['br.id', 'br.name', 'br.business_id'])
        .where('br.business_id IN (:...ids)', { ids: businessIds })
        .getMany();
      for (const br of branches) {
        if (!branchesByBusiness[br.business_id])
          branchesByBusiness[br.business_id] = [];
        branchesByBusiness[br.business_id].push({ id: br.id, name: br.name });
      }
      const branchIds = branches.map((br) => br.id);
      if (branchIds.length > 0) {
        const subscriptions = await this.subscriptionRepo
          .createQueryBuilder('s')
          .leftJoinAndSelect('s.plan', 'p')
          .where('s.branch_id IN (:...branchIds)', { branchIds })
          .getMany();
        const branchToBusiness = new Map(
          branches.map((br) => [br.id, br.business_id]),
        );
        for (const sub of subscriptions) {
          const businessId = branchToBusiness.get(sub.branch_id);
          if (businessId) {
            branchSubscriptionMap[businessId] = {
              status: sub.status,
              plan: sub.plan?.name || 'free_trial',
              expires_at: sub.current_period_end
                ? sub.current_period_end.toISOString()
                : null,
            };
          }
        }
      }
    }

    return {
      data: businesses.map((b) => {
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
          branches: branchesByBusiness[b.id] || [],
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
    if (dto.subscription_plan !== undefined)
      business.subscription_plan = dto.subscription_plan;

    return this.businessRepo.save(business);
  }

  async extendBusinessSubscription(dto: {
    business_id: string;
    days?: number;
  }) {
    const business = await this.businessRepo.findOne({
      where: { id: dto.business_id },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const branch = await this.branchRepo.findOne({
      where: { business_id: dto.business_id, is_active: true },
    });
    if (!branch) {
      throw new NotFoundException('No active branch found for this business');
    }

    const days = dto.days ?? 30;
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let subscription = await this.subscriptionRepo.findOne({
      where: { branch_id: branch.id },
    });

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

  async listPaymentProviders(
    includeInactive = false,
  ): Promise<PlatformPaymentProvider[]> {
    return this.paymentProviderRepo.find({
      order: { label: 'ASC' },
      where: includeInactive ? undefined : { is_active: true },
    });
  }

  async createPaymentProvider(
    dto: CreatePlatformPaymentProviderDto,
  ): Promise<PlatformPaymentProvider> {
    const existing = await this.paymentProviderRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Payment provider "${dto.name}" already exists`,
      );
    }
    const provider = this.paymentProviderRepo.create({
      name: dto.name,
      label: dto.label,
      type: dto.type,
      verification_method: dto.verification_method ?? null,
      config: dto.config ?? {},
      is_active: dto.is_active ?? true,
    });
    return this.paymentProviderRepo.save(provider);
  }

  async updatePaymentProvider(
    id: string,
    dto: UpdatePlatformPaymentProviderDto,
  ): Promise<PlatformPaymentProvider> {
    const provider = await this.paymentProviderRepo.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Payment provider not found');
    }
    if (dto.label !== undefined) provider.label = dto.label;
    if (dto.type !== undefined) provider.type = dto.type;
    if (dto.verification_method !== undefined)
      provider.verification_method = dto.verification_method;
    if (dto.config !== undefined) provider.config = dto.config;
    if (dto.is_active !== undefined) provider.is_active = dto.is_active;
    return this.paymentProviderRepo.save(provider);
  }

  async removePaymentProvider(id: string): Promise<{ id: string }> {
    const provider = await this.paymentProviderRepo.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Payment provider not found');
    }
    await this.paymentProviderRepo.remove(provider);
    return { id };
  }

  // ===== Business Shift Templates (superadmin) =====

  private async requireBusiness(id: string): Promise<Business> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async listBusinessShiftTemplates(businessId: string) {
    await this.requireBusiness(businessId);
    return this.shiftTemplateRepo.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
  }

  async createBusinessShiftTemplate(
    businessId: string,
    dto: CreateShiftTemplateDto,
  ) {
    await this.requireBusiness(businessId);
    const branch = await this.branchRepo.findOne({
      where: { business_id: businessId, is_active: true },
      order: { created_at: 'ASC' },
    });
    if (!branch) {
      throw new NotFoundException(
        'No active branch found for this business. Create a branch first.',
      );
    }
    const template = this.shiftTemplateRepo.create({
      business_id: businessId,
      branch_id: branch.id,
      name: dto.name,
      type: dto.type,
      scheduled_start_time: dto.scheduled_start_time,
      scheduled_end_time: dto.scheduled_end_time,
      days_of_week: dto.days_of_week,
      color: dto.color || '#22c55e',
      is_active: true,
    });
    return this.shiftTemplateRepo.save(template);
  }

  async updateBusinessShiftTemplate(
    businessId: string,
    templateId: string,
    dto: UpdateShiftTemplateDto,
  ) {
    await this.requireBusiness(businessId);
    const template = await this.shiftTemplateRepo.findOne({
      where: { id: templateId, business_id: businessId },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found');
    }
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.type !== undefined) template.type = dto.type;
    if (dto.scheduled_start_time !== undefined)
      template.scheduled_start_time = dto.scheduled_start_time;
    if (dto.scheduled_end_time !== undefined)
      template.scheduled_end_time = dto.scheduled_end_time;
    if (dto.days_of_week !== undefined) template.days_of_week = dto.days_of_week;
    if (dto.color !== undefined) template.color = dto.color;
    if (dto.is_active !== undefined)
      template.is_active =
        dto.is_active === 1 || dto.is_active === (true as unknown as number);
    return this.shiftTemplateRepo.save(template);
  }

  async deleteBusinessShiftTemplate(businessId: string, templateId: string) {
    await this.requireBusiness(businessId);
    const template = await this.shiftTemplateRepo.findOne({
      where: { id: templateId, business_id: businessId },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found');
    }
    await this.shiftTemplateRepo.remove(template);
    return { success: true };
  }
}

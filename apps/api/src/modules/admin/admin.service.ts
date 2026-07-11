import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { Bill } from '../bill/entities/bill.entity';
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

    const planBreakdown = await this.businessRepo
      .createQueryBuilder('b')
      .select('b.subscription_plan', 'plan')
      .addSelect('COUNT(b.id)', 'count')
      .groupBy('b.subscription_plan')
      .getRawMany();

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
      subscription_breakdown: planBreakdown.map((r: any) => ({
        plan: r.plan || 'free_trial',
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

    return {
      data: businesses.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        type: b.type,
        email: b.email,
        phone: b.phone,
        is_active: b.is_active,
        subscription_plan: b.subscription_plan,
        owner_name: ownerMap[b.id]?.full_name || null,
        owner_email: ownerMap[b.id]?.email || null,
        branch_count: branchCounts[b.id] ?? 0,
        address: b.address,
        created_at: b.created_at,
      })),
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
}

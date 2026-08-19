import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { ShiftTemplate } from './entities/shift-template.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';

interface ShiftWithRelations extends Shift {
  template?: ShiftTemplate;
  assigned_staff?: { id: string; full_name: string; role: string }[];
}

export type { ShiftWithRelations };

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ShiftTemplate)
    private templateRepository: Repository<ShiftTemplate>,
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ===== Shift Templates =====

  async listTemplates(businessId: string) {
    return this.templateRepository.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
  }

  async getTemplate(id: string, businessId: string) {
    const template = await this.templateRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!template) throw new NotFoundException('Shift template not found');
    return template;
  }

  async createTemplate(
    businessId: string,
    branchId: string,
    dto: {
      name: string;
      type: string;
      scheduled_start_time: string;
      scheduled_end_time: string;
      days_of_week: number[];
      color?: string;
    },
  ) {
    const template = this.templateRepository.create({
      branch_id: branchId,
      business_id: businessId,
      name: dto.name,
      type: dto.type,
      scheduled_start_time: dto.scheduled_start_time,
      scheduled_end_time: dto.scheduled_end_time,
      days_of_week: dto.days_of_week,
      color: dto.color || '#22c55e',
      is_active: true,
    });
    return this.templateRepository.save(template);
  }

  async updateTemplate(
    id: string,
    businessId: string,
    dto: Partial<{
      name: string;
      type: string;
      scheduled_start_time: string;
      scheduled_end_time: string;
      days_of_week: number[];
      color: string;
      is_active?: boolean | number;
    }>,
  ) {
    const template = await this.getTemplate(id, businessId);
    const updates: Partial<ShiftTemplate> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.scheduled_start_time !== undefined)
      updates.scheduled_start_time = dto.scheduled_start_time;
    if (dto.scheduled_end_time !== undefined)
      updates.scheduled_end_time = dto.scheduled_end_time;
    if (dto.days_of_week !== undefined) updates.days_of_week = dto.days_of_week;
    if (dto.color !== undefined) updates.color = dto.color;
    if (dto.is_active !== undefined)
      updates.is_active = dto.is_active === 1 || dto.is_active === true;
    Object.assign(template, updates);
    return this.templateRepository.save(template);
  }

  async deleteTemplate(id: string, businessId: string) {
    const template = await this.getTemplate(id, businessId);
    await this.templateRepository.remove(template);
    return { success: true };
  }

  // ===== Shifts =====

  async findAll(
    branchId: string,
    dateFrom?: string,
    dateTo?: string,
    status?: string,
  ) {
    const query = this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.branch_id = :branchId', { branchId });

    if (dateFrom) {
      query.andWhere('shift.opened_at >= :dateFrom', {
        dateFrom: new Date(dateFrom),
      });
    }
    if (dateTo) {
      query.andWhere('shift.opened_at <= :dateTo', {
        dateTo: new Date(dateTo + 'T23:59:59.999'),
      });
    }
    if (status) {
      query.andWhere('shift.status = :status', { status });
    }

    const shifts = await query.orderBy('shift.opened_at', 'DESC').getMany();
    return Promise.all(shifts.map((s) => this.enrichShift(s)));
  }

  async findOne(id: string, branchId: string) {
    const shift = await this.shiftRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.enrichShift(shift);
  }

  async findCurrent(branchId: string) {
    const shift = await this.shiftRepository.findOne({
      where: { branch_id: branchId, status: 'open' },
    });
    return shift ? this.enrichShift(shift) : null;
  }

  async openShift(
    branchId: string,
    businessId: string,
    userId: string,
    dto: {
      starting_cash_kobo: number;
      note?: string;
      template_id?: string;
      scheduled_start_time?: string;
      scheduled_end_time?: string;
      assigned_staff_ids?: string[];
    },
  ) {
    const existing = await this.findCurrent(branchId);
    if (existing)
      throw new BadRequestException('A shift is already open for this branch');

    let shiftType = 'custom';
    let scheduledStartTime = dto.scheduled_start_time || '07:00';
    let scheduledEndTime = dto.scheduled_end_time || '15:00';

    if (dto.template_id) {
      const template = await this.templateRepository.findOne({
        where: {
          id: dto.template_id,
          business_id: businessId,
        },
      });
      if (template) {
        shiftType = template.type;
        scheduledStartTime = template.scheduled_start_time;
        scheduledEndTime = template.scheduled_end_time;
      }
    }

    const shift = this.shiftRepository.create({
      branch_id: branchId,
      opened_by: userId,
      starting_cash_kobo: dto.starting_cash_kobo,
      opened_at: new Date(),
      note: dto.note,
      status: 'open',
      template_id: dto.template_id || null,
      scheduled_start_time: scheduledStartTime,
      scheduled_end_time: scheduledEndTime,
      shift_type: shiftType,
      assigned_staff_ids: dto.assigned_staff_ids || [],
    });
    return this.enrichShift(await this.shiftRepository.save(shift));
  }

  async closeShift(
    id: string,
    branchId: string,
    userId: string,
    dto: { actual_cash_kobo: number; note?: string },
  ) {
    const shift = await this.findOne(id, branchId);
    if (shift.status !== 'open')
      throw new BadRequestException('Shift is already closed');

    const now = new Date();
    shift.closed_by = userId;
    shift.actual_cash_kobo = dto.actual_cash_kobo;
    shift.closed_at = now;
    shift.status = 'closed';
    shift.note = dto.note || shift.note;

    // Calculate expected cash from sales during shift
    const cashBills = await this.billRepository
      .createQueryBuilder('bill')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = bill.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId })
      .andWhere('bill.paid_at >= :from', { from: shift.opened_at })
      .andWhere('bill.paid_at <= :to', { to: now })
      .andWhere('bill.payment_method = :method', { method: 'cash' })
      .getMany();

    const cashSales = cashBills.reduce((sum, b) => sum + b.total_kobo, 0);
    shift.expected_cash_kobo = shift.starting_cash_kobo + cashSales;
    shift.variance_kobo = dto.actual_cash_kobo - shift.expected_cash_kobo;

    await this.branchRepository.increment(
      { id: branchId },
      'staff_token_version',
      1,
    );

    const saved = await this.shiftRepository.save(shift);
    const enriched = await this.enrichShift(saved);
    const varianceExplanation = this.buildVarianceExplanation(
      shift.starting_cash_kobo,
      shift.expected_cash_kobo,
      dto.actual_cash_kobo,
      shift.variance_kobo,
    );
    return { ...enriched, variance_explanation: varianceExplanation };
  }

  async getShiftReport(id: string, branchId: string) {
    const shift = await this.findOne(id, branchId);

    const bills = await this.billRepository
      .createQueryBuilder('bill')
      .innerJoin(Tab, 'tab', 'tab.id::varchar = bill.tab_id::varchar')
      .where('tab.branch_id::varchar = :branchId', { branchId })
      .andWhere('bill.paid_at IS NOT NULL')
      .andWhere('bill.paid_at >= :from', { from: shift.opened_at })
      .andWhere(
        'bill.paid_at <= :to',
        { to: shift.closed_at || new Date() },
      )
      .getMany();

    const totalRevenue = bills.reduce((sum, b) => sum + b.total_kobo, 0);
    const totalOrders = bills.length;

    const paymentBreakdown: Record<string, number> = {};
    for (const b of bills) {
      const method = b.payment_method || 'other';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + b.total_kobo;
    }

    // Staff performance grouped by who issued each bill
    const staffMap = new Map<
      string,
      { staffId: string; staffName: string; orders: number; revenue: number }
    >();
    const issuedByIds = [...new Set(bills.map((b) => b.issued_by))];
    const staffUsers =
      issuedByIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(issuedByIds) },
          })
        : [];
    const nameById = new Map(
      staffUsers.map((u) => [u.id, u.full_name || u.email]),
    );
    for (const b of bills) {
      const key = b.issued_by;
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          staffId: key,
          staffName: nameById.get(key) || key,
          orders: 0,
          revenue: 0,
        });
      }
      const entry = staffMap.get(key);
      if (!entry) continue;
      entry.orders += 1;
      entry.revenue += b.total_kobo;
    }

    return {
      shift,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      avg_ticket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      payment_breakdown: paymentBreakdown,
      staff_performance: [...staffMap.values()],
    };
  }

  async getShiftSummary(branchId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo
      ? new Date(dateTo)
      : new Date(new Date().setHours(23, 59, 59, 999));
    if (!dateFrom) from.setHours(0, 0, 0, 0);

    const shifts = await this.shiftRepository.find({
      where: { branch_id: branchId, opened_at: Between(from, to) },
      order: { opened_at: 'DESC' },
    });

    return {
      shifts,
      total_shifts: shifts.length,
      closed_shifts: shifts.filter((s) => s.status === 'closed').length,
      total_cash_sales: shifts
        .filter((s) => s.expected_cash_kobo)
        .reduce(
          (sum, s) => sum + (s.expected_cash_kobo - s.starting_cash_kobo),
          0,
        ),
      total_variance: shifts.reduce(
        (sum, s) => sum + (s.variance_kobo || 0),
        0,
      ),
    };
  }

  // ===== Helpers =====

  private async enrichShift(shift: Shift): Promise<ShiftWithRelations> {
    let template: ShiftTemplate | null | undefined;
    if (shift.template_id) {
      template = await this.templateRepository.findOne({
        where: { id: shift.template_id },
      });
    }

    let assignedStaff: { id: string; full_name: string; role: string }[] = [];
    if (shift.assigned_staff_ids?.length) {
      const users = await this.userRepository.find({
        where: { id: In(shift.assigned_staff_ids) },
      });
      assignedStaff = users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
      }));
    }

    const result: ShiftWithRelations = { ...shift };
    if (template) result.template = template;
    result.assigned_staff = assignedStaff;
    return result;
  }

  private buildVarianceExplanation(
    startingKobo: number,
    expectedKobo: number,
    actualKobo: number,
    varianceKobo: number,
  ): string {
    const starting = this.koboToNairaString(startingKobo);
    const expected = this.koboToNairaString(expectedKobo);
    const actual = this.koboToNairaString(actualKobo);

    if (varianceKobo === 0) {
      return `Started with ${starting}. Expected ${expected}. Actual matched exactly.`;
    }
    if (varianceKobo > 0) {
      const overAmount = this.koboToNairaString(varianceKobo);
      return `Started with ${starting}. Expected ${expected}. Actual ${actual} — ${overAmount} over.`;
    }
    const shortAmount = this.koboToNairaString(Math.abs(varianceKobo));
    return `Started with ${starting}. Expected ${expected}. Actual ${actual} — ${shortAmount} short.`;
  }

  private koboToNairaString(kobo: number): string {
    const naira = kobo / 100;
    const formatted = naira.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `₦${formatted}`;
  }
}
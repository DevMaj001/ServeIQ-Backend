import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
  ) {}

  async findAll(branchId: string) {
    const shifts = await this.shiftRepository.find({
      where: { branch_id: branchId },
      order: { opened_at: 'DESC' },
    });
    return shifts.map((s) => ({
      ...s,
      variance_explanation:
        s.variance_kobo !== null
          ? this.buildVarianceExplanation(
              s.starting_cash_kobo,
              s.expected_cash_kobo ?? 0,
              s.actual_cash_kobo ?? 0,
              s.variance_kobo,
            )
          : null,
    }));
  }

  async findOne(id: string, branchId: string) {
    const shift = await this.shiftRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async findCurrent(branchId: string) {
    return this.shiftRepository.findOne({
      where: { branch_id: branchId, status: 'open' },
    });
  }

  async openShift(
    branchId: string,
    userId: string,
    dto: { starting_cash_kobo: number; note?: string },
  ) {
    const existing = await this.findCurrent(branchId);
    if (existing)
      throw new BadRequestException('A shift is already open for this branch');

    const shift = this.shiftRepository.create({
      branch_id: branchId,
      opened_by: userId,
      starting_cash_kobo: dto.starting_cash_kobo,
      opened_at: new Date(),
      note: dto.note,
      status: 'open',
    });
    return this.shiftRepository.save(shift);
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
    const varianceExplanation = this.buildVarianceExplanation(
      shift.starting_cash_kobo,
      shift.expected_cash_kobo,
      dto.actual_cash_kobo,
      shift.variance_kobo,
    );
    return { ...saved, variance_explanation: varianceExplanation };
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

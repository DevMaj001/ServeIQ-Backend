import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, IsNull, LessThan, MoreThan, Or, DataSource } from 'typeorm';
import { Reservation, ReservationStatus, ReservationSource } from './entities/reservation.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Table, TableStatus } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Shift } from '../shift/entities/shift.entity';
import { getReservationConfig, getAvailableSlots, ReservationConfig } from './reservation-config';
import { CreateReservationDto, UpdateReservationDto, ReservationQueryDto, AvailabilityQueryDto, WalkinReservationDto } from './dto/reservation.dto';
import { RealtimeService } from '../gateway/realtime.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { TabType } from '../../common/shared';

export interface ReservationView {
  id: string;
  business_id: string;
  branch_id: string;
  table_id: string | null;
  table_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  party_size: number;
  reservation_time: Date;
  duration_minutes: number;
  end_time: Date;
  status: ReservationStatus;
  special_requests: string | null;
  source: ReservationSource;
  confirmation_code: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepo: Repository<Reservation>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Table)
    private tableRepo: Repository<Table>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    private dataSource: DataSource,
    private realtimeService: RealtimeService,
    private notificationService: NotificationService,
  ) {}

  private generateConfirmationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async validateBranchConfig(
    branchId: string,
    options?: { requireEnabled?: boolean },
  ): Promise<{ branch: Branch; config: ReservationConfig }> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const config = getReservationConfig(branch);
    if ((options?.requireEnabled ?? true) && !config.enabled) {
      throw new BadRequestException('Reservations are not enabled for this branch');
    }
    return { branch, config };
  }

  private async getOpenShift(branchId: string): Promise<Shift | null> {
    const now = new Date();
    return this.shiftRepo.findOne({
      where: { branch_id: branchId, status: 'open', opened_at: LessThan(now) },
      order: { opened_at: 'DESC' },
    });
  }

  private async createTabFromReservation(reservation: Reservation, shift: Shift | null): Promise<Tab> {
    const tabNumber = `TAB-${Date.now()}`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tab = this.tabRepo.create({
        branch_id: reservation.branch_id,
        table_id: reservation.table_id!,
        shift_id: shift?.id ?? null,
        tab_type: TabType.DINE_IN,
        status: 'open',
        opened_at: new Date(),
        tab_number: tabNumber,
        customer_name: reservation.customer_name,
        party_size: reservation.party_size,
        reservation_id: reservation.id,
      });
      const savedTab = await queryRunner.manager.save(tab) as Tab;

      // Update table status
      await queryRunner.manager.update(Table, reservation.table_id!, {
        status: TableStatus.OCCUPIED,
      });

      await queryRunner.commitTransaction();
      return savedTab;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkAvailability(
    branchId: string,
    reservationTime: Date,
    durationMinutes: number,
    partySize: number,
    excludeReservationId?: string,
  ): Promise<{ table: Table; availableTables: string[] } | null> {
    const { config } = await this.validateBranchConfig(branchId);

    const slotStart = new Date(reservationTime);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    // Check if within operating hours
    const [openH, openM] = config.opening_time.split(':').map(Number);
    const [closeH, closeM] = config.closing_time.split(':').map(Number);
    const dayStart = new Date(slotStart);
    dayStart.setHours(openH, openM, 0, 0);
    const dayEnd = new Date(slotStart);
    dayEnd.setHours(closeH, closeM, 0, 0);
    if (slotStart < dayStart || slotEnd > dayEnd) {
      throw new BadRequestException('Reservation time is outside operating hours');
    }

    // Get all tables that can accommodate party size
    let usableTables = await this.tableRepo.find({
      where: { branch_id: branchId, capacity: partySize },
    });
    if (usableTables.length === 0) {
      // No exact-capacity tables — fall back to larger tables
      const largerTables = await this.tableRepo.find({
        where: { branch_id: branchId },
      });
      usableTables = largerTables.filter((t) => t.capacity > partySize);
      if (usableTables.length === 0) throw new BadRequestException('No tables available for this party size');
    }

    // Get existing reservations that overlap with this slot
    const existing = await this.reservationRepo.find({
      where: {
        branch_id: branchId,
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED]),
        reservation_time: LessThan(slotEnd),
      },
    });
    const overlapping = existing.filter(
      (r) =>
        r.id !== excludeReservationId &&
        new Date(r.reservation_time).getTime() + r.duration_minutes * 60 * 1000 > slotStart.getTime(),
    );

    // Find first available table
    for (const table of usableTables) {
      const conflict = overlapping.some(
        (r) => r.table_id === table.id,
      );
      if (!conflict) {
        return { table, availableTables: [table.id] };
      }
    }

    return null;
  }

  async create(dto: CreateReservationDto, branchId: string): Promise<ReservationView> {
    const { config } = await this.validateBranchConfig(branchId);

    if (!config.allow_online && (dto.source ?? ReservationSource.PUBLIC) === ReservationSource.PUBLIC) {
      throw new BadRequestException('Online reservations are not enabled for this branch');
    }

    const reservationTime = new Date(dto.reservation_time);
    const duration = dto.duration_minutes ?? config.default_duration_minutes;
    const now = new Date();

    // Validate advance booking window
    const maxAdvance = new Date(now.getTime() + config.advance_days * 24 * 60 * 60 * 1000);
    if (reservationTime > maxAdvance) {
      throw new BadRequestException(`Cannot book more than ${config.advance_days} days in advance`);
    }
    if (reservationTime < now) {
      throw new BadRequestException('Cannot book in the past');
    }

    // Validate party size
    if (dto.party_size < config.min_party_size || dto.party_size > config.max_party_size) {
      throw new BadRequestException(`Party size must be between ${config.min_party_size} and ${config.max_party_size}`);
    }

    // Check availability and assign table
    const availability = await this.checkAvailability(branchId, reservationTime, duration, dto.party_size);
    if (!availability) {
      throw new ConflictException('No tables available for the requested time and party size');
    }

    const confirmationCode = this.generateConfirmationCode();
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const initialStatus = config.auto_confirm ? ReservationStatus.CONFIRMED : ReservationStatus.PENDING;

    const reservation = this.reservationRepo.create({
      business_id: branch.business_id,
      branch_id: branchId,
      table_id: availability.table.id,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      customer_email: dto.customer_email ?? null,
      party_size: dto.party_size,
      reservation_time: reservationTime,
      duration_minutes: duration,
      status: initialStatus,
      special_requests: dto.special_requests ?? null,
      source: dto.source ?? ReservationSource.PUBLIC,
      confirmation_code: confirmationCode,
    });

    const saved = await this.reservationRepo.save(reservation);
    await this.emitReservationUpdate(branchId, saved);
    return this.toView(saved, availability.table);
  }

  async createWalkin(dto: WalkinReservationDto, branchId: string, userId: string): Promise<ReservationView> {
    const { config } = await this.validateBranchConfig(branchId, { requireEnabled: false });

    const now = new Date();
    const duration = dto.duration_minutes ?? config.default_duration_minutes;

    // For walk-in, try to assign specific table or find any available
    let table: Table | null = null;
    if (dto.table_id) {
      table = await this.tableRepo.findOne({ where: { id: dto.table_id, branch_id: branchId } });
      if (!table) throw new NotFoundException('Table not found');
      if (table.capacity < dto.party_size) throw new BadRequestException('Table too small for party size');
    }

    const slotStart = now;
    const slotEnd = new Date(now.getTime() + duration * 60 * 1000);

    // Check for conflicts
    const existing = await this.reservationRepo.find({
      where: {
        branch_id: branchId,
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED]),
        reservation_time: LessThan(slotEnd),
      },
    });
    const overlapping = existing.filter(
      (r) => new Date(r.reservation_time).getTime() + r.duration_minutes * 60 * 1000 > slotStart.getTime(),
    );

    if (table) {
      const conflict = overlapping.some((r) => r.table_id === table!.id);
      if (conflict) throw new ConflictException('Table is not available right now');
    } else {
      // Find any available table
      const suitableTables = await this.tableRepo.find({
        where: { branch_id: branchId },
      });
      const suitable = suitableTables.filter((t) => t.capacity >= dto.party_size);
      for (const t of suitable) {
        if (!overlapping.some((r) => r.table_id === t.id)) {
          table = t;
          break;
        }
      }
      if (!table) throw new ConflictException('No tables available for walk-in');
    }

    const confirmationCode = this.generateConfirmationCode();
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const reservation = this.reservationRepo.create({
      business_id: branch.business_id,
      branch_id: branchId,
      table_id: table.id,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      customer_email: dto.customer_email ?? null,
      party_size: dto.party_size,
      reservation_time: now,
      duration_minutes: duration,
      status: ReservationStatus.SEATED, // Walk-ins are immediately seated
      special_requests: dto.special_requests ?? null,
      source: ReservationSource.WALKIN,
      confirmation_code: confirmationCode,
      seated_at: now,
    });

    const saved = await this.reservationRepo.save(reservation);

    // Auto-create a tab for the seated walk-in
    const shift = await this.getOpenShift(branchId);
    await this.createTabFromReservation(saved, shift);

    await this.emitReservationUpdate(branchId, saved);
    return this.toView(saved, table);
  }

  async checkAvailabilitySlots(query: AvailabilityQueryDto): Promise<{
    date: string;
    slots: { start: string; end: string; availableTables: number }[];
  }> {
    const branchId = query.branch_id;
    if (!branchId) throw new BadRequestException('Branch ID required');
    const { branch, config } = await this.validateBranchConfig(branchId);
    const date = new Date(query.date);
    date.setHours(0, 0, 0, 0);

    // Get all tables for branch
    const tables = await this.tableRepo.find({ where: { branch_id: branch.id } });

    // Get existing reservations for the day
    const dayStart = new Date(date);
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const existing = await this.reservationRepo.find({
      where: {
        branch_id: branch.id,
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED]),
        reservation_time: Between(dayStart, dayEnd),
      },
    });

    const slots = getAvailableSlots(config, date, existing, tables, query.party_size);
    return {
      date: query.date,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        availableTables: s.availableTables.length,
      })),
    };
  }

  async findAll(query: ReservationQueryDto, user: { businessId: string; branchId: string; role: string }): Promise<ReservationView[]> {
    const branchId = query.branch_id || user.branchId;
    if (user.role !== 'super_admin' && branchId !== user.branchId) {
      throw new ForbiddenException('Cannot access other branches');
    }

    const where: any = { branch_id: branchId };
    if (query.table_id) where.table_id = query.table_id;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.reservation_time = {};
      if (query.from) where.reservation_time = { ...where.reservation_time, ...{ gte: new Date(query.from) } };
      if (query.to) where.reservation_time = { ...where.reservation_time, ...{ lte: new Date(query.to) } };
    }

    const reservations = await this.reservationRepo.find({
      where,
      order: { reservation_time: 'DESC' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });

    const tableIds = [...new Set(reservations.map((r) => r.table_id).filter(Boolean))];
    const tables = tableIds.length ? await this.tableRepo.findBy({ id: In(tableIds) }) : [];
    const tableMap = new Map<string, Table>(tables.map((t) => [t.id, t]));

    const views: ReservationView[] = [];
    for (const r of reservations) {
      const table = r.table_id ? tableMap.get(r.table_id) ?? null : null;
      views.push(await this.toView(r, table as Table | null));
    }
    return views;
  }

  async findById(id: string, businessId: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { id, business_id: businessId } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const table = reservation.table_id ? await this.tableRepo.findOne({ where: { id: reservation.table_id } }) : null;
    return this.toView(reservation, table);
  }

  async findByConfirmationCode(code: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { confirmation_code: code.toUpperCase() } });
    if (!reservation) throw new NotFoundException('Invalid confirmation code');
    const table = reservation.table_id ? await this.tableRepo.findOne({ where: { id: reservation.table_id } }) : null;
    return this.toView(reservation, table);
  }

  async update(id: string, businessId: string, dto: UpdateReservationDto, userId: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { id, business_id: businessId } });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const { config } = await this.validateBranchConfig(reservation.branch_id);

    // If changing time/party/table, re-check availability
    if (dto.reservation_time || dto.party_size || dto.duration_minutes) {
      const newTime = dto.reservation_time ? new Date(dto.reservation_time) : reservation.reservation_time;
      const newDuration = dto.duration_minutes ?? reservation.duration_minutes;
      const newPartySize = dto.party_size ?? reservation.party_size;

      const maxAdvance = new Date(new Date().getTime() + config.advance_days * 24 * 60 * 60 * 1000);
      if (newTime > maxAdvance) throw new BadRequestException(`Cannot book more than ${config.advance_days} days in advance`);
      if (newPartySize < config.min_party_size || newPartySize > config.max_party_size) {
        throw new BadRequestException(`Party size must be between ${config.min_party_size} and ${config.max_party_size}`);
      }

      const availability = await this.checkAvailability(
        reservation.branch_id,
        newTime,
        newDuration,
        newPartySize,
        id,
      );
      if (!availability) throw new ConflictException('No tables available for the new time/party size');
      reservation.table_id = availability.table.id;
    }

    if (dto.customer_name) reservation.customer_name = dto.customer_name;
    if (dto.customer_phone) reservation.customer_phone = dto.customer_phone;
    if (dto.customer_email !== undefined) reservation.customer_email = dto.customer_email;
    if (dto.party_size) reservation.party_size = dto.party_size;
    if (dto.reservation_time) reservation.reservation_time = new Date(dto.reservation_time);
    if (dto.duration_minutes) reservation.duration_minutes = dto.duration_minutes;
    if (dto.special_requests !== undefined) reservation.special_requests = dto.special_requests;

    if (dto.status && dto.status !== reservation.status) {
      const oldStatus = reservation.status;
      reservation.status = dto.status;
      const now = new Date();

      if (dto.status === ReservationStatus.CANCELLED) {
        if (!dto.cancellation_reason) throw new BadRequestException('Cancellation reason required');
        reservation.cancelled_at = now;
        reservation.cancelled_by = userId;
        reservation.cancellation_reason = dto.cancellation_reason;
      } else if (dto.status === ReservationStatus.CONFIRMED && oldStatus === ReservationStatus.PENDING) {
        // Confirmed
      } else if (dto.status === ReservationStatus.SEATED) {
        reservation.seated_at = now;
        // Auto-create tab
        const existingTab = await this.tabRepo.findOne({ where: { reservation_id: reservation.id } });
        if (!existingTab) {
          const shift = await this.getOpenShift(reservation.branch_id);
          await this.createTabFromReservation(reservation, shift);
        }
      } else if (dto.status === ReservationStatus.COMPLETED) {
        reservation.completed_at = now;
      } else if (dto.status === ReservationStatus.NO_SHOW) {
        reservation.completed_at = now;
      }
    }

    const saved = await this.reservationRepo.save(reservation);
    await this.emitReservationUpdate(reservation.branch_id, saved);
    return this.toView(saved, null);
  }

  async confirmByCode(code: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { confirmation_code: code.toUpperCase() } });
    if (!reservation) throw new NotFoundException('Invalid confirmation code');
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(`Reservation is already ${reservation.status}`);
    }
    reservation.status = ReservationStatus.CONFIRMED;
    const saved = await this.reservationRepo.save(reservation);
    await this.emitReservationUpdate(reservation.branch_id, saved);
    return this.toView(saved, null);
  }

  async cancelByCode(code: string, reason: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { confirmation_code: code.toUpperCase() } });
    if (!reservation) throw new NotFoundException('Invalid confirmation code');
    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      throw new BadRequestException(`Cannot cancel ${reservation.status} reservation`);
    }
    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancelled_at = new Date();
    reservation.cancellation_reason = reason;
    const saved = await this.reservationRepo.save(reservation);
    await this.emitReservationUpdate(reservation.branch_id, saved);
    return this.toView(saved, null);
  }

  async seatWalkin(reservationId: string, branchId: string): Promise<ReservationView> {
    const reservation = await this.reservationRepo.findOne({ where: { id: reservationId, branch_id: branchId } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== ReservationStatus.CONFIRMED && reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only pending/confirmed reservations can be seated');
    }
    reservation.status = ReservationStatus.SEATED;
    reservation.seated_at = new Date();
    const saved = await this.reservationRepo.save(reservation);

    // Create tab
    const existingTab = await this.tabRepo.findOne({ where: { reservation_id: reservation.id } });
    if (!existingTab) {
      const shift = await this.getOpenShift(branchId);
      await this.createTabFromReservation(saved, shift);
    }

    await this.emitReservationUpdate(branchId, saved);
    return this.toView(saved, null);
  }

  async getTodaySummary(branchId: string): Promise<{
    upcoming: number;
    seated: number;
    completed: number;
    pending: number;
    walkins: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const reservations = await this.reservationRepo.find({
      where: { branch_id: branchId, reservation_time: Between(today, tomorrow) },
    });

    return {
      upcoming: reservations.filter((r) => r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.PENDING).length,
      seated: reservations.filter((r) => r.status === ReservationStatus.SEATED).length,
      completed: reservations.filter((r) => r.status === ReservationStatus.COMPLETED).length,
      pending: reservations.filter((r) => r.status === ReservationStatus.PENDING).length,
      walkins: reservations.filter((r) => r.source === ReservationSource.WALKIN).length,
    };
  }

  async sendReminders(): Promise<number> {
    const configReminderWindow = 60; // minutes
    const reminderWindow = new Date(Date.now() + configReminderWindow * 60 * 1000);
    const now = new Date();

    const due = await this.reservationRepo.find({
      where: {
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
        reminded_at: IsNull(),
        reservation_time: Between(now, reminderWindow),
      },
    });

    let sent = 0;
    for (const r of due) {
      try {
        await this.notificationService.create({
          branch_id: r.branch_id,
          user_id: null, // customer notification - would need customer notification system
          type: NotificationType.RESERVATION_REMINDER,
          title: 'Reservation Reminder',
          message: `Your reservation for ${r.party_size} at ${r.reservation_time.toLocaleTimeString()} is coming up`,
          data: { reservation_id: r.id, confirmation_code: r.confirmation_code },
        });
        r.reminded_at = new Date();
        await this.reservationRepo.save(r);
        sent++;
      } catch {
        // ignore individual failures
      }
    }
    return sent;
  }

  private async emitReservationUpdate(branchId: string, reservation: Reservation): Promise<void> {
    const view = await this.toView(reservation, null);
    this.realtimeService.emitReservationUpdate(branchId, view);
  }

  private async toView(reservation: Reservation, table: Table | null): Promise<ReservationView> {
    return {
      id: reservation.id,
      business_id: reservation.business_id,
      branch_id: reservation.branch_id,
      table_id: reservation.table_id,
      table_number: table?.table_number ?? null,
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      customer_email: reservation.customer_email,
      party_size: reservation.party_size,
      reservation_time: reservation.reservation_time,
      duration_minutes: reservation.duration_minutes,
      end_time: reservation.end_time,
      status: reservation.status,
      special_requests: reservation.special_requests,
      source: reservation.source,
      confirmation_code: reservation.confirmation_code,
      created_at: reservation.created_at,
      updated_at: reservation.updated_at,
    };
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { WaiterCall, WaiterCallStatus } from './entities/waiter-call.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Tab } from '../tab/entities/tab.entity';
import { RealtimeService } from '../gateway/realtime.service';

@Injectable()
export class WaiterCallService {
  private readonly logger = new Logger(WaiterCallService.name);
  private readonly MAX_WAITER_CAPACITY = 5;

  constructor(
    @InjectRepository(WaiterCall)
    private readonly waiterCallRepository: Repository<WaiterCall>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Tab)
    private readonly tabRepository: Repository<Tab>,
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Read the per-branch setting; fall back to the hard default of 5. */
  private async getMaxTablesPerWaiter(branchId?: string): Promise<number> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    const setting = branch?.settings?.max_tables_per_waiter;
    if (!setting) {
      return this.MAX_WAITER_CAPACITY;
    }
    const val = parseInt(String(setting), 10);
    return Number.isInteger(val) && val > 0 ? val : this.MAX_WAITER_CAPACITY;
  }

  /** Count active (open) tabs assigned to a waiter in a branch. */
  private async countActiveTablesForWaiter(
    branchId: string | undefined,
    waiterId: string,
  ): Promise<number> {
    return this.tabRepository.count({
      where: {
        branch_id: branchId,
        waiter_id: waiterId,
        status: 'open',
        deleted_at: null,
      } as any,
    });
  }

  /** Get eligible waiters for a branch, sorted by lowest active table count. */
  async getEligibleWaiters(
    branchId: string,
  ): Promise<{ user: User; activeTableCount: number }[]> {
    const waiters = await this.userRepository.find({
      where: {
        branch_id: branchId,
        role: 'waiter',
        is_active: true,
      } as any,
    });

    const eligible: { user: User; activeTableCount: number }[] = [];
    for (const waiter of waiters) {
      const activeTableCount = await this.countActiveTablesForWaiter(
        branchId,
        waiter.id,
      );
      eligible.push({ user: waiter, activeTableCount });
    }

    // Exclude waiters at/over capacity and sort ascending by active tables.
    const max = await this.getMaxTablesPerWaiter(branchId);
    const underCapacity = eligible.filter((w) => w.activeTableCount < max);
    underCapacity.sort((a, b) => a.activeTableCount - b.activeTableCount);
    return underCapacity;
  }

  /** Create a waiter call for a table. Concurrency-safe via transaction. */
  async createWaiterCall(
    tableId: string,
    branchId: string,
    customerSessionId?: string,
  ): Promise<{
    waiterCall: WaiterCall;
    assignedWaiter: User | null;
    status: WaiterCallStatus;
    message: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const table = await this.tableRepository.findOne({
        where: { id: tableId, branch_id: branchId, status: 'available' } as any,
      });
      if (!table) {
        await queryRunner.rollbackTransaction();
        throw new Error('Table not found or not available in this branch');
      }

      const existingActive = await this.waiterCallRepository.findOne({
        where: {
          table_id: tableId,
          status: In([WaiterCallStatus.PENDING, WaiterCallStatus.QUEUED]),
          deleted_at: null,
        } as any,
        order: { created_at: 'ASC' },
      });
      if (existingActive) {
        await queryRunner.rollbackTransaction();
        throw new Error('This table already has an active waiter request');
      }

      const eligible = await this.getEligibleWaiters(branchId);
      if (eligible.length === 0) {
        const waiterCall = this.waiterCallRepository.create({
          branch_id: branchId,
          table_id: tableId,
          customer_session_id: customerSessionId,
          status: WaiterCallStatus.QUEUED,
          reason: 'All waiters are currently at maximum capacity',
        });
        const saved = await this.waiterCallRepository.save(waiterCall);
        await queryRunner.commitTransaction();
        this.realtimeService.emitWaiterCall(branchId, 'waiter.request.queued', {
          id: saved.id,
          tableId,
          status: saved.status,
        });
        return {
          waiterCall: saved,
          assignedWaiter: null,
          status: WaiterCallStatus.QUEUED,
          message:
            'All waiters are currently assisting other guests. Your request has been queued.',
        };
      }

      const selectedWaiter = eligible[0].user;
      const waiterCall = this.waiterCallRepository.create({
        branch_id: branchId,
        table_id: tableId,
        assigned_waiter_id: selectedWaiter.id,
        customer_session_id: customerSessionId,
        status: WaiterCallStatus.PENDING,
      });
      const savedWaiterCall = await this.waiterCallRepository.save(waiterCall);

      await queryRunner.commitTransaction();
      this.realtimeService.emitWaiterCall(branchId, 'waiter.request.created', {
        id: savedWaiterCall.id,
        tableId,
        status: savedWaiterCall.status,
        assignedWaiterId: selectedWaiter.id,
      });
      this.realtimeService.emitWaiterCall(branchId, 'waiter.request.assigned', {
        id: savedWaiterCall.id,
        tableId,
        status: savedWaiterCall.status,
        assignedWaiterId: selectedWaiter.id,
      });
      this.logger.log(
        `Waiter call created: table=${tableId}, assigned=${selectedWaiter.id}, status=PENDING`,
      );

      return {
        waiterCall: savedWaiterCall,
        assignedWaiter: selectedWaiter,
        status: WaiterCallStatus.PENDING,
        message: 'A waiter has been notified.',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  async acceptWaiterCall(
    waiterCallId: string,
    waiterId: string,
  ): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null } as any,
    });
    if (!call) throw new Error('Waiter call not found');
    if (call.assigned_waiter_id !== waiterId) {
      throw new Error('This waiter call is not assigned to you');
    }
    if (call.status !== WaiterCallStatus.PENDING) {
      throw new Error('This request is no longer in pending state');
    }
    call.status = WaiterCallStatus.ACCEPTED;
    call.accepted_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(call.branch_id, 'waiter.request.accepted', {
      id: saved.id,
      tableId: saved.table_id,
      status: saved.status,
      assignedWaiterId: saved.assigned_waiter_id,
    });
    return saved;
  }

  async markArrived(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null } as any,
    });
    if (!call) throw new Error('Waiter call not found');
    call.status = WaiterCallStatus.ARRIVED;
    call.arrived_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(call.branch_id, 'waiter.request.arrived', {
      id: saved.id,
      tableId: saved.table_id,
      status: saved.status,
      assignedWaiterId: saved.assigned_waiter_id,
    });
    return saved;
  }

  async resolveWaiterCall(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null } as any,
    });
    if (!call) throw new Error('Waiter call not found');
    call.status = WaiterCallStatus.RESOLVED;
    call.resolved_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(call.branch_id, 'waiter.request.resolved', {
      id: saved.id,
      tableId: saved.table_id,
      status: saved.status,
      assignedWaiterId: saved.assigned_waiter_id,
    });
    return saved;
  }

  async cancelWaiterCall(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null } as any,
    });
    if (!call) throw new Error('Waiter call not found');
    call.status = WaiterCallStatus.CANCELLED;
    call.cancelled_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(call.branch_id, 'waiter.request.cancelled', {
      id: saved.id,
      tableId: saved.table_id,
      status: saved.status,
      assignedWaiterId: saved.assigned_waiter_id,
    });
    return saved;
  }

  async getWaiterWorkload(
    waiterId: string,
    branchId?: string,
  ): Promise<{ activeTables: number; maxTables: number; isAvailable: boolean }> {
    const activeTables = await this.countActiveTablesForWaiter(branchId, waiterId);
    const maxTables = await this.getMaxTablesPerWaiter(branchId);
    return {
      activeTables,
      maxTables,
      isAvailable: activeTables < maxTables,
    };
  }

  async getActiveWaiterCalls(branchId?: string): Promise<WaiterCall[]> {
    return this.waiterCallRepository.find({
      where: {
        branch_id: branchId,
        status: In([
          WaiterCallStatus.PENDING,
          WaiterCallStatus.ACCEPTED,
          WaiterCallStatus.ARRIVED,
        ]),
        deleted_at: null,
      } as any,
      order: { created_at: 'ASC' },
    });
  }

  async getQueuedCalls(branchId?: string): Promise<WaiterCall[]> {
    return this.waiterCallRepository.find({
      where: {
        branch_id: branchId,
        status: WaiterCallStatus.QUEUED,
        deleted_at: null,
      } as any,
      order: { created_at: 'ASC' },
    });
  }

  async getCallById(id: string): Promise<WaiterCall | null> {
    return this.waiterCallRepository.findOne({
      where: { id, deleted_at: null } as any,
    });
  }

  async getCallsByTable(tableId: string): Promise<WaiterCall | null> {
    return this.waiterCallRepository.findOne({
      where: { table_id: tableId, deleted_at: null } as any,
      order: { created_at: 'DESC' },
    });
  }

  async getMyCalls(
    waiterId: string,
    status?: WaiterCallStatus,
    branchId?: string,
  ): Promise<WaiterCall[]> {
    const where: any = { assigned_waiter_id: waiterId, deleted_at: null };
    if (status) where.status = status;
    if (branchId) where.branch_id = branchId;
    return this.waiterCallRepository.find({
      where,
      order: { created_at: 'ASC' },
    });
  }

  async processQueueWhenAvailable(
    branchId: string,
  ): Promise<{ waiterCall: WaiterCall; assignedWaiter: User } | null> {
    const queued = await this.getQueuedCalls(branchId);
    if (queued.length === 0) return null;

    const oldest = queued[0];
    const eligible = await this.getEligibleWaiters(branchId);
    if (eligible.length === 0) return null;

    const oldestCall = await this.getCallById(oldest.id);
    if (!oldestCall) return null;

    const leastLoaded = eligible[0];
    oldestCall.assigned_waiter_id = leastLoaded.user.id;
    oldestCall.status = WaiterCallStatus.PENDING;
    oldestCall.accepted_at = new Date();
    const saved = await this.waiterCallRepository.save(oldestCall);
    this.realtimeService.emitWaiterCall(branchId, 'waiter.request.assigned', {
      id: saved.id,
      tableId: saved.table_id,
      status: saved.status,
      assignedWaiterId: saved.assigned_waiter_id,
    });

    return {
      waiterCall: saved,
      assignedWaiter: leastLoaded.user,
    };
  }
}

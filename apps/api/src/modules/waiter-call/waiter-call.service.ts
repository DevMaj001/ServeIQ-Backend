import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { WaiterCall, WaiterCallStatus } from './entities/waiter-call.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Tab } from '../tab/entities/tab.entity';
import { RealtimeService } from '../gateway/realtime.service';
import { TableStatus, UserRole } from '../../common/shared';

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
    const table = await this.tableRepository.findOne({
      where: {
        id: tableId,
        branch_id: branchId,
        status: In([TableStatus.AVAILABLE, TableStatus.OCCUPIED]),
      } as any,
    });
    if (!table) {
      throw new NotFoundException('Table not found in this branch');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingActive = await queryRunner.manager.findOne(WaiterCall, {
        where: {
          table_id: tableId,
          status: In([WaiterCallStatus.PENDING, WaiterCallStatus.QUEUED]),
          deleted_at: null,
        } as any,
        order: { created_at: 'ASC' },
      });
      if (existingActive) {
        await queryRunner.rollbackTransaction().catch(() => undefined);
        throw new BadRequestException(
          'This table already has an active waiter request',
        );
      }

      // Broadcast model: create the call unassigned so every waiter in the
      // branch sees it, and the first waiter to accept claims it (like a ride
      // request). Capacity is enforced at accept time, not here.
      const waiterCall = queryRunner.manager.create(WaiterCall, {
        branch_id: branchId,
        table_id: tableId,
        customer_session_id: customerSessionId,
        assigned_waiter_id: null,
        status: WaiterCallStatus.PENDING,
      });
      const savedWaiterCall = await queryRunner.manager.save(waiterCall);

      await queryRunner.commitTransaction();
      this.realtimeService.emitWaiterCall(branchId, 'waiter.request.created', {
        id: savedWaiterCall.id,
        tableId,
        status: savedWaiterCall.status,
        assignedWaiterId: null,
      });
      this.logger.log(
        `Waiter call created: table=${tableId}, status=PENDING (awaiting a waiter to accept)`,
      );

      return {
        waiterCall: savedWaiterCall,
        assignedWaiter: null,
        status: WaiterCallStatus.PENDING,
        message: 'A waiter has been notified.',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      throw err;
    } finally {
      await queryRunner.release().catch(() => undefined);
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
    if (call.status !== WaiterCallStatus.PENDING) {
      throw new Error('This request is no longer awaiting a waiter');
    }
    // Any waiter can claim a pending call; accepting assigns it to them so it
    // leaves the other waiters' queues.
    call.assigned_waiter_id = waiterId;
    call.status = WaiterCallStatus.ACCEPTED;
    call.accepted_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.accepted',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
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
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.arrived',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
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
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.resolved',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
    await this.processQueueWhenAvailable(call.branch_id);
    return saved;
  }

  async reassignWaiterCall(
    waiterCallId: string,
    waiterId: string,
    branchId?: string,
  ): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null } as any,
    });
    if (!call) throw new Error('Waiter call not found');
    if (
      call.status === WaiterCallStatus.RESOLVED ||
      call.status === WaiterCallStatus.CANCELLED
    ) {
      throw new Error('This request can no longer be reassigned');
    }
    if (branchId && call.branch_id !== branchId) {
      throw new Error('This request does not belong to your branch');
    }

    const waiter = await this.userRepository.findOne({
      where: {
        id: waiterId,
        branch_id: call.branch_id,
        deleted_at: null,
      } as any,
    });
    if (!waiter) throw new Error('Target waiter not found in this branch');
    if (
      waiter.role !== UserRole.WAITER &&
      waiter.role !== UserRole.SUPERVISOR
    ) {
      throw new Error('Target user is not a waiter');
    }

    call.assigned_waiter_id = waiterId;
    call.status = WaiterCallStatus.PENDING;
    call.accepted_at = null;
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.assigned',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
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
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.cancelled',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
    await this.processQueueWhenAvailable(call.branch_id);
    return saved;
  }

  /** Public cancel: cancel the active (non-resolved) waiter call for a table. */
  async cancelWaiterCallByTable(
    tableId: string,
    customerSessionId: string,
  ): Promise<WaiterCall | null> {
    // Anonymous cancellation must prove it comes from the device that
    // created the call: table ids are discoverable via the public menu, so
    // the customer_session_id issued at creation is the credential here.
    if (!customerSessionId) return null;
    const call = await this.waiterCallRepository.findOne({
      where: {
        table_id: tableId,
        customer_session_id: customerSessionId,
        status: In([
          WaiterCallStatus.PENDING,
          WaiterCallStatus.QUEUED,
          WaiterCallStatus.ACCEPTED,
          WaiterCallStatus.ARRIVED,
        ]),
        deleted_at: null,
      } as any,
      order: { created_at: 'DESC' },
    });
    if (!call) return null;
    call.status = WaiterCallStatus.CANCELLED;
    call.cancelled_at = new Date();
    const saved = await this.waiterCallRepository.save(call);
    this.realtimeService.emitWaiterCall(
      call.branch_id,
      'waiter.request.cancelled',
      {
        id: saved.id,
        tableId: saved.table_id,
        status: saved.status,
        assignedWaiterId: saved.assigned_waiter_id,
      },
    );
    await this.processQueueWhenAvailable(saved.branch_id);
    return saved;
  }

  async getWaiterWorkload(
    waiterId: string,
    branchId?: string,
  ): Promise<{
    activeTables: number;
    maxTables: number;
    isAvailable: boolean;
  }> {
    const activeTables = await this.countActiveTablesForWaiter(
      branchId,
      waiterId,
    );
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

  async getCallsByTable(
    tableId: string,
    customerSessionId: string,
  ): Promise<WaiterCall | null> {
    if (!customerSessionId) return null;
    return this.waiterCallRepository.findOne({
      where: {
        table_id: tableId,
        customer_session_id: customerSessionId,
        deleted_at: null,
      } as any,
      order: { created_at: 'DESC' },
    });
  }

  async getMyCalls(
    waiterId: string,
    status?: WaiterCallStatus,
    branchId?: string,
  ): Promise<WaiterCall[]> {
    // Broadcast model for waiters: show every open (unassigned, awaiting a
    // waiter) call in the branch, plus this waiter's own in-progress calls.
    // Assigned/accepted calls taken by another waiter drop out of this list,
    // mirroring a ride-hailing queue.
    const where: any[] = [];
    const branch: any = branchId ? { branch_id: branchId } : {};
    if (status) {
      where.push({ ...branch, deleted_at: null, status });
      where.push({
        ...branch,
        deleted_at: null,
        assigned_waiter_id: waiterId,
        status: In([status]),
      });
    } else {
      where.push({
        ...branch,
        deleted_at: null,
        status: WaiterCallStatus.PENDING,
      });
      where.push({
        ...branch,
        deleted_at: null,
        assigned_waiter_id: waiterId,
        status: In([
          WaiterCallStatus.PENDING,
          WaiterCallStatus.ACCEPTED,
          WaiterCallStatus.ARRIVED,
        ]),
      });
    }
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

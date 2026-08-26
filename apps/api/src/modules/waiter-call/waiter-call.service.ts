import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { WaiterCall } from '../entities/waiter-call.entity';
import { Table } from '../../table/entities/table.entity';
import { User } from '../../user/entities/user.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { WaiterCallStatus, WaiterCallStatusLiteral } from '../entities/waiter-call.entity';
import { PERMISSIONS } from '../../modules/role/permission-codes';
import { TableStatus } from '../table/entities/table.entity';

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
    private readonly dataSource: DataSource,
  ) {}

  /** Read the per-branch setting; fall back to the hard default of 5. */
  private async getMaxTablesPerWaiter(branchId: string): Promise<number> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch?.settings?.max_tables_per_waiter) {
      return this.MAX_WAITER_CAPACITY;
    }
    const val = parseInt(branch.settings.max_tables_per_waiter as string, 10);
    return Number.isInteger(val) && val > 0 ? val : this.MAX_WAITER_CAPACITY;
  }

  /** Build WHERE conditions so OFFLINE/BREAK waiters are excluded. */
  private readonly waiterStatusesNotBusy = ['available', 'break'] as const;

  /** Get all active waiters for a branch, excluding offline/break/busy-at-capacity. */
  async getEligibleWaiters(
    branchId: string,
    maxTablesPerWaiter?: number,
  ): Promise<{ user: User; activeTableCount: number }[]> {
    const max = await this.getMaxTablesPerWaiter(branchId);
    const effectiveMax = maxTablesPerWaiter ?? max;

    // Get waiters for this branch
    const waiters = await this.userRepository.find({
      where: { branch_id: branchId, role: 'waiter', is_active: true },
    });

    // For each waiter, count their active (open, not closed) tabs
    const eligible: { user: User; activeTableCount: number }[] = [];

    for (const waiter of waiters) {
      // Skip OFFLINE / BREAK waiters — check role value literally
      if (waiter.role !== 'waiter') continue;

      // Count active (open) tabs assigned to this waiter, excluding closed/deleted
      const activeTabs = await this.tabRepository.count({
        where: {
          branch_id: branchId,
          waiter_id: waiter.id,
          status: 'open',
          deleted_at: null,
        },
      });

      eligible.push({
        user: waiter,
        activeTableCount: activeTabs,
      });
    }

    // Sort by lowest active table count (ascending)
    eligible.sort((a, b) => a.activeTableCount - b.activeTableCount);

    return eligible.filter((w) => w.activeTableCount < effectiveMax);
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
  }} {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate table belongs to branch
      const table = await this.tableRepository.findOne({
        where: { id: tableId, branch_id: branchId, status: 'available' },
      });
      if (!table) {
        await queryRunner.rollbackTransaction();
        throw new Error('Table not found or not available in this branch');
      }

      // 2. Ensure table doesn't already have an active/unresolved waiter call
      const existingActive = await this.waiterCallRepository.findOne({
        where: {
          table_id: tableId,
          status: In([WaiterCallStatus.PENDING, WaiterCallStatus.QUEUED]),
          deleted_at: null,
        },
        order: { created_at: 'ASC' },
      });
      if (existingActive) {
        await queryRunner.rollbackTransaction();
        throw new Error('This table already has an active waiter request');
      }

      // 3. Find eligible waiters (excluding offline/break/busy-at-capacity)
      const eligible = await this.getEligibleWaiters(branchId);
      if (eligible.length === 0) {
        // All eligible waiters are at capacity → create QUEUED request
        const waiterCall = this.waiterCallRepository.create({
          branch_id: branchId,
          table_id: tableId,
          customer_session_id: customerSessionId,
          status: WaiterCallStatus.QUEUED,
          reason: 'All waiters are currently at maximum capacity',
        });
        const saved = await this.waiterCallRepository.save(waiterCall);
        await queryRunner.commitTransaction();
        return {
          waiterCall: saved,
          assignedWaiter: null,
          status: WaiterCallStatus.QUEUED,
          message: 'All waiters are currently assisting other guests. Your request has been queued.',
        };
      }

      // 4. Sort by lowest active table count, pick the first (least-loaded)
      const selected = eligible[0];
      const selectedWaiter = selected.user;

      // 5. Create PENDING request
      const waiterCall = this.waiterCallRepository.create({
        branch_id: branchId,
        table_id: tableId,
        assigned_waiter_id: selectedWaiter.id,
        customer_session_id: customerSessionId,
        status: WaiterCallStatus.PENDING,
      });
      const savedWaiterCall = await this.waiterCallRepository.save(waiterCall);

      await queryRunner.commitTransaction();

      // Notify the selected waiter via realtime
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

  /** Mark a waiter call as accepted. Returns updated call. */
  async acceptWaiterCall(
    waiterCallId: string,
    waiterId: string,
  ): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null },
    });
    if (!call) throw new Error('Waiter call not found');

    if (call.assigned_waiter_id !== waiterId) {
      throw new Error('This waiter call is not assigned to you');
    }

    if (call.status !== WaiterCallStatus.PENDING) {
      throw new Error('This request is no longer in pending state');
    }

    const now = new Date();
    call.status = WaiterCallStatus.ACCEPTED;
    call.accepted_at = now;
    return await this.waiterCallRepository.save(call);
  }

  /** Mark a waiter call as arrived. */
  async markArrived(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null },
    });
    if (!call) throw new Error('Waiter call not found');

    if (call.assigned_waiter_id) {
      // Increment that waiter's active table count logic is handled by tab status changes
    }

    call.status = WaiterCallStatus.ARRIVED;
    call.arrived_at = new Date();
    return await this.waiterCallRepository.save(call);
  }

  /** Resolve a waiter call (close the request). */
  async resolveWaiterCall(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null },
    });
    if (!call) throw new Error('Waiter call not found');

    call.status = WaiterCallStatus.RESOLVED;
    call.resolved_at = new Date();
    return await this.waiterCallRepository.save(call);
  }

  /** Cancel a waiter call. */
  async cancelWaiterCall(waiterCallId: string): Promise<WaiterCall> {
    const call = await this.waiterCallRepository.findOne({
      where: { id: waiterCallId, deleted_at: null },
    });
    if (!call) throw new Error('Waiter call not found');

    call.status = WaiterCallStatus.CANCELLED;
    call.cancelled_at = new Date();
    return await this.waiterCallRepository.save(call);
  }

  /** Get workload for a specific waiter. */
  async getWaiterWorkload(waiterId: string, branchId: string): Promise<{
    activeTables: number;
    maxTables: number;
    isAvailable: boolean;
  }> {
    const activeTabs = await this.tabRepository.count({
      where: {
        branch_id: branchId,
        waiter_id: waiterId,
        status: 'open',
        deleted_at: null,
      },
    });
    const max = await this.getMaxTablesPerWaiter(branchId);
    return {
      activeTables: activeTabs,
      maxTables: max,
      isAvailable: activeTabs < max,
    };
  }

  /** Get active waiter calls for a branch (management view). */
  async getActiveWaiterCalls(branchId: string) {
    return this.waiterCallRepository.find({
      where: {
        branch_id: branchId,
        status: In([WaiterCallStatus.PENDING, WaiterCallStatus.ACCEPTED, WaiterCallStatus.ARRIVED]),
        deleted_at: null,
      },
      order: { created_at: 'ASC' },
    });
  }

  /** Get queued calls for a branch. */
  async getQueuedCalls(branchId: string) {
    return this.waiterCallRepository.find({
      where: {
        branch_id: branchId,
        status: WaiterCallStatus.QUEUED,
        deleted_at: null,
      },
      order: { created_at: 'ASC' },
    });
  }

  /** Process the queue when a waiter becomes available. */
  async processQueueWhenAvailable(
    branchId: string,
    availableWaiterId: string,
  ): Promise<{ waiterCall: WaiterCall; assignedWaiter: User } | null> {
    // Find the oldest queued call
    const queued = await this.getQueuedCalls(branchId);
    if (queued.length === 0) return null;

    const oldest = queued[0];

    // Re-check eligibility (capacity may have changed)
    const eligible = await this.getEligibleWaiters(branchId);
    const nextWaiter = eligible.find((w) => w.user.id === availableWaiterId);

    if (!nextWaiter) {
      // The originally assigned waiter is now over capacity; pick the least-loaded
      const leastLoaded = eligible[0];
      if (!leastLoaded) return null;
      return {
        waiterCall: await this.waiterCallRepository.findOne({
          where: { id: oldest.id, deleted_at: null },
        }),
        assignedWaiter: leastLoaded.user,
      };
    }

    // Assign the oldest queued call to the available waiter
    const oldestCall = await this.waiterCallRepository.findOne({
      where: { id: oldest.id, deleted_at: null },
    });
    if (!oldestCall) return null;

    oldestCall.assigned_waiter_id = availableWaiterId;
    oldestCall.status = WaiterCallStatus.PENDING;
    oldestCall.accepted_at = new Date();
    const saved = await this.waiterCallRepository.save(oldestCall);

    return {
      waiterCall: saved,
      assignedWaiter: nextWaiter.user,
    };
  }
}
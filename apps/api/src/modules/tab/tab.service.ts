import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tab } from './entities/tab.entity';
import { Table, TableStatus } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { StockMovement } from '../ingredient/entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Shift } from '../shift/entities/shift.entity';
import { Bill } from '../bill/entities/bill.entity';
import { StockMovementType, TabType, isBillable } from '../../common/shared';
import { TrackingService } from '../tracking/tracking.service';
import { RealtimeService } from '../gateway/realtime.service';

@Injectable()
export class TabService {
  constructor(
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(StockMovement)
    private movementRepo: Repository<StockMovement>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private trackingService: TrackingService,
    private realtimeService: RealtimeService,
  ) {}

  async openTab(
    createDto: any,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const tabType: TabType = createDto.tab_type || TabType.DINE_IN;

    // Require an open shift before opening a tab
    const openShift = await this.shiftRepo.findOne({
      where: { branch_id: createDto.branch_id, status: 'open' },
    });
    if (!openShift) {
      throw new BadRequestException(
        'No open shift for this branch. Please open a shift first.',
      );
    }

    let tableId = createDto.table_id;

    if (tabType === TabType.TAKEAWAY) {
      // Look up the branch's virtual counter table
      const virtualTable = await this.tableRepository.findOne({
        where: { branch_id: createDto.branch_id, is_virtual: true },
      });
      if (!virtualTable) {
        throw new BadRequestException(
          'No takeaway counter configured for this branch. Please contact an administrator.',
        );
      }
      tableId = virtualTable.id;
    }

    // Virtual tables never participate in occupancy logic — they are system records, not seatable tables.
    // For dine-in tables, check if the table already has an open tab.
    if (tabType !== TabType.TAKEAWAY) {
      const existingOpenTab = await this.tabRepository.findOne({
        where: { table_id: tableId, status: 'open' },
      });
      if (existingOpenTab) {
        if (
          existingOpenTab.waiter_id &&
          existingOpenTab.waiter_id !== currentUserId
        ) {
          throw new ForbiddenException(
            'This table is being served by another waiter',
          );
        }
        if (
          existingOpenTab.waiter_id === currentUserId ||
          (!existingOpenTab.waiter_id && !currentUserId)
        ) {
          return this.findOne(
            existingOpenTab.id,
            createDto.branch_id,
            currentUserId,
            currentUserRole,
          );
        }
        throw new BadRequestException('This table already has an open tab');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newTab = this.tabRepository.create({
        ...createDto,
        table_id: tableId,
        tab_type: tabType,
        shift_id: openShift.id,
        status: 'open',
        opened_at: new Date(),
        tab_number: `TAB-${Date.now()}`,
        tracking_code: await this.trackingService.generateUniqueCode(),
        tracking_generated_at: new Date(),
      });
      const savedTab = (await queryRunner.manager.save(
        newTab,
      )) as unknown as Tab;

      // Virtual tables never participate in occupancy logic — they are system records, not seatable tables.
      if (tabType !== TabType.TAKEAWAY) {
        await queryRunner.manager.update(Table, tableId, {
          status: TableStatus.OCCUPIED,
        });
      }

      await queryRunner.commitTransaction();

      // Emit real-time events
      this.realtimeService.emitTabCreated(savedTab.branch_id, savedTab);
      if (tabType !== TabType.TAKEAWAY) {
        this.realtimeService.emitTableStatusChange(
          savedTab.branch_id,
          tableId,
          TableStatus.OCCUPIED,
        );
      }

      return savedTab;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(
    id: string,
    branchId: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const tab = await this.tabRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!tab) {
      throw new NotFoundException('Tab not found');
    }

    // Block other waiters from accessing an occupied tab
    if (
      tab.status === 'open' &&
      tab.waiter_id &&
      currentUserId &&
      tab.waiter_id !== currentUserId &&
      currentUserRole !== 'owner' &&
      currentUserRole !== 'manager' &&
      currentUserRole !== 'cashier'
    ) {
      throw new ForbiddenException(
        'This table is being served by another waiter',
      );
    }

    const table = await this.tableRepository.findOne({
      where: { id: tab.table_id },
    });
    const waiter = tab.waiter_id
      ? await this.userRepository.findOne({ where: { id: tab.waiter_id } })
      : null;
    const orders = await this.orderRepository.find({
      where: { tab_id: tab.id },
    });
    const totalKobo = orders
      .filter((o) => isBillable(o.order_status))
      .reduce((sum, order) => sum + order.subtotal_kobo, 0);

    return {
      ...tab,
      table,
      waiter,
      orders,
      total_kobo: totalKobo,
    };
  }

  async findAllByBranch(
    branchId: string,
    status?: string,
    waiterId?: string,
    pagination?: { page: number; per_page: number },
  ) {
    const where: any = { branch_id: branchId };
    if (status) {
      where.status = status;
    }
    if (waiterId) {
      where.waiter_id = waiterId;
    }

    const skip = pagination
      ? (pagination.page - 1) * pagination.per_page
      : undefined;
    const take = pagination ? pagination.per_page : undefined;

    const [tabs, total] = await this.tabRepository.findAndCount({
      where,
      order: { opened_at: 'DESC' },
      skip,
      take,
    });

    const tabsWithDetails = [];
    for (const tab of tabs) {
      const table = await this.tableRepository.findOne({
        where: { id: tab.table_id },
      });
      const waiter = tab.waiter_id
        ? await this.userRepository.findOne({ where: { id: tab.waiter_id } })
        : null;
      const orders = await this.orderRepository.find({
        where: { tab_id: tab.id },
      });
      const totalKobo = orders
        .filter((o) => isBillable(o.order_status))
        .reduce((sum, order) => sum + order.subtotal_kobo, 0);

      tabsWithDetails.push({
        ...tab,
        table,
        waiter,
        orders,
        total_kobo: totalKobo,
      });
    }

    return { data: tabsWithDetails, total };
  }

  async getTabWaiters(branchId: string) {
    const raw = await this.tabRepository
      .createQueryBuilder('tab')
      .select('DISTINCT tab.waiter_id', 'waiter_id')
      .where('tab.branch_id = :branchId', { branchId })
      .andWhere('tab.waiter_id IS NOT NULL')
      .getRawMany();

    const ids = raw.map((r) => r.waiter_id);
    if (ids.length === 0) return [];

    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.full_name', 'user.role'])
      .where('user.id IN (:...ids)', { ids })
      .getMany();

    return users;
  }

  async closeTab(
    id: string,
    branchId: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const tab = await this.findOne(id, branchId);

    // Block other waiters from closing an occupied tab
    if (
      tab.status === 'open' &&
      tab.waiter_id &&
      currentUserId &&
      tab.waiter_id !== currentUserId &&
      currentUserRole !== 'owner' &&
      currentUserRole !== 'manager' &&
      currentUserRole !== 'cashier'
    ) {
      throw new ForbiddenException("You cannot close another waiter's tab");
    }

    // Verify bill exists and is paid before closing
    const bill = await this.billRepository.findOne({ where: { tab_id: id } });
    if (!bill) {
      throw new BadRequestException(
        'Cannot close tab: no bill has been generated',
      );
    }
    if (!bill.paid_at) {
      throw new BadRequestException('Cannot close tab: bill has not been paid');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Tab, id, {
        status: 'paid',
        closed_at: new Date(),
      });

      // Virtual tables never participate in occupancy logic — they are system records, not seatable tables.
      const table = await this.tableRepository.findOne({
        where: { id: tab.table_id },
      });
      if (table && !table.is_virtual) {
        await queryRunner.manager.update(Table, tab.table_id, {
          status: TableStatus.AVAILABLE,
        });
      }

      await queryRunner.commitTransaction();

      // Emit real-time events
      this.realtimeService.emitTabClosed(branchId, id, tab.table_id);
      const updatedTable = await this.tableRepository.findOne({
        where: { id: tab.table_id },
      });
      if (updatedTable && !updatedTable.is_virtual) {
        this.realtimeService.emitTableStatusChange(
          branchId,
          tab.table_id,
          TableStatus.AVAILABLE,
        );
      }

      return this.findOne(id, branchId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async transferTab(id: string, branchId: string, targetTableId: string) {
    const tab = await this.findOne(id, branchId);
    if (tab.status !== 'open') {
      throw new BadRequestException('Only open tabs can be transferred');
    }

    const sourceTable = await this.tableRepository.findOne({
      where: { id: tab.table_id },
    });

    // Block incompatible transfers: takeaway <-> physical, dine-in <-> virtual counter
    if (tab.tab_type === TabType.TAKEAWAY) {
      throw new BadRequestException(
        'Takeaway tabs cannot be transferred to another table.',
      );
    }
    // For dine-in tabs, ensure the target is a physical table (not virtual)
    const targetTable = await this.tableRepository.findOne({
      where: { id: targetTableId, branch_id: branchId },
    });
    if (!targetTable) {
      throw new NotFoundException('Target table not found');
    }
    if (targetTable.is_virtual) {
      throw new BadRequestException(
        'Cannot transfer a dine-in tab to the takeaway counter.',
      );
    }
    if (!targetTable) {
      throw new NotFoundException('Target table not found');
    }
    if (targetTable.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException('Target table is not available');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldTableId = tab.table_id;

      await queryRunner.manager.update(Tab, id, { table_id: targetTableId });
      await queryRunner.manager.update(Table, oldTableId, {
        status: TableStatus.AVAILABLE,
      });
      await queryRunner.manager.update(Table, targetTableId, {
        status: TableStatus.OCCUPIED,
      });

      await queryRunner.commitTransaction();

      // Emit real-time events
      this.realtimeService.emitTableStatusChange(
        branchId,
        oldTableId,
        TableStatus.AVAILABLE,
      );
      this.realtimeService.emitTableStatusChange(
        branchId,
        targetTableId,
        TableStatus.OCCUPIED,
      );
      this.realtimeService.emitTabUpdate(branchId, id, {
        table_id: targetTableId,
      });

      return this.findOne(id, branchId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async mergeTab(
    id: string,
    branchId: string,
    targetTabId: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    if (id === targetTabId) {
      throw new BadRequestException('Cannot merge a tab into itself');
    }

    const sourceTab = await this.findOne(id, branchId);
    const targetTab = await this.findOne(targetTabId, branchId);

    if (sourceTab.status !== 'open' || targetTab.status !== 'open') {
      throw new BadRequestException('Only open tabs can be merged');
    }

    if (
      sourceTab.waiter_id &&
      currentUserId &&
      sourceTab.waiter_id !== currentUserId &&
      currentUserRole !== 'owner' &&
      currentUserRole !== 'manager' &&
      currentUserRole !== 'supervisor'
    ) {
      throw new ForbiddenException(
        "You cannot merge another waiter's tab",
      );
    }

    // Orders must land on a seatable (dine-in) tab
    if (targetTab.tab_type === TabType.TAKEAWAY) {
      throw new BadRequestException(
        'Cannot merge into a takeaway tab.',
      );
    }

    // Reject tabs that have already moved into billing
    const existingBill = await this.billRepository.findOne({
      where: [{ tab_id: id }, { tab_id: targetTabId }],
    });
    if (existingBill) {
      throw new BadRequestException(
        'Cannot merge tabs that already have a bill generated',
      );
    }

    const sourceTable = await this.tableRepository.findOne({
      where: { id: sourceTab.table_id },
    });

    await this.dataSource.transaction(async (manager) => {
      const tabRepo = manager.getRepository(Tab);
      const tableRepo = manager.getRepository(Table);
      const orderRepo = manager.getRepository(Order);
      const movementRepo = manager.getRepository(StockMovement);

      // Move orders onto the target tab
      await orderRepo.update({ tab_id: id }, { tab_id: targetTabId });

      // Repoint stock consumption so void reversal on the target later is accurate.
      // When both tabs consumed the same item, fold quantities to keep the ledger clean.
      const sourceMovements = await movementRepo.find({
        where: { reference_id: id },
      });
      for (const mv of sourceMovements) {
        const existing = await movementRepo.findOne({
          where: {
            reference_id: targetTabId,
            menu_item_id: mv.menu_item_id,
            type: mv.type,
          },
        });
        if (existing) {
          existing.quantity_change =
            Number(existing.quantity_change) + Number(mv.quantity_change);
          await movementRepo.save(existing);
          await movementRepo.remove(mv);
        } else {
          mv.reference_id = targetTabId;
          await movementRepo.save(mv);
        }
      }

      // Close the source tab (its orders now live on the target)
      await tabRepo.update(id, {
        status: 'voided',
        notes: `MERGED INTO ${targetTab.tab_number}`,
        closed_at: new Date(),
      });

      // Virtual tables never participate in occupancy logic
      if (sourceTable && !sourceTable.is_virtual) {
        await tableRepo.update(sourceTab.table_id, {
          status: TableStatus.AVAILABLE,
        });
      }
    });

    // Emit real-time events
    this.realtimeService.emitTabUpdate(branchId, id, {
      status: 'voided',
      notes: `MERGED INTO ${targetTab.tab_number}`,
    });
    this.realtimeService.emitTabUpdate(branchId, targetTabId, {
      merged: true,
    });
    if (sourceTable && !sourceTable.is_virtual) {
      this.realtimeService.emitTableStatusChange(
        branchId,
        sourceTab.table_id,
        TableStatus.AVAILABLE,
      );
    }

    return this.findOne(targetTabId, branchId);
  }

  async voidTab(
    id: string,
    branchId: string,
    currentUserId?: string,
    currentUserRole?: string,
    reason?: string,
  ) {
    const tab = await this.findOne(id, branchId);
    if (tab.status !== 'open') {
      throw new BadRequestException('Only open tabs can be voided');
    }

    if (
      tab.status === 'open' &&
      tab.waiter_id &&
      currentUserId &&
      tab.waiter_id !== currentUserId &&
      currentUserRole !== 'owner' &&
      currentUserRole !== 'manager' &&
      currentUserRole !== 'cashier'
    ) {
      throw new ForbiddenException("You cannot void another waiter's tab");
    }

    // Double-reversal guard: if a void_reversal already exists for this tab, skip
    const existingReversal = await this.movementRepo.findOne({
      where: { reference_id: id, type: StockMovementType.VOID_REVERSAL },
    });

    await this.dataSource.transaction(async (manager) => {
      const tabRepo = manager.getRepository(Tab);
      const tableRepo = manager.getRepository(Table);
      const movementRepo = manager.getRepository(StockMovement);
      const menuItemRepo = manager.getRepository(MenuItem);

      await tabRepo.update(id, {
        status: 'voided',
        notes: `VOIDED: ${reason}`,
        closed_at: new Date(),
      });

      // Virtual tables never participate in occupancy logic — they are system records, not seatable tables.
      const voidTable = await this.tableRepository.findOne({
        where: { id: tab.table_id },
      });
      if (voidTable && !voidTable.is_virtual) {
        await tableRepo.update(tab.table_id, { status: TableStatus.AVAILABLE });
      }

      if (existingReversal) return;

      const consumptions = await movementRepo.find({
        where: { reference_id: id, type: StockMovementType.ORDER_CONSUMPTION },
      });
      if (consumptions.length === 0) return;

      // Aggregate reversals per menu_item_id
      const reversalByItem = new Map<string, number>();
      for (const row of consumptions) {
        const qty = Math.abs(Number(row.quantity_change));
        reversalByItem.set(
          row.menu_item_id,
          (reversalByItem.get(row.menu_item_id) || 0) + qty,
        );
      }

      // Sort IDs to prevent deadlocks
      const sortedIds = [...reversalByItem.keys()].sort();

      for (const menuItemId of sortedIds) {
        const qty = reversalByItem.get(menuItemId)!;
        const item = await menuItemRepo.findOne({
          where: { id: menuItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item || !item.track_stock) continue;

        item.quantity_in_stock = Number(item.quantity_in_stock) + qty;
        await menuItemRepo.save(item);

        const movement = movementRepo.create({
          branch_id: branchId,
          menu_item_id: item.id,
          type: StockMovementType.VOID_REVERSAL,
          quantity_change: qty,
          quantity_after: Number(item.quantity_in_stock),
          reference_id: id,
          notes: `Void reversal for tab ${id}`,
        });
        await movementRepo.save(movement);
      }
    });

    // Emit real-time events
    this.realtimeService.emitTabUpdate(branchId, id, { status: 'voided' });
    const voidTable = await this.tableRepository.findOne({
      where: { id: tab.table_id },
    });
    if (voidTable && !voidTable.is_virtual) {
      this.realtimeService.emitTableStatusChange(
        branchId,
        tab.table_id,
        TableStatus.AVAILABLE,
      );
    }

    return this.findOne(id, branchId);
  }

  async update(id: string, branchId: string, updateDto: any) {
    const tab = await this.findOne(id, branchId);
    Object.assign(tab, updateDto);
    return this.tabRepository.save(tab);
  }

  async remove(id: string, branchId: string) {
    const tab = await this.findOne(id, branchId);
    return this.tabRepository.remove(tab);
  }
}

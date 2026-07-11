import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tab } from './entities/tab.entity';
import { Table, TableStatus } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { StockMovement } from '../ingredient/entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Shift } from '../shift/entities/shift.entity';
import { StockMovementType } from '../../common/shared';

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
    @InjectRepository(Shift)
    private shiftRepo: Repository<Shift>,
    @Inject(DataSource)
    private dataSource: DataSource,
  ) {}

  async openTab(createDto: any, currentUserId?: string, currentUserRole?: string) {
    // Require an open shift before opening a tab
    const openShift = await this.shiftRepo.findOne({
      where: { branch_id: createDto.branch_id, closed_at: null },
    });
    if (!openShift) {
      throw new BadRequestException('No open shift for this branch. Please open a shift first.');
    }

    // Check if table already has an open tab
    const existingOpenTab = await this.tabRepository.findOne({
      where: { table_id: createDto.table_id, status: 'open' },
    });
    if (existingOpenTab) {
      if (existingOpenTab.waiter_id && existingOpenTab.waiter_id !== currentUserId) {
        throw new ForbiddenException('This table is being served by another waiter');
      }
      if (existingOpenTab.waiter_id === currentUserId) {
        return this.findOne(existingOpenTab.id, createDto.branch_id, currentUserId, currentUserRole);
      }
      // waiter_id is null/unset — legacy tab, block creation
      throw new BadRequestException('This table already has an open tab');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Tab
      const newTab = this.tabRepository.create({
        ...createDto,
        status: 'open',
        opened_at: new Date(),
        tab_number: `TAB-${Date.now()}`,
      });
      const savedTab = (await queryRunner.manager.save(newTab)) as unknown as Tab;

      // 2. Update Table Status
      await queryRunner.manager.update(Table, savedTab.table_id, {
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

  async findOne(id: string, branchId: string, currentUserId?: string, currentUserRole?: string) {
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
      currentUserRole !== 'manager'
    ) {
      throw new ForbiddenException('This table is being served by another waiter');
    }

    const table = await this.tableRepository.findOne({ where: { id: tab.table_id } });
    const waiter = await this.userRepository.findOne({ where: { id: tab.waiter_id } });
    const orders = await this.orderRepository.find({ where: { tab_id: tab.id } });
    const totalKobo = orders.reduce((sum, order) => sum + order.subtotal_kobo, 0);

    return {
      ...tab,
      table,
      waiter,
      orders,
      total_kobo: totalKobo,
    };
  }

  async findAllByBranch(branchId: string, status?: string, pagination?: { page: number; per_page: number }) {
    const where: any = { branch_id: branchId };
    if (status) {
      where.status = status;
    }
    
    const skip = pagination ? (pagination.page - 1) * pagination.per_page : undefined;
    const take = pagination ? pagination.per_page : undefined;

    const [tabs, total] = await this.tabRepository.findAndCount({
      where,
      order: { opened_at: 'DESC' },
      skip,
      take,
    });

    const tabsWithDetails = [];
    for (const tab of tabs) {
      const table = await this.tableRepository.findOne({ where: { id: tab.table_id } });
      const waiter = await this.userRepository.findOne({ where: { id: tab.waiter_id } });
      const orders = await this.orderRepository.find({ where: { tab_id: tab.id } });
      const totalKobo = orders.reduce((sum, order) => sum + order.subtotal_kobo, 0);
      
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

  async closeTab(id: string, branchId: string, currentUserId?: string, currentUserRole?: string) {
    const tab = await this.findOne(id, branchId);

    // Block other waiters from closing an occupied tab
    if (
      tab.status === 'open' &&
      tab.waiter_id &&
      currentUserId &&
      tab.waiter_id !== currentUserId &&
      currentUserRole !== 'owner' &&
      currentUserRole !== 'manager'
    ) {
      throw new ForbiddenException('You cannot close another waiter\'s tab');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Tab, id, {
        status: 'paid',
        closed_at: new Date(),
      });
      await queryRunner.manager.update(Table, tab.table_id, {
        status: TableStatus.AVAILABLE,
      });

      await queryRunner.commitTransaction();
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

    const targetTable = await this.tableRepository.findOne({ where: { id: targetTableId, branch_id: branchId } });
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
      await queryRunner.manager.update(Table, oldTableId, { status: TableStatus.AVAILABLE });
      await queryRunner.manager.update(Table, targetTableId, { status: TableStatus.OCCUPIED });

      await queryRunner.commitTransaction();
      return this.findOne(id, branchId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async voidTab(id: string, branchId: string, currentUserId?: string, currentUserRole?: string, reason?: string) {
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
      currentUserRole !== 'manager'
    ) {
      throw new ForbiddenException('You cannot void another waiter\'s tab');
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
      await tableRepo.update(tab.table_id, { status: TableStatus.AVAILABLE });

      if (existingReversal) return;

      const consumptions = await movementRepo.find({
        where: { reference_id: id, type: StockMovementType.ORDER_CONSUMPTION },
      });
      if (consumptions.length === 0) return;

      // Aggregate reversals per menu_item_id
      const reversalByItem = new Map<string, number>();
      for (const row of consumptions) {
        const qty = Math.abs(Number(row.quantity_change));
        reversalByItem.set(row.menu_item_id, (reversalByItem.get(row.menu_item_id) || 0) + qty);
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

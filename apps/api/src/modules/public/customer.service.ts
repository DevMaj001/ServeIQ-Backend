import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Table } from '../table/entities/table.entity';
import { TrackingService } from '../tracking/tracking.service';
import { ModifierSelectionDto } from '../order/dto/create-order-item.dto';
import {
  TabType,
  FulfillmentType,
  OrderStatus,
  TableStatus,
} from '../../common/shared';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Table)
    private tableRepo: Repository<Table>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private trackingService: TrackingService,
  ) {}

  async openTab(dto: {
    branch_id: string;
    table_id?: string;
    customer_name?: string;
    party_size?: number;
    tab_type?: TabType;
  }) {
    const tabType = dto.tab_type || TabType.DINE_IN;

    if (tabType === TabType.DINE_IN) {
      if (!dto.table_id)
        throw new BadRequestException('table_id is required for dine-in');

      const table = await this.tableRepo.findOne({
        where: { id: dto.table_id, branch_id: dto.branch_id },
      });
      if (!table) throw new NotFoundException('Table not found');
      if (table.is_virtual)
        throw new BadRequestException('Cannot dine-in at the takeaway counter');

      const existingOpenTab = await this.tabRepo.findOne({
        where: { table_id: dto.table_id, status: 'open' },
      });
      if (existingOpenTab) {
        if (existingOpenTab.waiter_id) {
          throw new ForbiddenException(
            'This table is currently being served by a waiter',
          );
        }
        return this.getTabResponse(existingOpenTab.id);
      }

      const newTab = this.tabRepo.create({
        branch_id: dto.branch_id,
        table_id: dto.table_id,
        waiter_id: null,
        customer_name: dto.customer_name || 'Guest',
        party_size: dto.party_size || 1,
        tab_type: TabType.DINE_IN,
        status: 'open',
        opened_at: new Date(),
        tab_number: `SELF-${Date.now()}`,
        tracking_code: await this.trackingService.generateUniqueCode(),
        tracking_generated_at: new Date(),
      });

      const savedTab = await this.tabRepo.save(newTab);
      await this.tableRepo.update(dto.table_id, {
        status: TableStatus.OCCUPIED,
      });
      return this.getTabResponse(savedTab.id);
    }

    const virtualTable = await this.tableRepo.findOne({
      where: { branch_id: dto.branch_id, is_virtual: true },
    });
    if (!virtualTable) {
      throw new NotFoundException(
        'No counter/takeaway table found for this branch',
      );
    }

    const newTab = this.tabRepo.create({
      branch_id: dto.branch_id,
      table_id: virtualTable.id,
      waiter_id: null,
      customer_name: dto.customer_name || 'Guest',
      party_size: dto.party_size || 1,
      tab_type: TabType.TAKEAWAY,
      status: 'open',
      opened_at: new Date(),
      tab_number: `TA-${Date.now()}`,
      tracking_code: await this.trackingService.generateUniqueCode(),
      tracking_generated_at: new Date(),
    });

    const savedTab = await this.tabRepo.save(newTab);
    return this.getTabResponse(savedTab.id);
  }

  async addItems(
    tabId: string,
    trackingCode: string,
    items: {
      menu_item_id: string;
      quantity: number;
      notes?: string;
      modifiers?: ModifierSelectionDto[];
    }[],
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');
    if (tab.status !== 'open') throw new BadRequestException('Tab is not open');
    if (tab.waiter_id !== null)
      throw new BadRequestException('This tab is managed by a waiter');

    const menuItemIds = items.map((i) => i.menu_item_id);
    const menuItems = await this.menuItemRepo.find({
      where: { id: In(menuItemIds) },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem)
        throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
      if (!menuItem.is_available)
        throw new BadRequestException(`"${menuItem.name}" is not available`);
    }

    const orders = await this.dataSource.transaction(async (manager) => {
      const savedOrders: Order[] = [];
      for (const item of items) {
        const menuItem = menuMap.get(item.menu_item_id)!;
        const modifierTotal = (item.modifiers || []).reduce(
          (sum: number, m: ModifierSelectionDto) => sum + m.price_kobo * m.qty,
          0,
        );
        const order = manager.getRepository(Order).create({
          tab_id: tabId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_kobo: menuItem.price_kobo,
          subtotal_kobo: item.quantity * menuItem.price_kobo + modifierTotal,
          round_number: 1,
          created_by: 'self-service',
          notes: item.notes,
          modifiers: item.modifiers,
          fulfillment_type: (tab.tab_type === TabType.TAKEAWAY
            ? 'takeaway'
            : 'serve') as FulfillmentType,
          order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
        });
        savedOrders.push(await manager.getRepository(Order).save(order));
      }
      return savedOrders;
    });

    return {
      tabId,
      trackingCode,
      orders: orders.map((o) => ({
        id: o.id,
        menu_item_id: o.menu_item_id,
        quantity: o.quantity,
        subtotal_kobo: o.subtotal_kobo,
        order_status: o.order_status,
      })),
    };
  }

  async getTab(tabId: string, trackingCode: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');

    return this.getTabResponse(tabId);
  }

  private async getTabResponse(tabId: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    const orders = await this.orderRepo.find({
      where: { tab_id: tabId },
      order: { created_at: 'ASC' },
    });

    return {
      id: tab.id,
      table_id: tab.table_id,
      status: tab.status,
      customer_name: tab.customer_name,
      party_size: tab.party_size,
      tab_type: tab.tab_type,
      tracking_code: tab.tracking_code,
      tracking_generated_at: tab.tracking_generated_at,
      opened_at: tab.opened_at,
      total_kobo: orders.reduce((sum, o) => sum + o.subtotal_kobo, 0),
      orders: orders.map((o) => ({
        id: o.id,
        menu_item_id: o.menu_item_id,
        quantity: o.quantity,
        subtotal_kobo: o.subtotal_kobo,
        order_status: o.order_status,
        notes: o.notes,
        modifiers: o.modifiers,
        created_at: o.created_at,
      })),
    };
  }
}

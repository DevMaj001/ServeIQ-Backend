import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual } from 'typeorm';
import { Order } from './entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { IngredientService } from '../ingredient/ingredient.service';
import { OrderStatus } from '../../common/shared';
import { AuditService } from '../../common/services/audit.service';
import { Department } from '../department/entities/department.entity';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private ingredientService: IngredientService,
    private auditService: AuditService,
    private trackingService: TrackingService,
    private notificationService: NotificationService,
  ) {}

  async addOrderItems(tabId: string, items: any[], userId: string) {
    const ids = items.map(i => i.menu_item_id);
    const menuItems = await this.menuRepository.find({ where: { id: In(ids) } });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
      if (menuItem.track_stock && Number(menuItem.quantity_in_stock) < item.quantity) {
        throw new BadRequestException(`Insufficient stock for "${menuItem.name}": ${Number(menuItem.quantity_in_stock)} available, ${item.quantity} requested`);
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const orders = [];
      const tab = await this.tabRepository.findOne({ where: { id: tabId } });
      if (!tab) {
        throw new NotFoundException('Tab not found');
      }

      for (const item of items) {
        const menuItem = menuMap.get(item.menu_item_id);
        if (!menuItem) {
          throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
        }

        const modifierTotal = (item.modifiers || []).reduce((sum: number, m: any) => sum + (m.price_kobo * m.qty), 0);
        const order = manager.getRepository(Order).create({
          tab_id: tabId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_kobo: menuItem.price_kobo,
          subtotal_kobo: (item.quantity * menuItem.price_kobo) + modifierTotal,
          round_number: item.round_number || 1,
          created_by: userId,
          notes: item.notes,
          modifiers: item.modifiers || null,
          order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
        });
        orders.push(await manager.getRepository(Order).save(order));
      }

      await this.ingredientService.deductByTab(
        { id: tabId, branch_id: tab.branch_id },
        items.map(item => ({ menu_item_id: item.menu_item_id, quantity: item.quantity })),
        manager,
      );

      return orders;
    });
  }

  async findByTab(tabId: string) {
    return this.orderRepository.find({
      where: { tab_id: tabId },
    });
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order item not found');
    }
    return order;
  }

  async updateOrder(id: string, updateDto: any) {
    const order = await this.findOne(id);

    if (updateDto.quantity !== undefined) {
      order.quantity = updateDto.quantity;
    }

    if (updateDto.modifiers !== undefined) {
      order.modifiers = updateDto.modifiers;
    }

    if (updateDto.notes !== undefined) {
      order.notes = updateDto.notes;
    }

    const modifierTotal = (order.modifiers || []).reduce((sum, m) => sum + (m.price_kobo * m.qty), 0);
    order.subtotal_kobo = (order.quantity * order.unit_price_kobo) + modifierTotal;

    return this.orderRepository.save(order);
  }

  async removeOrder(id: string) {
    const order = await this.findOne(id);
    await this.orderRepository.remove(order);
    return { message: 'Order item removed successfully' };
  }

  private async getTabForOrder(orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId }, select: { id: true, tab_id: true } });
    if (!order) throw new NotFoundException('Order not found');
    const tab = await this.tabRepository.findOne({ where: { id: order.tab_id } });
    if (!tab) throw new NotFoundException('Tab not found');
    return { order, tab };
  }

  async approve(id: string, userId: string, dto: ApproveOrderDto) {
    const { tab } = await this.getTabForOrder(id);
    const alphaIds = [id].sort();
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: alphaIds[0] },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.order_status !== OrderStatus.PENDING_SUPERVISOR_APPROVAL) {
        throw new BadRequestException('Order is not pending approval');
      }

      const departmentId = dto.department;
      const dept = await this.departmentRepo.findOne({ where: { id: departmentId, branch_id: tab.branch_id } });
      if (!dept) throw new NotFoundException('Department not found in this branch');

      if (!order.tracking_code) {
        order.tracking_code = await this.trackingService.generateUniqueCode();
        order.tracking_generated_at = new Date();
      }

      const now = new Date();
      order.order_status = OrderStatus.APPROVED;
      order.approved_by = userId;
      order.approved_at = now;
      // preparing_at intentionally set to the same timestamp as approved_at because there is
      // no Chef-confirmed "cooking started" signal yet. When the planned Chef role (V1.2)
      // adds a real PREPARING status transition, replace this line with the independent
      // timestamp set at that actual transition point.
      order.preparing_at = now;
      order.assigned_department = departmentId;
      order.estimated_preparation_time_seconds = dto.estimated_preparation_time_seconds;
      order.timer_started_at = now;
      order.timer_ends_at = new Date(now.getTime() + dto.estimated_preparation_time_seconds * 1000);

      await manager.getRepository(Order).save(order);

      await this.auditService.log({
        branchId: tab.branch_id,
        userId,
        action: 'order.approve',
        entityId: id,
        entityType: 'order',
        payload: { department: departmentId, estimated_time_seconds: dto.estimated_preparation_time_seconds },
      });

      return order;
    }).then(async (savedOrder) => {
      await this.notificationService.create({
        branch_id: tab.branch_id,
        type: NotificationType.ORDER_APPROVED,
        title: 'Order Approved',
        message: `Order ${savedOrder.id.slice(0, 8)}… approved. Tracking: ${savedOrder.tracking_code}`,
        data: { order_id: savedOrder.id, tab_id: savedOrder.tab_id, tracking_code: savedOrder.tracking_code },
      });
      return savedOrder;
    });
  }

  async decline(id: string, userId: string, dto: DeclineOrderDto) {
    const { tab } = await this.getTabForOrder(id);
    const alphaIds = [id].sort();
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: alphaIds[0] },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.order_status !== OrderStatus.PENDING_SUPERVISOR_APPROVAL) {
        throw new BadRequestException('Order is not pending approval');
      }

      order.order_status = OrderStatus.DECLINED;
      order.declined_by = userId;
      order.declined_at = new Date();
      order.decline_reason = dto.decline_reason;

      await manager.getRepository(Order).save(order);

      await this.auditService.log({
        branchId: tab.branch_id,
        userId,
        action: 'order.decline',
        entityId: id,
        entityType: 'order',
        payload: { reason: dto.decline_reason },
      });

      return order;
    });
  }

  async deliver(id: string, userId: string) {
    const { tab } = await this.getTabForOrder(id);
    const alphaIds = [id].sort();
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: alphaIds[0] },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.order_status !== OrderStatus.READY_FOR_PICKUP) {
        throw new BadRequestException('Order is not ready for pickup');
      }

      order.order_status = OrderStatus.DELIVERED;
      order.delivered_by_supervisor = userId;
      order.delivered_at = new Date();

      await manager.getRepository(Order).save(order);

      await this.auditService.log({
        branchId: tab.branch_id,
        userId,
        action: 'order.deliver',
        entityId: id,
        entityType: 'order',
      });

      return order;
    });
  }

  private async findGroupedOrdersByBranch(
    branchId: string,
    statuses: OrderStatus[],
    orderBy: 'created_at' | 'timer_ends_at',
  ): Promise<any[]> {
    const orderClause = orderBy === 'timer_ends_at'
      ? 'MIN(o.timer_ends_at) ASC NULLS LAST'
      : 'MIN(o.created_at) ASC';

    const sql = `
      SELECT
        o.tab_id::text AS "tabId",
        o.created_at AS "createdAt",
        t.table_id::text AS "tableId",
        tbl.table_number AS "tableNumber",
        t.waiter_id::text AS "waiterId",
        w.full_name AS "waiterName",
        SUM(o.subtotal_kobo) AS "totalKobo",
        MIN(o.timer_ends_at) AS "timerEndsAt",
        (ARRAY_AGG(d.id))[1] AS "departmentId",
        MIN(d.name) AS "departmentName",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', o.id,
            'menuItemId', o.menu_item_id,
            'menuItemName', mi.name,
            'quantity', o.quantity,
            'unitPriceKobo', o.unit_price_kobo,
            'subtotalKobo', o.subtotal_kobo,
            'notes', o.notes,
            'modifiers', o.modifiers,
            'orderStatus', o.order_status,
            'timerEndsAt', o.timer_ends_at,
            'trackingCode', o.tracking_code,
            'declineReason', o.decline_reason,
            'createdAt', o.created_at
          ) ORDER BY o.created_at
        ) AS items
      FROM orders o
      JOIN tabs t ON t.id = o.tab_id
      LEFT JOIN tables tbl ON tbl.id = t.table_id
      LEFT JOIN users w ON w.id = t.waiter_id
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      LEFT JOIN departments d ON d.id = o.assigned_department
      WHERE t.branch_id = $1
        AND o.order_status = ANY($2::text[])
      GROUP BY o.tab_id, o.created_at, t.table_id, tbl.table_number, t.waiter_id, w.full_name
      ORDER BY ${orderClause}
    `;

    const rows = await this.dataSource.query(sql, [branchId, statuses]);
    return rows;
  }

  async findPendingByBranch(branchId: string) {
    return this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.PENDING_SUPERVISOR_APPROVAL],
      'created_at',
    );
  }

  async findPreparingByBranch(branchId: string) {
    return this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.APPROVED, OrderStatus.ASSIGNED_TO_DEPARTMENT, OrderStatus.PREPARING],
      'timer_ends_at',
    );
  }

  async findReadyForPickupByBranch(branchId: string) {
    return this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.READY_FOR_PICKUP],
      'timer_ends_at',
    );
  }

  async expireTimers() {
    const now = new Date();
    const expired = await this.orderRepository.find({
      where: {
        order_status: OrderStatus.APPROVED,
        timer_ends_at: LessThanOrEqual(now),
      },
    });

    for (const order of expired) {
      order.order_status = OrderStatus.READY_FOR_PICKUP;
      order.actual_ready_time = now;
    }

    if (expired.length > 0) {
      await this.orderRepository.save(expired);
    }

    return expired;
  }
}

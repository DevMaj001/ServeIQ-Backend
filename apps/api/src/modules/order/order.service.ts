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

  async findPendingByBranch(branchId: string) {
    const tabs = await this.tabRepository.find({ where: { branch_id: branchId } });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length === 0) return [];

    return this.orderRepository.find({
      where: { tab_id: In(tabIds), order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL },
      order: { created_at: 'ASC' },
    });
  }

  async findPreparingByBranch(branchId: string) {
    const tabs = await this.tabRepository.find({ where: { branch_id: branchId } });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length === 0) return [];

    return this.orderRepository.find({
      where: { tab_id: In(tabIds), order_status: In([OrderStatus.APPROVED, OrderStatus.ASSIGNED_TO_DEPARTMENT, OrderStatus.PREPARING]) },
      order: { timer_ends_at: 'ASC' },
    });
  }

  async findReadyForPickupByBranch(branchId: string) {
    const tabs = await this.tabRepository.find({ where: { branch_id: branchId } });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length === 0) return [];

    return this.orderRepository.find({
      where: { tab_id: In(tabIds), order_status: OrderStatus.READY_FOR_PICKUP },
      order: { timer_ends_at: 'ASC' },
    });
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

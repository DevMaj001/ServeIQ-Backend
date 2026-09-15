import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import { Order } from './entities/order.entity';
import { Bill } from '../bill/entities/bill.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { IngredientService } from '../ingredient/ingredient.service';
import {
  OrderStatus,
  UserRole,
  FulfillmentType,
  TabType,
} from '../../common/shared';
import { AuditService } from '../../common/services/audit.service';
import { Department } from '../department/entities/department.entity';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { RealtimeService } from '../gateway/realtime.service';
import { DeliveryService } from '../delivery/delivery.service';
import type { FindOptionsWhere } from 'typeorm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @InjectRepository(Bill)
    private billRepository: Repository<Bill>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private ingredientService: IngredientService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private realtimeService: RealtimeService,
    private deliveryService: DeliveryService,
  ) {
    // In-memory buffer for batching order_ready notifications per tab
    this.orderReadyBuffer = new Map<
      string,
      { orders: Order[]; timeout: NodeJS.Timeout }
    >();
  }

  private orderReadyBuffer: Map<
    string,
    { orders: Order[]; timeout: NodeJS.Timeout }
  >;

  private flushOrderReadyBuffer(tabId: string) {
    const entry = this.orderReadyBuffer.get(tabId);
    if (!entry || entry.orders.length === 0) return;

    const orders = entry.orders;
    this.orderReadyBuffer.delete(tabId);
    if (entry.timeout) clearTimeout(entry.timeout);

    const tabIdStr = tabId;
    this.sendOrderReadyBatch(orders);
  }

  private sendOrderReadyBatch(orders: Order[]) {
    if (orders.length === 0) return;
    const firstOrder = orders[0];
    if (!firstOrder.tab_id) return;
    this.tabRepository
      .findOne({ where: { id: firstOrder.tab_id } })
      .then((tab) => {
        if (!tab) return;
        const orderIds = orders.map((o) => o.id);
        const count = orders.length;
        this.notificationService.create({
          branch_id: tab.branch_id,
          user_id: tab.waiter_id ?? null,
          type: NotificationType.ORDER_READY,
          title: 'Orders Ready',
          message:
            count === 1
              ? `Order ${firstOrder.id.slice(0, 8)}… is ready for pickup.`
              : `${count} orders ready for pickup (${orderIds.map((id) => id.slice(0, 8)).join(', ')}).`,
          data: {
            order_ids: orderIds,
            tab_id: firstOrder.tab_id,
            tracking_code: tab.tracking_code,
            count,
          },
        });
        this.realtimeService.emitDashboardUpdate(tab.branch_id, {
          type: 'order_ready_batch',
          orders: orderIds,
          count,
          tab_id: firstOrder.tab_id,
        });
      });
  }

  async addOrderItems(
    tabId: string,
    items: any[],
    userId: string,
    userRole?: string,
  ) {
    const ids = items.map((i) => i.menu_item_id);
    const menuItems = await this.menuRepository.find({
      where: { id: In(ids) },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem)
        throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
      if (
        menuItem.track_stock &&
        Number(menuItem.quantity_in_stock) < item.quantity
      ) {
        throw new BadRequestException(
          `Insufficient stock for "${menuItem.name}": ${Number(menuItem.quantity_in_stock)} available, ${item.quantity} requested`,
        );
      }
    }

    return this.dataSource
      .transaction(async (manager) => {
        const orders = [];
        const tab = await this.tabRepository.findOne({ where: { id: tabId } });
        if (!tab) {
          throw new NotFoundException('Tab not found');
        }

        // Waiter ownership guard: a different waiter must not add items to a tab
        // another waiter is serving (parity with processPayment's 403).
        // Only enforced while the tab is actively open — a 'billed' tab is still
        // open for business in the multi-order flow and may receive a new round
        // from any branch waiter (mirrors tab.service.findOne's open-only guard).
        if (
          tab.status === 'open' &&
          tab.waiter_id &&
          userId &&
          tab.waiter_id !== userId &&
          (!userRole ||
            (userRole !== 'owner' &&
              userRole !== 'manager' &&
              userRole !== 'cashier'))
        ) {
          throw new ForbiddenException(
            'This tab is being served by another waiter',
          );
        }

        // A 'billed' tab is still open for business in the multi-order flow: viewing a
        // bill isn't final. Adding a new round reverts the tab to OPEN so the payment
        // gate re-engages (spec: adding a new order re-locks payment until delivered).
        if (tab.status !== 'open' && tab.status !== 'billed') {
          throw new BadRequestException(
            `Cannot add items to tab with status: ${tab.status}`,
          );
        }
        if (tab.status === 'billed') {
          await this.tabRepository.update(tabId, {
            status: 'open',
            billed_at: null,
          });
        }

        const branchId = tab.branch_id;
        const tabDefault =
          tab.tab_type === TabType.TAKEAWAY
            ? FulfillmentType.PACK
            : FulfillmentType.SERVE;

        // KDS-enabled branches route cook items straight to the kitchen,
        // bypassing supervisor approval. departmentRepo and the branch default
        // give the item a target station; without either it lands "Unassigned".
        const tabBranch = await manager
          .getRepository(Branch)
          .findOne({ where: { id: tab.branch_id } });
        const tabSettings = tabBranch?.settings || {};
        const kdsEnabled =
          (tabSettings?.feature_flags as Record<string, boolean> | undefined)
            ?.kds_enabled === true;
        const kdsDefaultDepartment =
          (tabSettings?.kds_default_department_id as string) || null;

        // VIP pricing: when the tab sits on a VIP table, every item's unit price
        // is raised by the business-configured percentage. Admin controls the
        // percentage (settings > vip_surcharge_percent); 0 (default) = no change.
        let vipMultiplier = 1;
        if (tab.table_id) {
          const tabTable = await manager
            .getRepository(Table)
            .findOne({ where: { id: tab.table_id } });
          if (tabTable?.is_vip) {
            const tabBranch = await manager
              .getRepository(Branch)
              .findOne({ where: { id: tab.branch_id } });
            const tabBusiness = tabBranch
              ? await manager
                  .getRepository(Business)
                  .findOne({ where: { id: tabBranch.business_id } })
              : null;
            const vipPercent = Number(tabBusiness?.vip_surcharge_percent ?? 0);
            vipMultiplier = 1 + vipPercent / 100;
          }
        }

        for (const item of items) {
          const menuItem = menuMap.get(item.menu_item_id);
          if (!menuItem) {
            throw new NotFoundException(
              `Menu item ${item.menu_item_id} not found`,
            );
          }

          const modifierTotal = (item.modifiers || []).reduce(
            (sum: number, m: any) => sum + m.price_kobo * m.qty,
            0,
          );
          const unitPrice = Math.round(menuItem.price_kobo * vipMultiplier);
          // Instant (ready-to-serve) items — e.g. drinks — skip the supervisor
          // approval + timer pipeline and land directly in "ready for pickup"
          // so the waiter/bar can serve them immediately. Cook items keep the
          // existing pending → approve → timer flow.
          const orderStatus =
            menuItem.prep_type === 'instant'
              ? OrderStatus.READY_FOR_PICKUP
              : kdsEnabled
                ? OrderStatus.ASSIGNED_TO_DEPARTMENT
                : OrderStatus.PENDING_SUPERVISOR_APPROVAL;

          // When KDS is enabled the waiter has already punched the department +
          // prep time at order time (industry-standard flow), so no supervisor is
          // needed. Fall back to the branch default department, then Unassigned.
          // Estimated prep time falls back to the menu item default when the item
          // carries one.
          const assignedDepartment = kdsEnabled
            ? item.department || kdsDefaultDepartment || null
            : null;
          const estimatedPrepSeconds = kdsEnabled
            ? (item.estimated_preparation_time_seconds ??
              menuItem.prep_time_seconds ??
              null)
            : null;

          const order = manager.getRepository(Order).create({
            tab_id: tabId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price_kobo: unitPrice,
            subtotal_kobo: item.quantity * unitPrice + modifierTotal,
            round_number: item.round_number || 1,
            created_by: userId,
            notes: item.notes,
            modifiers: item.modifiers || null,
            fulfillment_type: item.fulfillment_type || tabDefault,
            order_status: orderStatus,
            assigned_department: assignedDepartment,
            estimated_preparation_time_seconds: estimatedPrepSeconds,
          });
          orders.push(await manager.getRepository(Order).save(order));
        }

        // A fresh round invalidates any existing split plan for this tab: the
        // old share totals no longer match the combined order set. Paid shares
        // are left alone; the unpaid plan rows are voided so the customer sees
        // the live bill instead of a stale split.
        await manager
          .getRepository(Bill)
          .createQueryBuilder()
          .update(Bill)
          .set({ voided_at: new Date() })
          .where('tab_id = :tabId', { tabId })
          .andWhere('split_group IS NOT NULL')
          .andWhere('paid_at IS NULL')
          .andWhere('voided_at IS NULL')
          .execute();

        await this.ingredientService.deductByTab(
          { id: tabId, branch_id: branchId },
          items.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
          })),
          manager,
        );

        return { orders, branchId };
      })
      .then((result) => {
        this.emitOrderCreatedEvents(result.branchId, result.orders);
        return result.orders;
      });
  }

  private async emitOrderCreatedEvents(branchId: string, orders: any[]) {
    for (const order of orders) {
      this.realtimeService.emitOrderCreated(branchId, order);
      this.realtimeService.emitOrderStatusChange(
        branchId,
        order.id,
        order.order_status,
        order.tab_id,
      );
    }
  }

  async findByTab(tabId: string, branchId?: string) {
    if (branchId) {
      const tab = await this.tabRepository.findOne({
        where: { id: tabId, branch_id: branchId },
      });
      if (!tab) throw new NotFoundException('Tab not found in this branch');
    }
    const rows = await this.dataSource.query(
      `SELECT o.*, mi.name AS menu_item_name
         FROM orders o
         LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
        WHERE o.tab_id = $1
        ORDER BY o.created_at ASC`,
      [tabId],
    );
    return rows;
  }

  async findOne(id: string, branchId?: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order item not found');
    }
    if (branchId) {
      if (order.tab_id) {
        const tab = await this.tabRepository.findOne({
          where: { id: order.tab_id, branch_id: branchId },
        });
        if (!tab) throw new NotFoundException('Order not found in this branch');
      } else if (order.branch_id && order.branch_id !== branchId) {
        throw new NotFoundException('Order not found in this branch');
      }
    }
    return order;
  }

  async updateOrder(id: string, updateDto: any, branchId?: string) {
    const order = await this.findOne(id, branchId);

    if (updateDto.quantity !== undefined) {
      order.quantity = updateDto.quantity;
    }

    if (updateDto.modifiers !== undefined) {
      order.modifiers = updateDto.modifiers;
    }

    if (updateDto.notes !== undefined) {
      order.notes = updateDto.notes;
    }

    const modifierTotal = (order.modifiers || []).reduce(
      (sum, m) => sum + m.price_kobo * m.qty,
      0,
    );
    order.subtotal_kobo =
      order.quantity * order.unit_price_kobo + modifierTotal;

    const saved = await this.orderRepository.save(order);
    if (order.tab_id) await this.invalidateSplitPlan(order.tab_id);
    return saved;
  }

  async removeOrder(id: string, branchId?: string) {
    const order = await this.findOne(id, branchId);

    if (order.order_status !== OrderStatus.PENDING_SUPERVISOR_APPROVAL) {
      throw new BadRequestException(
        `Cannot remove order with status: ${order.order_status}`,
      );
    }

    await this.orderRepository.remove(order);
    if (order.tab_id) await this.invalidateSplitPlan(order.tab_id);
    return { message: 'Order item removed successfully' };
  }

  /**
   * A split/plan is built over the tab's orders at the moment it is created. If
   * the tab's order set changes afterwards (add/remove/update) while the plan is
   * still being collected, the old share totals are now stale and must not keep
   * surfacing to the customer (the public tracking page or a later settle). Void
   * any unpaid, unsettled split-group rows so the tab's live bill is the source
   * of truth. Paid split rows are left intact (they represent real collected
   * money); the wholesale settle path clears those.
   */
  private async invalidateSplitPlan(tabId: string) {
    await this.billRepository
      .createQueryBuilder()
      .update(Bill)
      .set({ voided_at: new Date() })
      .where('tab_id = :tabId', { tabId })
      .andWhere('split_group IS NOT NULL')
      .andWhere('paid_at IS NULL')
      .andWhere('voided_at IS NULL')
      .execute();
  }

  private async getTabForOrder(orderId: string, branchId?: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      select: { id: true, tab_id: true, branch_id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const tab = order.tab_id
      ? await this.tabRepository.findOne({ where: { id: order.tab_id } })
      : null;
    // Standalone orders (tabless self-service/takeaway) carry their own branch.
    const resolvedBranch = tab?.branch_id ?? order.branch_id;
    if (!resolvedBranch)
      throw new NotFoundException('Order has no resolvable branch');
    if (branchId && resolvedBranch !== branchId)
      throw new NotFoundException('Order not found in this branch');
    return { order, tab, branchId: resolvedBranch };
  }

  private async verifyBranchAccess(
    orderId: string,
    branchId: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      select: { id: true, tab_id: true, branch_id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const tab = order.tab_id
      ? await this.tabRepository.findOne({
          where: { id: order.tab_id, branch_id: branchId },
        })
      : null;
    if (tab) return;
    if (order.branch_id === branchId) return;
    throw new NotFoundException('Order not found in this branch');
  }

  async approve(
    id: string,
    userId: string,
    dto: ApproveOrderDto,
    branchId?: string,
  ) {
const { tab, branchId: ctxBranchId } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();

    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (order.order_status !== OrderStatus.PENDING_SUPERVISOR_APPROVAL) {
          throw new BadRequestException('Order is not pending approval');
        }

        const departmentId = dto.department;
        const dept = await this.departmentRepo.findOne({
          where: { id: departmentId, branch_id: ctxBranchId },
        });
        if (!dept)
          throw new NotFoundException('Department not found in this branch');

        const now = new Date();
        order.approved_by = userId;
        order.approved_at = now;
        order.assigned_department = departmentId;
        order.estimated_preparation_time_seconds =
          dto.estimated_preparation_time_seconds;

        // Default status after approval. The KDS layer is optional: for branches with
        // kitchen-display infrastructure enabled (kds_enabled), approval auto-dispatches
        // the order to the KDS (ASSIGNED_TO_DEPARTMENT) so a chef accepts and bumps it.
        // For all other branches the legacy behaviour is preserved: the order stays
        // APPROVED and the timer cron moves it to READY_FOR_PICKUP.
        const branch = await manager.getRepository(Branch).findOne({
          where: { id: ctxBranchId },
        });
        const kdsEnabled =
          (
            branch?.settings?.feature_flags as
              Record<string, boolean> | undefined
          )?.kds_enabled === true;
        order.order_status = kdsEnabled
          ? OrderStatus.ASSIGNED_TO_DEPARTMENT
          : OrderStatus.APPROVED;

        if (kdsEnabled) {
          // KDS: the prep countdown must not burn time while the order sits
          // waiting for a chef to accept. The timer starts in accept().
          order.timer_started_at = null;
          order.timer_ends_at = null;
          order.preparing_at = null;
        } else {
          // Legacy: approval starts the countdown immediately.
          order.timer_started_at = now;
          order.timer_ends_at = new Date(
            now.getTime() + dto.estimated_preparation_time_seconds * 1000,
          );
          // preparing_at is set to the approval timestamp only when the branch has no KDS
          // (no chef-confirmed "cooking started" signal). Once the KDS chef accepts, the
          // accept() transition overwrites preparing_at with the real start time.
          order.preparing_at = now;
        }

        await manager.getRepository(Order).save(order);

        await this.auditService.log({
          branchId: ctxBranchId,
          userId,
          action: 'order.approve',
          entityId: id,
          entityType: 'order',
          payload: {
            department: departmentId,
            estimated_time_seconds: dto.estimated_preparation_time_seconds,
          },
        });

        return order;
      })
      .then(async (savedOrder) => {
        const orderTab = savedOrder.tab_id
          ? await this.tabRepository.findOne({
              where: { id: savedOrder.tab_id },
            })
          : null;
        await this.notificationService.create({
          branch_id: ctxBranchId,
          user_id: orderTab?.waiter_id ?? null,
          type: NotificationType.ORDER_APPROVED,
          title: 'Order Approved',
          message: `Order ${savedOrder.id.slice(0, 8)}… approved. Tracking: ${orderTab?.tracking_code || savedOrder.tracking_code || 'N/A'}`,
          data: {
            order_id: savedOrder.id,
            tab_id: savedOrder.tab_id ?? undefined,
            tracking_code: orderTab?.tracking_code ?? savedOrder.tracking_code,
          },
        });

        // Emit real-time events
        this.realtimeService.emitOrderUpdated(ctxBranchId, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranchId,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranchId, {
          type: 'order_approved',
          order: savedOrder,
        });

        return savedOrder;
      });
  }
  async decline(
    id: string,
    userId: string,
    dto: DeclineOrderDto,
    branchId?: string,
  ) {
    const { branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
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
          branchId: ctxBranch,
          userId,
          action: 'order.decline',
          entityId: id,
          entityType: 'order',
          payload: { reason: dto.decline_reason },
        });

        return order;
      })
      .then((savedOrder) => {
        // Emit real-time events
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranch, {
          type: 'order_declined',
          order: savedOrder,
        });
        return savedOrder;
      });
  }

  async cancel(id: string, userId: string, reason: string, branchId?: string) {
    const { branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');

        // A delivered/completed item is past the point of no return. Declined and
        // already-cancelled items are left untouched.
        const terminal = [
          OrderStatus.DELIVERED,
          OrderStatus.COMPLETED,
          OrderStatus.DECLINED,
          OrderStatus.CANCELLED,
        ];
        if (terminal.includes(order.order_status as OrderStatus)) {
          throw new BadRequestException(
            `Cannot cancel order with status: ${order.order_status}`,
          );
        }

        order.order_status = OrderStatus.CANCELLED;
        order.cancelled_by = userId;
        order.cancelled_at = new Date();
        order.cancel_reason = reason;

        await manager.getRepository(Order).save(order);

        // Return the stock consumed by this order item.
        await this.ingredientService.reverseOrderConsumption(
          {
            id: order.id,
            menu_item_id: order.menu_item_id,
            quantity: order.quantity,
          },
          ctxBranch,
          manager,
        );

        await this.auditService.log({
          branchId: ctxBranch,
          userId,
          action: 'order.cancel',
          entityId: id,
          entityType: 'order',
          payload: { reason },
        });

        return order;
      })
      .then((savedOrder) => {
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranch, {
          type: 'order_cancelled',
          order: savedOrder,
        });
        return savedOrder;
      });
  }

  async confirmPickup(id: string, userId: string, branchId?: string) {
    const { branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (order.order_status !== OrderStatus.READY_FOR_PICKUP) {
          throw new BadRequestException('Order is not ready for pickup');
        }

        order.order_status = OrderStatus.OUT_FOR_DELIVERY;

        await manager.getRepository(Order).save(order);

        await this.auditService.log({
          branchId: ctxBranch,
          userId,
          action: 'order.confirm_pickup',
          entityId: id,
          entityType: 'order',
        });

        return order;
      })
      .then((savedOrder) => {
        // Emit real-time events
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranch, {
          type: 'order_pickup',
          order: savedOrder,
        });
        return savedOrder;
      });
  }

  async deliver(id: string, userId: string, branchId?: string) {
    const { branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (
          order.order_status !== OrderStatus.READY_FOR_PICKUP &&
          order.order_status !== OrderStatus.OUT_FOR_DELIVERY
        ) {
          throw new BadRequestException('Order is not ready for pickup');
        }

        order.order_status = OrderStatus.DELIVERED;
        order.delivered_by_supervisor = userId;
        order.delivered_at = new Date();

        await manager.getRepository(Order).save(order);

        await this.auditService.log({
          branchId: ctxBranch,
          userId,
          action: 'order.deliver',
          entityId: id,
          entityType: 'order',
        });

        return order;
      })
      .then((savedOrder) => {
        // Emit real-time events
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranch, {
          type: 'order_delivered',
          order: savedOrder,
        });
        return savedOrder;
      });
  }

  /**
   * KDS: chef accepts a dispatched order, moving it from ASSIGNED_TO_DEPARTMENT
   * to PREPARING and stamping the real "cooking started" time (preparing_at).
   * Only relevant for branches with KDS enabled; otherwise order stays APPROVED
   * and the timer cron advances it directly to READY_FOR_PICKUP.
   */
  async accept(id: string, userId: string, branchId?: string) {
    const { branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (order.order_status !== OrderStatus.ASSIGNED_TO_DEPARTMENT) {
          throw new BadRequestException(
            'Order is not dispatched to a department',
          );
        }

        order.order_status = OrderStatus.PREPARING;
        const acceptedAt = new Date();
        order.preparing_at = acceptedAt;
        // KDS: the prep countdown starts when the chef accepts, not at approval.
        order.timer_started_at = acceptedAt;
        order.timer_ends_at = new Date(
          acceptedAt.getTime() +
            (order.estimated_preparation_time_seconds ?? 0) * 1000,
        );

        await manager.getRepository(Order).save(order);

        await this.auditService.log({
          branchId: ctxBranch,
          userId,
          action: 'order.accept',
          entityId: id,
          entityType: 'order',
        });

        return order;
      })
      .then((savedOrder) => {
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );
        this.realtimeService.emitDashboardUpdate(ctxBranch, {
          type: 'order_preparing',
          order: savedOrder,
        });
        return savedOrder;
      });
  }

  /**
   * KDS: chef completes a preparing/dispatched order, moving it to
   * READY_FOR_PICKUP and stamping actual_ready_time. Works from
   * ASSIGNED_TO_DEPARTMENT, PREPARING or APPROVED so a chef can bump even
   * before the passed timer. Safe no-op if already READY (idempotent-ish).
   */
  async bump(id: string, userId: string, branchId?: string) {
    const { tab, branchId: ctxBranch } = await this.getTabForOrder(id, branchId);
    const alphaIds = [id].sort();
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.getRepository(Order).findOne({
          where: { id: alphaIds[0] },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (
          order.order_status !== OrderStatus.ASSIGNED_TO_DEPARTMENT &&
          order.order_status !== OrderStatus.PREPARING &&
          order.order_status !== OrderStatus.APPROVED
        ) {
          throw new BadRequestException('Order cannot be bumped in this state');
        }

        order.order_status = OrderStatus.READY_FOR_PICKUP;
        order.actual_ready_time = new Date();

        await manager.getRepository(Order).save(order);

        await this.auditService.log({
          branchId: ctxBranch,
          userId,
          action: 'order.bump',
          entityId: id,
          entityType: 'order',
        });

        return order;
      })
      .then(async (savedOrder) => {
        // Emit realtime events immediately
        this.realtimeService.emitOrderUpdated(ctxBranch, savedOrder.id, {
          order_status: savedOrder.order_status,
        });
        this.realtimeService.emitOrderStatusChange(
          ctxBranch,
          savedOrder.id,
          savedOrder.order_status,
          savedOrder.tab_id,
        );

        if (savedOrder.tab_id) {
          // Dispatch: if this tab is a dispatch tab, create/broadcast the delivery
          await this.deliveryService.ensureOnOrdersReady(
            tab!.id,
            [savedOrder.id],
          );

          // Buffer notification per tab (flush after 5s)
          const tabId = savedOrder.tab_id;
          const entry = this.orderReadyBuffer.get(tabId);
          if (!entry) {
            this.orderReadyBuffer.set(tabId, {
              orders: [savedOrder],
              timeout: setTimeout(
                () => this.flushOrderReadyBuffer(tabId),
                5000,
              ),
            });
          } else {
            entry.orders.push(savedOrder);
          }
        } else if (savedOrder.tracking_code) {
          // Standalone online dispatch groups create/broadcast the delivery too.
          await this.deliveryService.ensureOnOrdersReady(
            null,
            [savedOrder.id],
            savedOrder.tracking_code,
          );
        }

        return savedOrder;
      });
  }

  private async findGroupedOrdersByBranch(
    branchId: string,
    statuses: string[],
    orderField: string,
    pagination?: { page: number; per_page: number },
    waiterId?: string,
  ) {
    const orderClause =
      orderField === 'created_at'
        ? 'MIN(o.created_at) DESC'
        : 'MIN(o.timer_ends_at) ASC NULLS LAST';

    const params: any[] = [branchId, statuses];
    let waiterClause = '';
    if (waiterId) {
      params.push(waiterId);
      waiterClause = ` AND t.waiter_id = $${params.length}`;
    }

    const baseQuery = `
      FROM orders o
      LEFT JOIN tabs t ON t.id = o.tab_id
      LEFT JOIN tables tbl ON tbl.id = COALESCE(t.table_id, o.table_id)
      LEFT JOIN users w ON w.id = t.waiter_id
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      LEFT JOIN departments d ON d.id = o.assigned_department
      WHERE COALESCE(t.branch_id, o.branch_id) = $1
        AND o.order_status = ANY($2::text[])
        ${waiterClause}
    `;

    const countSql = `SELECT COUNT(DISTINCT COALESCE(o.tab_id::text, o.tracking_code)) AS total ${baseQuery}`;
    const countResult = await this.dataSource.query(countSql, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    let paginationClause = '';
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.per_page;
      paginationClause = `LIMIT ${pagination.per_page} OFFSET ${offset}`;
    }

    const dataSql = `
      SELECT
        COALESCE(o.tab_id::text, o.tracking_code)::text AS "tabId",
        MIN(o.created_at) AS "createdAt",
        t.table_id::text AS "tableId",
        CASE
          WHEN tbl.table_number IS NOT NULL THEN tbl.table_number
          ELSE 'Takeaway'
        END AS "tableNumber",
        t.waiter_id::text AS "waiterId",
        w.full_name AS "waiterName",
        COALESCE(t.tracking_code, o.tracking_code) AS "trackingCode",
        COALESCE(t.tracking_generated_at, MIN(o.created_at)) AS "trackingGeneratedAt",
        COALESCE(t.tab_type::text, MIN(o.tab_type)) AS "tabType",
        COALESCE(t.customer_name, MIN(o.customer_name)) AS "customerName",
        COALESCE(t.party_size, MIN(o.party_size)) AS "partySize",
        COALESCE(t.pickup_mode, MIN(o.pickup_mode)) AS "pickupMode",
        COALESCE(t.delivery_fee_kobo, MIN(o.delivery_fee_kobo)) AS "deliveryFeeKobo",
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
            'roundNumber', o.round_number,
            'notes', o.notes,
            'modifiers', o.modifiers,
            'orderStatus', o.order_status,
            'fulfillmentType', o.fulfillment_type,
            'voiceTranscription', o.voice_transcription,
            'createdBy', o.created_by,
            'approvedBy', o.approved_by,
            'approvedAt', o.approved_at,
            'declinedBy', o.declined_by,
            'declinedAt', o.declined_at,
            'declineReason', o.decline_reason,
            'assignedDepartment', o.assigned_department,
            'estimatedPreparationTimeSeconds', o.estimated_preparation_time_seconds,
            'timerStartedAt', o.timer_started_at,
            'timerEndsAt', o.timer_ends_at,
            'actualReadyTime', o.actual_ready_time,
            'deliveredBySupervisor', o.delivered_by_supervisor,
            'deliveredAt', o.delivered_at,
            'preparingAt', o.preparing_at,
            'createdAt', o.created_at,
            'updatedAt', o.updated_at
          ) ORDER BY o.created_at
        ) AS items
      ${baseQuery}
      GROUP BY COALESCE(o.tab_id::text, o.tracking_code), t.table_id, tbl.table_number, t.waiter_id, w.full_name, t.tracking_code, t.tracking_generated_at, t.tab_type::text, t.customer_name, t.party_size, t.pickup_mode, t.delivery_fee_kobo
      ORDER BY ${orderClause}
      ${paginationClause}
    `;

    const rows = await this.dataSource.query(dataSql, params);
    return { data: rows, total };
  }

  async findPendingByBranch(
    branchId: string,
    userId?: string,
    role?: string,
    pagination?: { page: number; per_page: number },
  ) {
    return this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.PENDING_SUPERVISOR_APPROVAL],
      'created_at',
      pagination,
      role === UserRole.WAITER ? userId : undefined,
    );
  }

  async findPreparingByBranch(branchId: string) {
    const { data } = await this.findGroupedOrdersByBranch(
      branchId,
      [
        OrderStatus.APPROVED,
        OrderStatus.ASSIGNED_TO_DEPARTMENT,
        OrderStatus.PREPARING,
      ],
      'timer_ends_at',
    );
    return data;
  }

  async findReadyForPickupByBranch(branchId: string) {
    const { data } = await this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.READY_FOR_PICKUP],
      'timer_ends_at',
    );
    return data;
  }

  async findPendingCashByBranch(branchId: string) {
    const { data } = await this.findGroupedOrdersByBranch(
      branchId,
      [OrderStatus.PENDING_PAYMENT_APPROVAL],
      'created_at',
    );
    if (!data || data.length === 0) return data;

    // Only tabs with an active cash-intent request have orders "awaiting cash
    // confirmation at the counter". Takeaway orders are HELD in
    // PENDING_PAYMENT_APPROVAL from the moment the customer places them under the
    // prepay policy — surfacing them all would flag every takeaway order as a
    // cash payment before the customer has chosen a method. Filter by the bill so
    // a cash approval only appears once the customer explicitly chooses cash.
    const tabIds = data.map((g: any) => g.tabId);
    // tab_id is a uuid column; tracking codes (which also appear as group keys
    // for tabless orders) must not be passed into it or Postgres raises 22P02.
    const uuidKeys = tabIds.filter((k: string) => UUID_RE.test(k));
    const trackingKeys = tabIds.filter((k: string) => !UUID_RE.test(k));
    const billWhere: FindOptionsWhere<Bill>[] = [];
    if (trackingKeys.length)
      billWhere.push({
        tracking_code: In(trackingKeys),
        payment_status: 'pending_cash',
        voided_at: IsNull(),
      });
    if (uuidKeys.length)
      billWhere.push({
        tab_id: In(uuidKeys),
        payment_status: 'pending_cash',
        voided_at: IsNull(),
      });
    const cashBills = billWhere.length
      ? await this.billRepository.find({ where: billWhere })
      : [];
    const cashKeys = new Set(
      [
        ...cashBills.map((b) => b.tab_id),
        ...cashBills.map((b) => b.tracking_code),
      ].filter((k): k is string => !!k),
    );
    return data.filter((g: any) => cashKeys.has(g.tabId));
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

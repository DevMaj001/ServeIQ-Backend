import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not, IsNull } from 'typeorm';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Table } from '../table/entities/table.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { Review } from '../review/entities/review.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Rider } from '../riders/entities/rider.entity';
import { User } from '../user/entities/user.entity';
import { TrackingService } from '../tracking/tracking.service';
import { RealtimeService } from '../gateway/realtime.service';
import { DeliveryService } from '../delivery/delivery.service';
import { getDeliveryConfig } from '../delivery/delivery-config';
import { getPublicServer } from '../gateway/gateway.constants';
import {
  TabType,
  FulfillmentType,
  OrderStatus,
  PickupMode,
  DeliveryStatus,
  DeliveryDetails,
  isBillable,
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
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(Bill)
    private billRepo: Repository<Bill>,
    @InjectRepository(Delivery)
    private deliveryRepo: Repository<Delivery>,
    @InjectRepository(Rider)
    private riderRepo: Repository<Rider>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Inject(DataSource)
    private dataSource: DataSource,
    private trackingService: TrackingService,
    private realtimeService: RealtimeService,
    private deliveryService: DeliveryService,
  ) {}

  async openTab(dto: {
    branch_id: string;
    table_id?: string;
    customer_name?: string;
    party_size?: number;
    tab_type?: string;
    pickup_mode?: string;
    delivery_details?: Partial<DeliveryDetails>;
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
      await this.tableRepo.update(dto.table_id, { status: 'occupied' as any });
      return this.getTabResponse(savedTab.id);
    }

    // ---- Standalone online order group (takeaway / delivery). No virtual
    // table, no Tab row: the group is identified purely by its tracking code
    // and the denormalized fields carried on its orders. ----
    const pickupMode = dto.pickup_mode || PickupMode.SELF;
    let deliveryDetails: DeliveryDetails | null = null;
    let deliveryFeeKobo = 0;

    if (pickupMode === PickupMode.DISPATCH) {
      const branch = await this.branchRepo.findOne({
        where: { id: dto.branch_id },
      });
      const config = getDeliveryConfig(branch);
      if (!config.enabled) {
        throw new BadRequestException(
          'Dispatch delivery is not enabled at this branch',
        );
      }
      const address = dto.delivery_details?.address?.trim();
      const phone = dto.delivery_details?.phone?.trim();
      if (!address || !phone) {
        throw new BadRequestException(
          'delivery_details.address and delivery_details.phone are required for dispatch',
        );
      }
      const settings = branch?.settings;
      const policy =
        settings && typeof settings === 'object'
          ? settings.takeaway_payment_policy
          : undefined;
      if (policy === 'pay_on_pickup') {
        throw new BadRequestException(
          'Dispatch delivery requires prepayment — pay_on_pickup is not supported',
        );
      }
      deliveryFeeKobo = config.fee_kobo;
      deliveryDetails = {
        full_name: dto.delivery_details?.full_name?.trim() || undefined,
        phone,
        address,
        notes: dto.delivery_details?.notes?.trim() || undefined,
      };
    }

    const trackingCode = await this.trackingService.generateUniqueCode();
    const virtualTable = await this.tableRepo.findOne({
      where: { branch_id: dto.branch_id, is_virtual: true },
    });

    return this.buildGroupResponse(trackingCode, {
      branch_id: dto.branch_id,
      table_id: virtualTable?.id ?? null,
      customer_name: dto.customer_name || 'Guest',
      party_size: dto.party_size || 1,
      pickup_mode: pickupMode,
      delivery_details: deliveryDetails,
      delivery_fee_kobo: deliveryFeeKobo,
    });
  }

  async addItems(
    orderKey: string,
    trackingCode: string,
    items: {
      menu_item_id: string;
      quantity: number;
      notes?: string;
      modifiers?: any[];
    }[],
    meta?: {
      branch_id?: string;
      customer_name?: string;
      party_size?: number;
      pickup_mode?: string;
      delivery_details?: Partial<DeliveryDetails>;
      delivery_fee_kobo?: number;
    },
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: orderKey } });

    if (tab) {
      if (tab.tracking_code !== trackingCode)
        throw new ForbiddenException('Invalid tracking code');
      if (tab.status !== 'open')
        throw new BadRequestException('Tab is not open');
      if (tab.waiter_id !== null)
        throw new BadRequestException('This tab is managed by a waiter');

      return this.addItemsToTab(tab, items);
    }

    // Standalone group: the order key is the tracking code itself.
    if (orderKey !== trackingCode) {
      throw new NotFoundException('Order group not found');
    }
    const existingOrders = await this.orderRepo.find({
      where: { tracking_code: orderKey },
      order: { created_at: 'ASC' },
    });
    const first = existingOrders[0] ?? null;

    const branchId = first?.branch_id ?? meta?.branch_id;
    if (!branchId)
      throw new BadRequestException(
        'branch_id is required when opening a new order group',
      );

    const pickupMode = first?.pickup_mode ?? meta?.pickup_mode ?? PickupMode.SELF;
    if (pickupMode === PickupMode.DISPATCH) {
      const details = (meta?.delivery_details ??
        first?.delivery_details) as DeliveryDetails | null;
      if (!details?.address || !details?.phone) {
        throw new BadRequestException(
          'delivery_details.address and delivery_details.phone are required for dispatch',
        );
      }
    }

    const deliveryFeeKobo =
      first?.delivery_fee_kobo ?? meta?.delivery_fee_kobo ?? 0;

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
      const held = await this.computePrepaid(branchId);

      const branch = await manager.getRepository(Branch).findOne({
        where: { id: branchId },
      });
      const kdsEnabled =
        (branch?.settings?.feature_flags as Record<string, boolean> | undefined)
          ?.kds_enabled === true;
      const kdsDefaultDepartment = kdsEnabled
        ? (branch?.settings?.kds_default_department_id as string) || null
        : null;

      const savedOrders: Order[] = [];
      for (const item of items) {
        const menuItem = menuMap.get(item.menu_item_id)!;
        const modifierTotal = (item.modifiers || []).reduce(
          (sum: number, m: any) => sum + m.price_kobo * m.qty,
          0,
        );
        const cookStatus = held
          ? OrderStatus.PENDING_PAYMENT_APPROVAL
          : kdsEnabled
            ? OrderStatus.ASSIGNED_TO_DEPARTMENT
            : OrderStatus.PENDING_SUPERVISOR_APPROVAL;
        const order = manager.getRepository(Order).create({
          tab_id: null,
          tracking_code: trackingCode,
          branch_id: branchId,
          table_id: first?.table_id ?? null,
          tab_type: TabType.TAKEAWAY,
          status: 'open',
          pickup_mode: pickupMode,
          delivery_details:
            first?.delivery_details ?? (meta?.delivery_details as DeliveryDetails) ?? null,
          delivery_fee_kobo: deliveryFeeKobo,
          customer_name: first?.customer_name ?? meta?.customer_name ?? 'Guest',
          party_size: first?.party_size ?? meta?.party_size ?? 1,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_kobo: menuItem.price_kobo,
          subtotal_kobo: item.quantity * menuItem.price_kobo + modifierTotal,
          round_number: 1,
          created_by: 'self-service',
          notes: item.notes,
          modifiers: item.modifiers,
          fulfillment_type: FulfillmentType.PACK,
          order_status: cookStatus,
          assigned_department:
            cookStatus === OrderStatus.ASSIGNED_TO_DEPARTMENT
              ? kdsDefaultDepartment
              : null,
          estimated_preparation_time_seconds:
            cookStatus === OrderStatus.ASSIGNED_TO_DEPARTMENT
              ? (menuItem.prep_time_seconds ?? null)
              : null,
        });
        savedOrders.push(await manager.getRepository(Order).save(order));
      }
      return savedOrders;
    });

    return {
      tabId: trackingCode,
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

  private async addItemsToTab(
    tab: Tab,
    items: {
      menu_item_id: string;
      quantity: number;
      notes?: string;
      modifiers?: any[];
    }[],
  ) {
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
      const held = await this.isTakeawayPrepaid(tab);

      // KDS-enabled branches send cook items straight to the kitchen queue, even for
      // self-service orders (no waiter to punch them). Held prepaid orders stay held
      // until payment, then release straight to the kitchen in processPayment.
      const branch = await manager.getRepository(Branch).findOne({
        where: { id: tab.branch_id },
      });
      const kdsEnabled =
        (branch?.settings?.feature_flags as Record<string, boolean> | undefined)
          ?.kds_enabled === true;
      const kdsDefaultDepartment = kdsEnabled
        ? (branch?.settings?.kds_default_department_id as string) || null
        : null;

      for (const item of items) {
        const menuItem = menuMap.get(item.menu_item_id)!;
        const modifierTotal = (item.modifiers || []).reduce(
          (sum: number, m: any) => sum + m.price_kobo * m.qty,
          0,
        );
        const cookStatus = held
          ? OrderStatus.PENDING_PAYMENT_APPROVAL
          : kdsEnabled
            ? OrderStatus.ASSIGNED_TO_DEPARTMENT
            : OrderStatus.PENDING_SUPERVISOR_APPROVAL;
        const order = manager.getRepository(Order).create({
          tab_id: tab.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_kobo: menuItem.price_kobo,
          subtotal_kobo: item.quantity * menuItem.price_kobo + modifierTotal,
          round_number: 1,
          created_by: 'self-service',
          notes: item.notes,
          modifiers: item.modifiers,
          fulfillment_type:
            tab.tab_type === TabType.TAKEAWAY
              ? FulfillmentType.PACK
              : FulfillmentType.SERVE,
          order_status: cookStatus,
          assigned_department:
            cookStatus === OrderStatus.ASSIGNED_TO_DEPARTMENT
              ? kdsDefaultDepartment
              : null,
          estimated_preparation_time_seconds:
            cookStatus === OrderStatus.ASSIGNED_TO_DEPARTMENT
              ? (menuItem.prep_time_seconds ?? null)
              : null,
        });
        savedOrders.push(await manager.getRepository(Order).save(order));
      }
      return savedOrders;
    });

    return {
      tabId: tab.id,
      trackingCode: tab.tracking_code,
      orders: orders.map((o) => ({
        id: o.id,
        menu_item_id: o.menu_item_id,
        quantity: o.quantity,
        subtotal_kobo: o.subtotal_kobo,
        order_status: o.order_status,
      })),
    };
  }

  private async computePrepaid(branchId: string): Promise<boolean> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
    });
    const settings = branch?.settings;
    const policy =
      settings && typeof settings === 'object'
        ? settings.takeaway_payment_policy
        : undefined;
    return policy !== 'pay_on_pickup';
  }

  private async isTakeawayPrepaid(tab: Tab): Promise<boolean> {
    if (tab.tab_type !== TabType.TAKEAWAY) return false;
    return this.computePrepaid(tab.branch_id);
  }

  async getTab(orderKey: string, trackingCode: string) {
    const tab = await this.tabRepo.findOne({ where: { id: orderKey } });
    if (tab) {
      if (tab.tracking_code !== trackingCode)
        throw new ForbiddenException('Invalid tracking code');
      return this.getTabResponse(orderKey);
    }
    if (orderKey !== trackingCode)
      throw new NotFoundException('Order group not found');
    return this.buildGroupResponse(trackingCode);
  }

  /** Self-service: the customer confirms they collected the order. This is the
   *  direct replacement for the supervisor's confirm-pickup → deliver dance —
   *  no waiter involvement needed for self-service orders. */
  async confirmReceived(orderKey: string, trackingCode: string) {
    const tab = await this.tabRepo.findOne({ where: { id: orderKey } });
    if (tab) {
      if (tab.tracking_code !== trackingCode)
        throw new ForbiddenException('Invalid tracking code');
      if (tab.status !== 'open' && tab.status !== 'paid')
        throw new BadRequestException('Tab is not open');
      if (tab.waiter_id !== null)
        throw new BadRequestException('This tab is managed by a waiter');
      if (tab.pickup_mode === PickupMode.DISPATCH)
        throw new BadRequestException(
          'Dispatch orders are confirmed by the delivery rider',
        );

      const orders = await this.orderRepo.find({
        where: {
          tab_id: orderKey,
          order_status: In([
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.OUT_FOR_DELIVERY,
          ]),
        },
      });
      if (orders.length === 0) {
        throw new BadRequestException(
          'No orders are ready to be marked as received',
        );
      }

      const now = new Date();
      for (const order of orders) {
        order.order_status = OrderStatus.DELIVERED;
        order.delivered_at = now;
        order.actual_ready_time = order.actual_ready_time || now;
      }
      await this.orderRepo.save(orders);

      this.emitDelivered(orders, tab.branch_id);

      return this.getTabResponse(orderKey);
    }

    // Standalone group
    if (orderKey !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');
    const orders = await this.orderRepo.find({
      where: {
        tracking_code: trackingCode,
        order_status: In([
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.OUT_FOR_DELIVERY,
        ]),
      },
    });
    if (orders.length === 0) {
      throw new BadRequestException(
        'No orders are ready to be marked as received',
      );
    }
    const group = await this.resolveGroupBranch(
      trackingCode,
      orders[0].branch_id!,
    );
    if (group.pickup_mode === PickupMode.DISPATCH)
      throw new BadRequestException(
        'Dispatch orders are confirmed by the delivery rider',
      );

    const now = new Date();
    for (const order of orders) {
      order.order_status = OrderStatus.DELIVERED;
      order.delivered_at = now;
      order.actual_ready_time = order.actual_ready_time || now;
    }
    await this.orderRepo.save(orders);

    this.emitDelivered(orders, group.branch_id);
    getPublicServer()
      ?.to(`tracking:${trackingCode}`)
      .emit('order:status', { trackingCode, order_status: 'delivered' });

    return this.buildGroupResponse(trackingCode);
  }

  private emitDelivered(orders: Order[], branchId: string) {
    for (const order of orders) {
      this.realtimeService.emitOrderUpdated(branchId, order.id, {
        order_status: order.order_status,
      });
      this.realtimeService.emitOrderStatusChange(
        branchId,
        order.id,
        order.order_status,
        order.tab_id,
      );
      this.realtimeService.emitDashboardUpdate(branchId, {
        type: 'order_delivered',
        order,
      });
    }
  }

  private async resolveGroupBranch(trackingCode: string, fallbackBranchId: string) {
    const first = await this.orderRepo.findOne({
      where: { tracking_code: trackingCode },
      order: { created_at: 'ASC' },
    });
    return {
      branch_id: first?.branch_id ?? fallbackBranchId,
      pickup_mode: first?.pickup_mode ?? PickupMode.SELF,
    };
  }

  /** Dispatch: the customer confirms they received the order from the rider.
   *  The rider's "mark handed over" only moves the delivery to HANDED_OVER
   *  (awaiting confirmation); this is the final step that marks it DELIVERED. */
  async confirmDelivery(
    orderKey: string,
    trackingCode: string,
    deliveryId: string,
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: orderKey } });
    if (tab) {
      if (tab.tracking_code !== trackingCode)
        throw new ForbiddenException('Invalid tracking code');
      if (tab.status !== 'open' && tab.status !== 'paid')
        throw new BadRequestException('Tab is not open');
      if (tab.pickup_mode !== PickupMode.DISPATCH)
        throw new BadRequestException('This tab is not a dispatch delivery');

      if (!deliveryId) {
        throw new BadRequestException('delivery_id is required');
      }
      const delivery = await this.deliveryRepo.findOne({
        where: { id: deliveryId },
      });
      if (!delivery || delivery.tab_id !== orderKey)
        throw new NotFoundException('Delivery not found');
      if (delivery.status !== DeliveryStatus.HANDED_OVER) {
        throw new BadRequestException(
          'Delivery is not awaiting your confirmation',
        );
      }

      await this.deliveryService.confirmCustomerDelivery(deliveryId);
      return this.getTabResponse(orderKey);
    }

    // Standalone group: delivery is scoped by tracking code.
    if (orderKey !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');
    if (!deliveryId) throw new BadRequestException('delivery_id is required');
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery || delivery.tracking_code !== trackingCode)
      throw new NotFoundException('Delivery not found');
    if (delivery.status !== DeliveryStatus.HANDED_OVER) {
      throw new BadRequestException(
        'Delivery is not awaiting your confirmation',
      );
    }

    await this.deliveryService.confirmCustomerDelivery(deliveryId);
    return this.buildGroupResponse(trackingCode);
  }

  /** Self-service: customer submits a star rating + optional comment after a
   *  successful payment. Tracked against the order group so it can't be
   *  spammed. */
  async submitReview(
    orderKey: string,
    trackingCode: string,
    body: { rating: number; comment?: string },
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: orderKey } });
    if (tab) {
      if (tab.tracking_code !== trackingCode)
        throw new ForbiddenException('Invalid tracking code');
      if (tab.status !== 'open' && tab.status !== 'paid')
        throw new BadRequestException('Tab is not open');
      return this.saveReview(tab.branch_id, { tabId: tab.id }, body, tab.tracking_code);
    }

    if (orderKey !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');
    const first = await this.orderRepo.findOne({
      where: { tracking_code: trackingCode },
      order: { created_at: 'ASC' },
    });
    if (!first) throw new NotFoundException('Order group not found');
    return this.saveReview(
      first.branch_id!,
      { trackingCode },
      body,
      first.tracking_code,
    );
  }

  private async saveReview(
    branchId: string,
    scope: { tabId?: string; trackingCode?: string },
    body: { rating: number; comment?: string },
    trackingCode: string | null,
  ) {
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException(
        'rating must be an integer between 1 and 5',
      );
    }

    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
    });
    const existing = scope.tabId
      ? await this.reviewRepo.findOne({ where: { tab_id: scope.tabId } })
      : await this.reviewRepo.findOne({
          where: { tracking_code: scope.trackingCode || '' },
        });
    const comment =
      typeof body?.comment === 'string' && body.comment.trim()
        ? body.comment.trim().slice(0, 2000)
        : null;

    let saved: Review;
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      saved = await this.reviewRepo.save(existing);
    } else {
      saved = await this.reviewRepo.save(
        this.reviewRepo.create({
          business_id: branch?.business_id || '',
          branch_id: branchId,
          tab_id: scope.tabId ?? null,
          tracking_code: scope.trackingCode ?? null,
          rating,
          comment,
        }),
      );
    }

    return {
      success: true,
      review: {
        id: saved.id,
        rating: saved.rating,
        comment: saved.comment,
        created_at: saved.created_at,
      },
    };
  }

  private async getTabResponse(tabId: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    const orders = await this.orderRepo.find({
      where: { tab_id: tabId },
      order: { created_at: 'ASC' },
    });

    const menuMap = await this.loadMenuMap(orders);

    // Match the bill exactly: excluded (declined/cancelled) orders never count
    // toward the subtotal, and the total adds service charge + VAT on top.
    const subtotalKobo = orders
      .filter((o) => isBillable(o.order_status))
      .reduce((sum, o) => sum + (o.subtotal_kobo ?? 0), 0);

    const tabBranch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const business = tabBranch
      ? await this.businessRepo.findOne({
          where: { id: tabBranch.business_id },
        })
      : null;
    const serviceChargePercent = Number(business?.service_charge_percent ?? 10);
    const serviceChargeKobo = Math.round(
      subtotalKobo * (serviceChargePercent / 100),
    );
    const taxRatePercent = Number(business?.tax_rate ?? 7.5);
    const taxKobo = Math.round(subtotalKobo * (taxRatePercent / 100));
    const deliveryFeeKobo =
      tab.pickup_mode === PickupMode.DISPATCH
        ? Number(tab.delivery_fee_kobo || 0)
        : 0;
    const totalKobo =
      subtotalKobo + serviceChargeKobo + taxKobo + deliveryFeeKobo;

    const base = {
      id: tab.id,
      tab_id: tab.id,
      is_standalone: false,
      table_id: tab.table_id,
      status: tab.status,
      customer_name: tab.customer_name,
      party_size: tab.party_size,
      tab_type: tab.tab_type,
      pickup_mode: tab.pickup_mode || PickupMode.SELF,
      delivery_details: tab.delivery_details ?? null,
      delivery_fee_kobo: deliveryFeeKobo,
      tracking_code: tab.tracking_code,
      tracking_generated_at: tab.tracking_generated_at,
      opened_at: tab.opened_at,
      currency: business?.currency ?? 'NGN',
      total_kobo: totalKobo,
      subtotal_kobo: subtotalKobo,
      service_charge_kobo: serviceChargeKobo,
      tax_kobo: taxKobo,
      delivery_fee: {
        self: 0,
        dispatch: deliveryFeeKobo,
      },
      service_charge_percent: serviceChargePercent,
      tax_rate_percent: taxRatePercent,
      orders: orders.map((o) => ({
        id: o.id,
        menu_item_id: o.menu_item_id,
        menu_item_name: menuMap.get(o.menu_item_id)?.name || null,
        quantity: o.quantity,
        subtotal_kobo: o.subtotal_kobo,
        order_status: o.order_status,
        notes: o.notes,
        modifiers: o.modifiers,
        created_at: o.created_at,
      })),
    };

    if (tab.pickup_mode === PickupMode.DISPATCH) {
      const active = await this.deliveryRepo.findOne({
        where: {
          tab_id: tabId,
          status: Not(DeliveryStatus.CANCELLED),
        },
        order: { created_at: 'DESC' },
      });
      if (active) {
        (base as any).delivery = await this.riderView(active);
      }
    }

    return this.attachSplitProgress(base, tab, tabId);
  }

  private async buildGroupResponse(
    trackingCode: string,
    meta?: {
      branch_id?: string;
      table_id?: string | null;
      customer_name?: string;
      party_size?: number;
      pickup_mode?: string;
      delivery_details?: DeliveryDetails | null;
      delivery_fee_kobo?: number;
    },
  ) {
    const orders = await this.orderRepo.find({
      where: { tracking_code: trackingCode },
      order: { created_at: 'ASC' },
    });
    const first = orders.length ? orders[0] : null;
    const branchId = first?.branch_id ?? meta?.branch_id;
    const branch = branchId
      ? await this.branchRepo.findOne({ where: { id: branchId } })
      : null;
    const business = branch
      ? await this.businessRepo.findOne({
          where: { id: branch.business_id },
        })
      : null;
    const menuMap = await this.loadMenuMap(orders);

    const subtotalKobo = orders
      .filter((o) => isBillable(o.order_status))
      .reduce((sum, o) => sum + (o.subtotal_kobo ?? 0), 0);
    const serviceChargePercent = Number(business?.service_charge_percent ?? 10);
    const serviceChargeKobo = Math.round(
      subtotalKobo * (serviceChargePercent / 100),
    );
    const taxRatePercent = Number(business?.tax_rate ?? 7.5);
    const taxKobo = Math.round(subtotalKobo * (taxRatePercent / 100));
    const pickupMode =
      first?.pickup_mode ?? meta?.pickup_mode ?? PickupMode.SELF;
    const deliveryFeeKobo =
      pickupMode === PickupMode.DISPATCH
        ? Number(first?.delivery_fee_kobo ?? meta?.delivery_fee_kobo ?? 0)
        : 0;
    const totalKobo =
      subtotalKobo + serviceChargeKobo + taxKobo + deliveryFeeKobo;
    const groupStatus = first
      ? first.status === 'paid'
        ? 'paid'
        : first.status === 'billed'
          ? 'billed'
          : 'open'
      : 'open';

    const base: Record<string, any> = {
      id: trackingCode,
      tab_id: trackingCode,
      is_standalone: true,
      table_id: first?.table_id ?? meta?.table_id ?? null,
      status: groupStatus,
      customer_name: first?.customer_name ?? meta?.customer_name ?? 'Guest',
      party_size: first?.party_size ?? meta?.party_size ?? 1,
      tab_type: TabType.TAKEAWAY,
      pickup_mode: pickupMode,
      delivery_details:
        first?.delivery_details ?? meta?.delivery_details ?? null,
      delivery_fee_kobo: deliveryFeeKobo,
      tracking_code: trackingCode,
      tracking_generated_at: first?.created_at ?? new Date(),
      opened_at: first?.created_at ?? new Date(),
      currency: business?.currency ?? 'NGN',
      total_kobo: totalKobo,
      subtotal_kobo: subtotalKobo,
      service_charge_kobo: serviceChargeKobo,
      tax_kobo: taxKobo,
      delivery_fee: {
        self: 0,
        dispatch: deliveryFeeKobo,
      },
      service_charge_percent: serviceChargePercent,
      tax_rate_percent: taxRatePercent,
      orders: orders.map((o) => ({
        id: o.id,
        menu_item_id: o.menu_item_id,
        menu_item_name: menuMap.get(o.menu_item_id)?.name || null,
        quantity: o.quantity,
        subtotal_kobo: o.subtotal_kobo,
        order_status: o.order_status,
        notes: o.notes,
        modifiers: o.modifiers,
        created_at: o.created_at,
      })),
    };

    if (pickupMode === PickupMode.DISPATCH) {
      const active = await this.deliveryRepo.findOne({
        where: {
          tracking_code: trackingCode,
          status: Not(DeliveryStatus.CANCELLED),
        },
        order: { created_at: 'DESC' },
      });
      if (active) {
        base.delivery = await this.riderView(active);
      }
    }

    return base;
  }

  private async attachSplitProgress(base: Record<string, any>, tab: Tab, tabId: string) {
    if (tab.tab_type !== 'takeaway') {
      const splits = await this.billRepo.find({
        where: {
          tab_id: tabId,
          split_group: Not(IsNull()),
          voided_at: IsNull(),
        },
        order: { sequence: 'ASC' },
      });
      if (splits.length > 0) {
        const sumKobo = splits.reduce((s, b) => s + (b.total_kobo ?? 0), 0);
        const orderTotal = base.total_kobo;
        const off = Math.abs(sumKobo - orderTotal);
        if (off <= 1 || sumKobo === 0) {
          const paid = splits.filter((b) => b.paid_at);
          const paidKobo = paid.reduce(
            (s, b) => s + (b.payment_amount_kobo ?? b.total_kobo ?? 0),
            0,
          );
          return {
            ...base,
            split_payment: {
              total_guests: splits.length,
              paid_guests: paid.length,
              total_kobo: sumKobo,
              paid_kobo: paidKobo,
              remaining_kobo: Math.max(0, sumKobo - paidKobo),
              all_paid: paid.length === splits.length && splits.length > 0,
            },
          };
        }
      }
    }
    return base;
  }

  private async riderView(active: Delivery) {
    let riderName: string | null = null;
    let riderPhone: string | null = null;
    if (active.rider_id) {
      const rider = await this.riderRepo.findOne({
        where: { id: active.rider_id },
      });
      if (rider) {
        const user = await this.userRepo.findOne({
          where: { id: rider.user_id },
        });
        riderName = user?.full_name ?? null;
        riderPhone = user?.phone ?? null;
      }
    }
    return {
      id: active.id,
      status: active.status,
      fee_kobo: active.fee_kobo,
      rider_name: riderName,
      rider_phone: riderPhone,
      accepted_at: active.accepted_at,
      delivered_at: active.delivered_at,
    };
  }

  private async loadMenuMap(orders: Order[]) {
    const menuItemIds = [
      ...new Set(orders.map((o) => o.menu_item_id).filter(Boolean)),
    ];
    const menuItems = menuItemIds.length
      ? await this.menuItemRepo.find({ where: { id: In(menuItemIds) } })
      : [];
    return new Map(menuItems.map((m) => [m.id, m]));
  }
}
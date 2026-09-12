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

    const virtualTable = await this.tableRepo.findOne({
      where: { branch_id: dto.branch_id, is_virtual: true },
    });
    if (!virtualTable) {
      throw new NotFoundException(
        'No counter/takeaway table found for this branch',
      );
    }

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
      pickup_mode: pickupMode,
      delivery_details: deliveryDetails,
      delivery_fee_kobo: deliveryFeeKobo,
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
      modifiers?: any[];
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
          tab_id: tabId,
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

  private async isTakeawayPrepaid(tab: Tab): Promise<boolean> {
    if (tab.tab_type !== TabType.TAKEAWAY) return false;
    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const settings = branch?.settings;
    const policy =
      settings && typeof settings === 'object'
        ? settings.takeaway_payment_policy
        : undefined;
    return policy !== 'pay_on_pickup';
  }

  async getTab(tabId: string, trackingCode: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');

    return this.getTabResponse(tabId);
  }

  /** Self-service: the customer confirms they collected the order. This is the
   *  direct replacement for the supervisor's confirm-pickup → deliver dance —
   *  no waiter involvement needed for self-service orders. */
  async confirmReceived(tabId: string, trackingCode: string) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
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
        tab_id: tabId,
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

    for (const order of orders) {
      this.realtimeService.emitOrderUpdated(tab.branch_id, order.id, {
        order_status: order.order_status,
      });
      this.realtimeService.emitOrderStatusChange(
        tab.branch_id,
        order.id,
        order.order_status,
        tabId,
      );
      this.realtimeService.emitDashboardUpdate(tab.branch_id, {
        type: 'order_delivered',
        order,
      });
    }

    return this.getTabResponse(tabId);
  }

  /** Dispatch: the customer confirms they received the order from the rider.
   *  The rider's "mark handed over" only moves the delivery to HANDED_OVER
   *  (awaiting confirmation); this is the final step that marks it DELIVERED. */
  async confirmDelivery(
    tabId: string,
    trackingCode: string,
    deliveryId: string,
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
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
    if (!delivery || delivery.tab_id !== tabId)
      throw new NotFoundException('Delivery not found');
    if (delivery.status !== DeliveryStatus.HANDED_OVER) {
      throw new BadRequestException(
        'Delivery is not awaiting your confirmation',
      );
    }

    await this.deliveryService.confirmCustomerDelivery(deliveryId);
    return this.getTabResponse(tabId);
  }

  /** Self-service: customer submits a star rating + optional comment after a
   *  successful payment. Tracked against the tab so it can't be spammed. */
  async submitReview(
    tabId: string,
    trackingCode: string,
    body: { rating: number; comment?: string },
  ) {
    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Tab not found');
    if (tab.tracking_code !== trackingCode)
      throw new ForbiddenException('Invalid tracking code');
    if (tab.status !== 'open' && tab.status !== 'paid')
      throw new BadRequestException('Tab is not open');

    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException(
        'rating must be an integer between 1 and 5',
      );
    }

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const existing = await this.reviewRepo.findOne({
      where: { tab_id: tab.id },
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
          branch_id: tab.branch_id,
          tab_id: tab.id,
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

    const menuItemIds = [
      ...new Set(orders.map((o) => o.menu_item_id).filter(Boolean)),
    ];
    const menuItems = menuItemIds.length
      ? await this.menuItemRepo.find({ where: { id: In(menuItemIds) } })
      : [];
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

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

    // Dispatch: surface the live delivery so the customer sees rider assignment
    // and status on the tracking page.
    if (tab.pickup_mode === PickupMode.DISPATCH) {
      const active = await this.deliveryRepo.findOne({
        where: {
          tab_id: tabId,
          status: Not(DeliveryStatus.CANCELLED),
        },
        order: { created_at: 'DESC' },
      });
      if (active) {
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
        (base as any).delivery = {
          id: active.id,
          status: active.status,
          fee_kobo: active.fee_kobo,
          rider_name: riderName,
          rider_phone: riderPhone,
          accepted_at: active.accepted_at,
          delivered_at: active.delivered_at,
        };
      }
    }

    // Include split payment progress so a self-service dine-in customer can see
    // how much of the bill has been settled across guests. Takeaway never
    // splits, but returning it harmlessly for dine-in is what the UI needs.
    //
    // The plan only counts if it reconciles with the LIVE order total. Splits are
    // built over the order set at plan-creation time; if the order has since
    // changed (and the stale plan wasn't voided), the old share totals no longer
    // match and must not be presented as the group balance — that would show a
    // bogus total (e.g. an earlier ₦37,835) next to a now-smaller order.
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
        // Guard against zero/one-off rounding drift and stale totals.
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
}

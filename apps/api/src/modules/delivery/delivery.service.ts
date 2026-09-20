import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Delivery } from './entities/delivery.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import {
  RiderLedger,
  LedgerType,
  LedgerRefType,
  PayoutBatch,
  PayoutBatchStatus,
  PayoutProvider,
} from './entities/rider-payout.entity';
import {
  PickupMode,
  DeliveryStatus,
  DeliveryDetails,
  OrderStatus,
} from '../../common/shared';
import { getDeliveryConfig } from './delivery-config';
import { RealtimeService } from '../gateway/realtime.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { getPublicServer } from '../gateway/gateway.constants';

export interface DeliveryView {
  id: string;
  tab_id: string | null;
  branch_id: string;
  status: string;
  fee_kobo: number;
  payout_kobo: number;
  created_at: Date;
  accepted_at: Date | null;
  delivered_at: Date | null;
  customer_name: string | null;
  delivery_details: DeliveryDetails | null;
  rider_user_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
}

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Delivery)
    private deliveryRepo: Repository<Delivery>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Rider)
    private riderRepo: Repository<Rider>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RiderLedger)
    private ledgerRepo: Repository<RiderLedger>,
    @InjectRepository(PayoutBatch)
    private payoutBatchRepo: Repository<PayoutBatch>,
    private realtimeService: RealtimeService,
    private notificationService: NotificationService,
  ) {}

  private activeStates = [
    DeliveryStatus.PENDING,
    DeliveryStatus.ACCEPTED,
    DeliveryStatus.OUT_FOR_DELIVERY,
    DeliveryStatus.HANDED_OVER,
  ];

  /** Resolve the scope of orders a delivery covers. Tabs scope by tab_id;
   *  standalone (tabless) dispatch groups scope by their shared tracking_code.
   *  Returns the group identity used for socket rooms and order updates. */
  private async groupScope(delivery: Delivery): Promise<{
    tab: Tab | null;
    where: Record<string, string>;
    branchId: string;
    room: string;
    groupId: string | null;
  }> {
    if (delivery.tab_id) {
      const tab = await this.tabRepo.findOne({
        where: { id: delivery.tab_id },
      });
      return {
        tab,
        where: { tab_id: delivery.tab_id },
        branchId: tab?.branch_id ?? delivery.branch_id,
        room: `tab:${delivery.tab_id}`,
        groupId: delivery.tab_id,
      };
    }
    if (delivery.tracking_code) {
      return {
        tab: null,
        where: { tracking_code: delivery.tracking_code },
        branchId: delivery.branch_id,
        room: `tracking:${delivery.tracking_code}`,
        groupId: delivery.tracking_code,
      };
    }
    return {
      tab: null,
      where: {},
      branchId: delivery.branch_id,
      room: '',
      groupId: null,
    };
  }

  /** Flip the status of every order covered by a delivery (tab or standalone
   *  tracking-code group) atomically in one UPDATE. */
  private async setGroupOrderStatus(
    scope: { where: Record<string, string> },
    set: { order_status: OrderStatus; delivered_at?: Date },
    from: OrderStatus[],
  ) {
    const qb = this.orderRepo
      .createQueryBuilder()
      .update(Order)
      .set(set as any);
    for (const key of Object.keys(scope.where)) {
      qb.andWhere(`"${key}" = :val`, { val: scope.where[key] });
    }
    qb.andWhere('order_status IN (:...from)', { from });
    await qb.execute();
  }

  /**
   * Hook called whenever an order (or whole tab) reaches READY_FOR_PICKUP.
   * If the tab is a dispatch tab, ensures a pending delivery exists and
   * broadcasts it to online riders for that branch. Idempotent: re-broadcast
   * only when no active delivery exists for the tab.
   */
  async ensureOnOrdersReady(
    tabId: string | null,
    orderIds: string[],
    trackingCode?: string,
  ) {
    // Standalone online dispatch groups carry their fields on the orders.
    if (!tabId || !trackingCode) {
      if (!orderIds.length) return;
      const first = await this.orderRepo.findOne({
        where: trackingCode
          ? { tracking_code: trackingCode }
          : { id: orderIds[0] },
      });
      if (!first || first.pickup_mode !== PickupMode.DISPATCH) return;
      const branchId = first.branch_id;
      if (!branchId || !first.tracking_code) return;
      trackingCode = first.tracking_code;

      const branch = await this.branchRepo.findOne({
        where: { id: branchId },
      });
      const config = getDeliveryConfig(branch);
      if (!config.enabled || config.fee_kobo <= 0) return;

      const active = await this.deliveryRepo.findOne({
        where: {
          tracking_code: trackingCode,
          status: Not(DeliveryStatus.CANCELLED),
        },
        withDeleted: false,
      });
      let delivery: Delivery;
      if (active) {
        if (active.status !== DeliveryStatus.PENDING) return;
        delivery = active;
      } else {
        try {
          delivery = await this.deliveryRepo.save(
            this.deliveryRepo.create({
              tab_id: null,
              tracking_code: trackingCode,
              branch_id: branchId,
              status: DeliveryStatus.PENDING,
              fee_kobo: first.delivery_fee_kobo || config.fee_kobo,
              payout_kobo: config.rider_payout_kobo,
            }),
          );
        } catch (err: any) {
          if (err?.code === '23505') {
            const existing = await this.deliveryRepo.findOne({
              where: {
                tracking_code: trackingCode,
                status: Not(DeliveryStatus.CANCELLED),
              },
              withDeleted: false,
            });
            if (!existing) return;
            delivery = existing;
          } else {
            throw err;
          }
        }
      }

      const view = await this.toView(delivery);
      this.realtimeService.emitDeliveryAvailable(branchId, {
        ...view,
        order_ids: orderIds,
        pickup_mode: first.pickup_mode,
      });
      this.realtimeService.emitTabUpdate(branchId, trackingCode, {
        delivery: { id: delivery.id, status: delivery.status },
      });
      getPublicServer()
        ?.to(`tracking:${trackingCode}`)
        .emit('delivery:status', {
          tabId: trackingCode,
          delivery_id: delivery.id,
          status: delivery.status,
        });

      await this.notifyOnlineRiders(branchId, {
        type: NotificationType.DELIVERY_AVAILABLE,
        title: 'New delivery available',
        message: `Order ${orderIds
          .map((oid) => oid.slice(0, 8))
          .join(', ')} is ready for dispatch`,
        data: {
          delivery_id: delivery.id,
          tab_id: null,
          tracking_code: trackingCode,
          order_ids: orderIds,
        },
      });
      return;
    }

    const tab = await this.tabRepo.findOne({ where: { id: tabId } });
    if (!tab) return;
    if (tab.pickup_mode !== PickupMode.DISPATCH) return;

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const config = getDeliveryConfig(branch);
    if (!config.enabled || config.fee_kobo <= 0) return;

    const active = await this.deliveryRepo.findOne({
      where: { tab_id: tabId, status: Not(DeliveryStatus.CANCELLED) },
      withDeleted: false,
    });
    let delivery: Delivery;
    if (active) {
      if (active.status !== DeliveryStatus.PENDING) return;
      delivery = active;
    } else {
      try {
        delivery = await this.deliveryRepo.save(
          this.deliveryRepo.create({
            tab_id: tabId,
            branch_id: tab.branch_id,
            status: DeliveryStatus.PENDING,
            fee_kobo: tab.delivery_fee_kobo || config.fee_kobo,
            payout_kobo: config.rider_payout_kobo,
          }),
        );
      } catch (err: any) {
        if (err?.code === '23505') {
          // concurrent creation race — someone else just made it
          const existing = await this.deliveryRepo.findOne({
            where: { tab_id: tabId, status: Not(DeliveryStatus.CANCELLED) },
            withDeleted: false,
          });
          if (!existing) return;
          delivery = existing;
        } else {
          throw err;
        }
      }
    }

    const view = await this.toView(delivery);
    this.realtimeService.emitDeliveryAvailable(tab.branch_id, {
      ...view,
      order_ids: orderIds,
      pickup_mode: tab.pickup_mode,
    });
    this.realtimeService.emitTabUpdate(tab.branch_id, tabId, {
      delivery: {
        id: delivery.id,
        status: delivery.status,
      },
    });
    getPublicServer()?.to(`tab:${tabId}`).emit('delivery:status', {
      tabId,
      delivery_id: delivery.id,
      status: delivery.status,
    });

    // In-app notifications to online riders
    await this.notifyOnlineRiders(tab.branch_id, {
      type: NotificationType.DELIVERY_AVAILABLE,
      title: 'New delivery available',
      message: `Order ${orderIds
        .map((oid) => oid.slice(0, 8))
        .join(', ')} is ready for dispatch`,
      data: {
        delivery_id: delivery.id,
        tab_id: tabId,
        order_ids: orderIds,
      },
    });
  }

  /** Rider accepts an available delivery. First-accept wins via atomic update. */
  async accept(deliveryId: string, rider: Rider) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.branch_id !== rider.branch_id)
      throw new ForbiddenException('Delivery is for a different branch');
    if (delivery.status !== DeliveryStatus.PENDING)
      throw new BadRequestException('Delivery is no longer available');

    const result = await this.deliveryRepo
      .createQueryBuilder()
      .update(Delivery)
      .set({
        status: DeliveryStatus.ACCEPTED,
        rider_id: rider.id,
        accepted_at: new Date(),
      })
      .where('id = :id', { id: deliveryId })
      .andWhere('status = :pending', { pending: DeliveryStatus.PENDING })
      .execute();

    if (!result.affected || result.affected !== 1) {
      throw new BadRequestException(
        'Delivery was just accepted by another rider',
      );
    }

    const scope = await this.groupScope(delivery);
    await this.setGroupOrderStatus(
      scope,
      { order_status: OrderStatus.OUT_FOR_DELIVERY },
      [OrderStatus.READY_FOR_PICKUP],
    );
    for (const order of await this.orderRepo.find({
      where: {
        ...scope.where,
        order_status: OrderStatus.OUT_FOR_DELIVERY,
      },
    })) {
      this.realtimeService.emitOrderUpdated(scope.branchId, order.id, {
        order_status: order.order_status,
      });
    }

    const updated = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!updated) throw new NotFoundException('Delivery not found');
    const view = await this.toView(updated);
    this.realtimeService.emitDeliveryUpdated(delivery.branch_id, view);
    if (scope.room) {
      this.realtimeService.emitTabUpdate(scope.branchId, scope.groupId!, {
        delivery: { id: updated.id, status: updated.status },
      });
      getPublicServer()?.to(scope.room).emit('delivery:status', {
        tabId: scope.groupId,
        delivery_id: updated.id,
        status: updated.status,
      });
    }
    return view;
  }

  /** Rider hands the order over to the customer. This does NOT immediately mark
   *  it DELIVERED — it moves to HANDED_OVER (awaiting confirmation). The final
   *  DELIVERED transition happens in DeliveryService.confirmCustomerDelivery()
   *  once the customer confirms receipt on their tracking page. */
  async complete(deliveryId: string, rider: Rider) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.rider_id !== rider.id)
      throw new ForbiddenException('You are not assigned to this delivery');
    if (
      delivery.status !== DeliveryStatus.ACCEPTED &&
      delivery.status !== DeliveryStatus.OUT_FOR_DELIVERY
    ) {
      throw new BadRequestException(
        'Delivery cannot be completed in this state',
      );
    }

    await this.deliveryRepo.update(deliveryId, {
      status: DeliveryStatus.HANDED_OVER,
    });

    // Orders stay OUT_FOR_DELIVERY until the customer confirms receipt; only
    // then are they finalised to DELIVERED.
    const updated = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!updated) throw new NotFoundException('Delivery not found');
    const view = await this.toView(updated);
    this.realtimeService.emitDeliveryUpdated(delivery.branch_id, view);
    const scope = await this.groupScope(delivery);
    if (scope.room) {
      this.realtimeService.emitTabUpdate(scope.branchId, scope.groupId!, {
        delivery: { id: updated.id, status: updated.status },
      });
      getPublicServer()?.to(scope.room).emit('delivery:status', {
        tabId: scope.groupId,
        delivery_id: updated.id,
        status: updated.status,
      });
    }
    return view;
  }

  /** The customer confirms receipt on the tracking page. This is the final step
   *  that marks the delivery + its orders DELIVERED, completing the dispatch. */
  async confirmCustomerDelivery(deliveryId: string) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== DeliveryStatus.HANDED_OVER) {
      throw new BadRequestException(
        'Delivery is not awaiting customer confirmation',
      );
    }

    await this.deliveryRepo.update(deliveryId, {
      status: DeliveryStatus.DELIVERED,
      delivered_at: new Date(),
    });

    const scope = await this.groupScope(delivery);
    if (Object.keys(scope.where).length > 0) {
      const now = new Date();
      await this.setGroupOrderStatus(
        scope,
        { order_status: OrderStatus.DELIVERED, delivered_at: now },
        [OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY],
      );
      for (const order of await this.orderRepo.find({
        where: {
          ...scope.where,
          order_status: OrderStatus.DELIVERED,
        },
      })) {
        this.realtimeService.emitOrderUpdated(scope.branchId, order.id, {
          order_status: order.order_status,
        });
        this.realtimeService.emitDashboardUpdate(scope.branchId, {
          type: 'order_delivered',
          order,
        });
      }
    }

    const updated = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!updated) throw new NotFoundException('Delivery not found');
    const view = await this.toView(updated);
    this.realtimeService.emitDeliveryUpdated(delivery.branch_id, view);
    if (scope.room) {
      this.realtimeService.emitTabUpdate(scope.branchId, scope.groupId!, {
        delivery: { id: updated.id, status: updated.status },
      });
      getPublicServer()?.to(scope.room).emit('delivery:status', {
        tabId: scope.groupId,
        delivery_id: updated.id,
        status: updated.status,
      });
    }
    return view;
  }

  /**
   * Manager reassigns a delivery: cancels the current active delivery and
   * creates a fresh pending one (re-broadcast to riders). Returns the new one.
   */
  async reassign(deliveryId: string, branchId: string, userId: string) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.branch_id !== branchId)
      throw new ForbiddenException('Delivery belongs to another branch');
    if (
      delivery.status === DeliveryStatus.DELIVERED ||
      delivery.status === DeliveryStatus.CANCELLED
    ) {
      throw new BadRequestException('Delivery is already finished');
    }

    const scope = await this.groupScope(delivery);
    if (!scope.tab && !scope.where.tracking_code)
      throw new NotFoundException('Delivery has no resolvable order group');

    await this.deliveryRepo.update(deliveryId, {
      status: DeliveryStatus.CANCELLED,
      cancelled_at: new Date(),
    });

    const branch = await this.branchRepo.findOne({
      where: { id: delivery.branch_id },
    });
    const config = getDeliveryConfig(branch);
    const baseOrder = scope.tab
      ? null
      : await this.orderRepo.findOne({
          where: { tracking_code: delivery.tracking_code as string },
        });
    const next = await this.deliveryRepo.save(
      this.deliveryRepo.create({
        tab_id: scope.tab?.id ?? null,
        tracking_code: scope.tab ? null : (delivery.tracking_code ?? null),
        branch_id: delivery.branch_id,
        status: DeliveryStatus.PENDING,
        fee_kobo:
          scope.tab?.delivery_fee_kobo ||
          baseOrder?.delivery_fee_kobo ||
          config.fee_kobo,
        payout_kobo: config.rider_payout_kobo,
      }),
    );

    const orders = await this.orderRepo.find({ where: scope.where });
    const readyIds = orders
      .filter((o) => o.order_status === OrderStatus.READY_FOR_PICKUP)
      .map((o) => o.id);
    const view = await this.toView(next);
    this.realtimeService.emitDeliveryAvailable(delivery.branch_id, {
      ...view,
      order_ids: readyIds,
    });
    await this.notifyOnlineRiders(delivery.branch_id, {
      type: NotificationType.DELIVERY_AVAILABLE,
      title: 'Delivery re-broadcast',
      message: `Order ${delivery.tracking_code || delivery.tab_id?.slice(0, 8)}… is ready for a new rider`,
      data: {
        delivery_id: next.id,
        tab_id: scope.tab?.id ?? null,
        tracking_code: delivery.tracking_code ?? null,
      },
    });
    return view;
  }

  /** Active deliveries a rider can accept for their branch + their own jobs. */
  async listForRider(rider: Rider) {
    const jobs = await this.deliveryRepo.find({
      where: { branch_id: rider.branch_id },
    });
    const filtered = jobs.filter(
      (d) => d.status === DeliveryStatus.PENDING || d.rider_id === rider.id,
    );
    const views: DeliveryView[] = [];
    for (const d of filtered) views.push(await this.toView(d));
    views.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return views;
  }

  async listMine(rider: Rider) {
    const jobs = await this.deliveryRepo.find({
      where: { rider_id: rider.id, status: Not(DeliveryStatus.CANCELLED) },
      order: { created_at: 'DESC' },
    });
    return Promise.all(jobs.map((d) => this.toView(d)));
  }

  async listByBranch(
    caller: { businessId: string; isSuperAdmin?: boolean },
    branchId: string,
    status?: string,
  ) {
    // The branch id may come from a query param; a caller may only read
    // branches of their own business.
    if (!caller.isSuperAdmin) {
      const branch = await this.branchRepo.findOne({
        where: { id: branchId, business_id: caller.businessId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }
    const where: any = { branch_id: branchId };
    if (status) where.status = status;
    const jobs = await this.deliveryRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
    return Promise.all(jobs.slice(0, 200).map((d) => this.toView(d)));
  }

  async activeForTab(tabId: string): Promise<Delivery | null> {
    return this.deliveryRepo.findOne({
      where: {
        tab_id: tabId,
        status: Not(DeliveryStatus.CANCELLED),
        delivered_at: IsNull(),
      },
    });
  }

  async notifyOnlineRiders(
    branchId: string,
    payload: {
      type: NotificationType;
      title: string;
      message: string;
      data?: Record<string, any>;
    },
  ) {
    const riders = await this.riderRepo.find({
      where: { branch_id: branchId, is_online: true },
    });
    for (const rider of riders) {
      try {
        await this.notificationService.create({
          branch_id: branchId,
          user_id: rider.user_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data ?? {},
        });
      } catch (err) {
        console.warn(
          `Delivery notification failed for rider ${rider.user_id}: ${err?.message ?? err}`,
        );
      }
    }
  }

  private async toView(delivery: Delivery): Promise<DeliveryView> {
    let tab: Tab | null = null;
    if (delivery.tab_id) {
      tab = await this.tabRepo.findOne({ where: { id: delivery.tab_id } });
    }
    // Standalone groups carry customer/pickup metadata on their orders.
    let orderCustomerName: string | null = null;
    let orderDeliveryDetails: DeliveryDetails | null = null;
    if (!tab && delivery.tracking_code) {
      const firstOrder = await this.orderRepo.findOne({
        where: { tracking_code: delivery.tracking_code },
        order: { created_at: 'ASC' },
      });
      orderCustomerName = firstOrder?.customer_name ?? null;
      orderDeliveryDetails = firstOrder?.delivery_details ?? null;
    }
    let riderName: string | null = null;
    let riderUserId: string | null = null;
    let riderPhone: string | null = null;
    if (delivery.rider_id) {
      const rider = await this.riderRepo.findOne({
        where: { id: delivery.rider_id },
      });
      if (rider) {
        riderUserId = rider.user_id;
        const user = await this.userRepo.findOne({
          where: { id: rider.user_id },
        });
        riderName = user?.full_name ?? null;
        riderPhone = user?.phone ?? null;
      }
    }
    return {
      id: delivery.id,
      tab_id: delivery.tab_id,
      branch_id: delivery.branch_id,
      status: delivery.status,
      fee_kobo: delivery.fee_kobo,
      payout_kobo: delivery.payout_kobo,
      created_at: delivery.created_at,
      accepted_at: delivery.accepted_at,
      delivered_at: delivery.delivered_at,
      customer_name: tab?.customer_name ?? orderCustomerName,
      delivery_details: tab?.delivery_details ?? orderDeliveryDetails,
      rider_user_id: riderUserId,
      rider_name: riderName,
      rider_phone: riderPhone,
    };
  }

  /** The rider must belong to the caller's business — rider ids arrive from
   *  route params and are otherwise a cross-tenant oracle. */
  private async requireRiderInBusiness(
    riderId: string,
    businessId: string,
  ): Promise<Rider> {
    const rider = await this.riderRepo.findOne({
      where: { id: riderId, business_id: businessId },
    });
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  /** Get all unpaid (pending payout) deliveries for a rider */
  async getPendingPayouts(
    riderId: string,
    businessId: string,
  ): Promise<{
    deliveries: Delivery[];
    totalPayoutKobo: number;
  }> {
    await this.requireRiderInBusiness(riderId, businessId);
    const deliveries = await this.deliveryRepo.find({
      where: {
        rider_id: riderId,
        status: DeliveryStatus.DELIVERED,
        payout_status: 'pending',
      },
      order: { delivered_at: 'ASC' },
    });
    const totalPayoutKobo = deliveries.reduce(
      (sum, d) => sum + (d.payout_kobo || 0),
      0,
    );
    return { deliveries, totalPayoutKobo };
  }

  /** Get pending payout summary for all riders in a branch */
  async getPendingPayoutsByBranch(branchId: string): Promise<
    Array<{
      riderId: string;
      riderName: string;
      pendingDeliveries: number;
      totalPayoutKobo: number;
    }>
  > {
    const pendingDeliveries = await this.deliveryRepo
      .createQueryBuilder('d')
      .select('d.rider_id', 'riderId')
      .addSelect('COUNT(*)', 'pendingDeliveries')
      .addSelect('SUM(d.payout_kobo)', 'totalPayoutKobo')
      .where('d.branch_id = :branchId', { branchId })
      .andWhere('d.status = :status', { status: DeliveryStatus.DELIVERED })
      .andWhere('d.payout_status = :payoutStatus', { payoutStatus: 'pending' })
      .groupBy('d.rider_id')
      .getRawMany();

    const riderIds = pendingDeliveries.map((r) => r.riderId);
    const riders = riderIds.length
      ? await this.riderRepo.find({ where: { id: In(riderIds) } })
      : [];
    const riderMap = new Map(riders.map((r) => [r.id, r]));
    const userIds = riders.map((r) => r.user_id);
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return pendingDeliveries.map((r) => {
      const rider = riderMap.get(r.riderId);
      return {
        riderId: r.riderId,
        riderName: rider
          ? (userMap.get(rider.user_id)?.full_name ?? 'Unknown')
          : 'Unknown',
        pendingDeliveries: Number(r.pendingDeliveries),
        totalPayoutKobo: Number(r.totalPayoutKobo || 0),
      };
    });
  }

  /**
   * Process payout for a rider: marks pending deliveries as paid,
   * creates ledger entries, and creates a payout batch record.
   * Does NOT execute the actual bank transfer — that's done separately
   * via Paystack/Flutterwave integration using the payout_batch record.
   */
  async processRiderPayout(
    riderId: string,
    businessId: string,
    adminUserId: string,
    provider: PayoutProvider = PayoutProvider.MANUAL,
    providerBatchId?: string,
  ): Promise<{
    batch: PayoutBatch;
    deliveriesPaid: number;
    totalKobo: number;
  }> {
    const rider = await this.riderRepo.findOne({
      where: { id: riderId, business_id: businessId },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    // Everything below is one transaction, and the FIRST step is an atomic
    // claim: a conditional UPDATE flips only still-pending deliveries to
    // 'paid'. A concurrent payout run claims zero rows and errors out, and a
    // mid-way crash rolls the claim back — the batch, the ledger rows, and
    // the delivery flags can never disagree. (Previously this was
    // read-then-write with no transaction: two concurrent runs paid the
    // same deliveries twice.)
    return this.deliveryRepo.manager.transaction(async (manager) => {
      const candidates = await manager.getRepository(Delivery).find({
        where: {
          rider_id: riderId,
          status: DeliveryStatus.DELIVERED,
          payout_status: 'pending',
        },
        order: { delivered_at: 'ASC' },
      });
      if (candidates.length === 0) {
        throw new BadRequestException('No pending payouts for this rider');
      }

      const claim = await manager
        .createQueryBuilder()
        .update(Delivery)
        .set({ payout_status: 'paid', paid_at: new Date() })
        .where('id IN (:...ids)', { ids: candidates.map((d) => d.id) })
        .andWhere(`payout_status = 'pending'`)
        .returning(['id', 'payout_kobo'])
        .execute();
      const claimed: Array<{ id: string; payout_kobo: number }> =
        claim.raw ?? [];
      if (claimed.length === 0) {
        throw new BadRequestException('No pending payouts for this rider');
      }
      const totalPayoutKobo = claimed.reduce(
        (sum, d) => sum + Number(d.payout_kobo || 0),
        0,
      );

      const batch = await manager.getRepository(PayoutBatch).save(
        manager.getRepository(PayoutBatch).create({
          business_id: businessId,
          rider_id: riderId,
          provider,
          provider_batch_id: providerBatchId ?? null,
          total_kobo: totalPayoutKobo,
          status: PayoutBatchStatus.PENDING,
          created_by: adminUserId,
        }),
      );

      // Ledger rows are built ONLY from the rows this run actually claimed.
      const ledgerRepo = manager.getRepository(RiderLedger);
      for (const delivery of claimed) {
        await ledgerRepo.save(
          ledgerRepo.create({
            rider_id: riderId,
            business_id: businessId,
            type: LedgerType.DELIVERY_EARNING,
            amount_kobo: Number(delivery.payout_kobo || 0),
            ref_type: LedgerRefType.DELIVERY,
            ref_id: delivery.id,
            description: `Delivery ${delivery.id.slice(0, 8)} earnings`,
          }),
        );
      }

      await ledgerRepo.save(
        ledgerRepo.create({
          rider_id: riderId,
          business_id: businessId,
          type: LedgerType.PAYOUT,
          amount_kobo: -totalPayoutKobo,
          ref_type: LedgerRefType.BATCH_PAYOUT,
          ref_id: batch.id,
          description: `Payout batch ${batch.id.slice(0, 8)}`,
        }),
      );

      return {
        batch,
        deliveriesPaid: claimed.length,
        totalKobo: totalPayoutKobo,
      };
    });
  }

  /** Mark a payout batch as completed (after successful bank transfer) */
  async completePayoutBatch(
    batchId: string,
    businessId: string,
    providerBatchId: string,
  ): Promise<PayoutBatch> {
    const batch = await this.payoutBatchRepo.findOne({
      where: { id: batchId, business_id: businessId },
    });
    if (!batch) throw new NotFoundException('Payout batch not found');
    if (batch.status !== PayoutBatchStatus.PENDING) {
      throw new BadRequestException(`Batch is already ${batch.status}`);
    }
    batch.status = PayoutBatchStatus.COMPLETED;
    batch.provider_batch_id = providerBatchId;
    batch.completed_at = new Date();
    await this.payoutBatchRepo.save(batch);
    return batch;
  }

  /** Mark a payout batch as failed */
  async failPayoutBatch(
    batchId: string,
    businessId: string,
    reason: string,
  ): Promise<PayoutBatch> {
    const batch = await this.payoutBatchRepo.findOne({
      where: { id: batchId, business_id: businessId },
    });
    if (!batch) throw new NotFoundException('Payout batch not found');
    // A COMPLETED batch means the bank transfer already happened — flipping
    // it to FAILED would make its deliveries look payable again.
    if (
      batch.status !== PayoutBatchStatus.PENDING &&
      batch.status !== PayoutBatchStatus.PROCESSING
    ) {
      throw new BadRequestException(`Batch is already ${batch.status}`);
    }
    batch.status = PayoutBatchStatus.FAILED;
    batch.failure_reason = reason;
    await this.payoutBatchRepo.save(batch);
    return batch;
  }

  /** Get ledger entries for a rider */
  async getRiderLedger(
    riderId: string,
    businessId: string,
    limit = 100,
  ): Promise<RiderLedger[]> {
    await this.requireRiderInBusiness(riderId, businessId);
    return this.ledgerRepo.find({
      where: { rider_id: riderId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /** Get payout batches for a rider */
  async getRiderPayoutBatches(
    riderId: string,
    businessId: string,
    limit = 50,
  ): Promise<PayoutBatch[]> {
    await this.requireRiderInBusiness(riderId, businessId);
    return this.payoutBatchRepo.find({
      where: { rider_id: riderId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /** Get payout batches for a business (admin view) */
  async getBusinessPayoutBatches(
    businessId: string,
    limit = 100,
  ): Promise<PayoutBatch[]> {
    return this.payoutBatchRepo.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}

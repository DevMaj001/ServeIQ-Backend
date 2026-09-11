import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Delivery } from './entities/delivery.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
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
  tab_id: string;
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
    private realtimeService: RealtimeService,
    private notificationService: NotificationService,
  ) {}

  private activeStates = [
    DeliveryStatus.PENDING,
    DeliveryStatus.ACCEPTED,
    DeliveryStatus.OUT_FOR_DELIVERY,
  ];

  /**
   * Hook called whenever an order (or whole tab) reaches READY_FOR_PICKUP.
   * If the tab is a dispatch tab, ensures a pending delivery exists and
   * broadcasts it to online riders for that branch. Idempotent: re-broadcast
   * only when no active delivery exists for the tab.
   */
  async ensureOnOrdersReady(tabId: string, orderIds: string[]) {
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

    const tab = await this.tabRepo.findOne({ where: { id: delivery.tab_id } });
    if (tab) {
      await this.orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({ order_status: OrderStatus.OUT_FOR_DELIVERY })
        .where('tab_id = :tabId', { tabId: tab.id })
        .andWhere('order_status = :ready', {
          ready: OrderStatus.READY_FOR_PICKUP,
        })
        .execute();
      for (const order of await this.orderRepo.find({
        where: { tab_id: tab.id, order_status: OrderStatus.OUT_FOR_DELIVERY },
      })) {
        this.realtimeService.emitOrderUpdated(tab.branch_id, order.id, {
          order_status: order.order_status,
        });
      }
    }

    const updated = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!updated) throw new NotFoundException('Delivery not found');
    const view = await this.toView(updated);
    this.realtimeService.emitDeliveryUpdated(delivery.branch_id, view);
    if (tab) {
      this.realtimeService.emitTabUpdate(tab.branch_id, tab.id, {
        delivery: { id: updated.id, status: updated.status },
      });
      getPublicServer()?.to(`tab:${tab.id}`).emit('delivery:status', {
        tabId: tab.id,
        delivery_id: updated.id,
        status: updated.status,
      });
    }
    return view;
  }

  /** Rider confirms the order was handed over to the customer. */
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
      status: DeliveryStatus.DELIVERED,
      delivered_at: new Date(),
    });

    const tab = await this.tabRepo.findOne({ where: { id: delivery.tab_id } });
    if (tab) {
      const now = new Date();
      await this.orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({ order_status: OrderStatus.DELIVERED, delivered_at: now })
        .where('tab_id = :tabId', { tabId: tab.id })
        .andWhere('order_status IN (:...statuses)', {
          statuses: [
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        })
        .execute();
      for (const order of await this.orderRepo.find({
        where: { tab_id: tab.id, order_status: OrderStatus.DELIVERED },
      })) {
        this.realtimeService.emitOrderUpdated(tab.branch_id, order.id, {
          order_status: order.order_status,
        });
        this.realtimeService.emitDashboardUpdate(tab.branch_id, {
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
    if (tab) {
      this.realtimeService.emitTabUpdate(tab.branch_id, tab.id, {
        delivery: { id: updated.id, status: updated.status },
      });
      getPublicServer()?.to(`tab:${tab.id}`).emit('delivery:status', {
        tabId: tab.id,
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

    const tab = await this.tabRepo.findOne({ where: { id: delivery.tab_id } });
    if (!tab) throw new NotFoundException('Tab not found');

    await this.deliveryRepo.update(deliveryId, {
      status: DeliveryStatus.CANCELLED,
      cancelled_at: new Date(),
    });

    const branch = await this.branchRepo.findOne({
      where: { id: tab.branch_id },
    });
    const config = getDeliveryConfig(branch);
    const next = await this.deliveryRepo.save(
      this.deliveryRepo.create({
        tab_id: tab.id,
        branch_id: tab.branch_id,
        status: DeliveryStatus.PENDING,
        fee_kobo: tab.delivery_fee_kobo || config.fee_kobo,
        payout_kobo: config.rider_payout_kobo,
      }),
    );

    const orders = await this.orderRepo.find({ where: { tab_id: tab.id } });
    const readyIds = orders
      .filter((o) => o.order_status === OrderStatus.READY_FOR_PICKUP)
      .map((o) => o.id);
    const view = await this.toView(next);
    this.realtimeService.emitDeliveryAvailable(tab.branch_id, {
      ...view,
      order_ids: readyIds,
    });
    await this.notifyOnlineRiders(tab.branch_id, {
      type: NotificationType.DELIVERY_AVAILABLE,
      title: 'Delivery re-broadcast',
      message: `Order ${tab.id.slice(0, 8)}… is ready for a new rider`,
      data: { delivery_id: next.id, tab_id: tab.id },
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

  async listByBranch(branchId: string, status?: string) {
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
    const tab = await this.tabRepo.findOne({ where: { id: delivery.tab_id } });
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
      customer_name: tab?.customer_name ?? null,
      delivery_details: tab?.delivery_details ?? null,
      rider_user_id: riderUserId,
      rider_name: riderName,
      rider_phone: riderPhone,
    };
  }
}

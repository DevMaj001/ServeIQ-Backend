import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { OrderStatus } from '../../common/shared';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { DeliveryService } from '../delivery/delivery.service';

@Injectable()
export class OrderScheduler {
  private readonly logger = new Logger(OrderScheduler.name);

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    private notificationService: NotificationService,
    private deliveryService: DeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireOrderTimers() {
    const now = new Date();

    const expired = await this.orderRepo.find({
      where: {
        order_status: In([
          OrderStatus.APPROVED,
          OrderStatus.ASSIGNED_TO_DEPARTMENT,
          OrderStatus.PREPARING,
        ]),
        timer_ends_at: LessThanOrEqual(now),
      },
    });

    if (expired.length === 0) return;

    for (const order of expired) {
      order.order_status = OrderStatus.READY_FOR_PICKUP;
      order.actual_ready_time = now;
    }

    await this.orderRepo.save(expired);

    const tabIds = [...new Set(expired.map((o) => o.tab_id))];
    const tabs = await this.tabRepo.find({ where: { id: In(tabIds) } });
    const tabById = new Map(tabs.map((t) => [t.id, t]));

    // Group expired orders by tab and send one notification per tab
    const byTab = new Map<string, Order[]>();
    for (const order of expired) {
      const arr = byTab.get(order.tab_id) ?? [];
      arr.push(order);
      byTab.set(order.tab_id, arr);
    }

    for (const [tabId, orders] of byTab) {
      const tab = tabById.get(tabId);
      if (!tab) continue;

      const orderIds = orders.map((o) => o.id);
      const count = orders.length;
      await this.notificationService.create({
        branch_id: tab.branch_id,
        user_id: tab.waiter_id ?? null,
        type: NotificationType.ORDER_READY,
        title: 'Orders Ready for Pickup',
        message:
          count === 1
            ? `Order ${orders[0].id.slice(0, 8)}… is ready`
            : `${count} orders ready (${orderIds.map((id) => id.slice(0, 8)).join(', ')})`,
        data: {
          order_ids: orderIds,
          tab_id: tabId,
          count,
        },
      });

      // Dispatch: if this is a dispatch tab, create/broadcast the delivery
      // to online riders for the branch.
      await this.deliveryService.ensureOnOrdersReady(tabId, orderIds);

      this.logger.log(
        `Tab ${tabId}: ${count} orders timer expired → ready_for_pickup`,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { OrderStatus } from '../../common/shared';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class OrderScheduler {
  private readonly logger = new Logger(OrderScheduler.name);

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Tab)
    private tabRepo: Repository<Tab>,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireOrderTimers() {
    const now = new Date();

    const expired = await this.orderRepo.find({
      where: {
        order_status: OrderStatus.APPROVED,
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
    const branchByTab = new Map(tabs.map((t) => [t.id, t.branch_id]));

    for (const order of expired) {
      const branchId = branchByTab.get(order.tab_id);
      if (!branchId) continue;

      await this.notificationService.create({
        branch_id: branchId,
        type: NotificationType.ORDER_READY,
        title: 'Order Ready for Pickup',
        message: `Order ${order.id.slice(0, 8)}… is ready`,
        data: { order_id: order.id, tab_id: order.tab_id },
      });

      this.logger.log(
        `Order ${order.id}: timer expired → ready_for_pickup, notification sent`,
      );
    }
  }
}

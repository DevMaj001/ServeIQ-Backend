import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './entities/delivery.entity';
import { RiderLedger, PayoutBatch } from './entities/rider-payout.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { RiderModule } from '../riders/rider.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, Tab, Order, Rider, Branch, User, RiderLedger, PayoutBatch]),
    RiderModule,
    NotificationModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}

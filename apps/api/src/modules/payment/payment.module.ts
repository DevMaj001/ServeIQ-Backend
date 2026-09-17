import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { Notification } from '../notification/entities/notification.entity';
import { BillModule } from '../bill/bill.module';
import { NotificationModule } from '../notification/notification.module';
import { MoniepointApiClient } from './moniepoint-api.client';
import { PaymentReconciliationScheduler } from './payment-reconciliation.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tab, Bill, Order, PosTerminal, Branch, Business, Notification,
    ]),
    BillModule,
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [MoniepointApiClient, PaymentReconciliationScheduler],
})
export class PaymentModule {}

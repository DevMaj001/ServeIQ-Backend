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
import { MoniepointErpCredential } from './entities/moniepoint-erp-credential.entity';
import { MoniepointErpPush } from './entities/moniepoint-erp-push.entity';
import { MoniepointErpService } from './moniepoint-erp.service';
import { MoniepointErpController } from './moniepoint-erp.controller';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tab,
      Bill,
      Order,
      PosTerminal,
      Branch,
      Business,
      Notification,
      MoniepointErpCredential,
      MoniepointErpPush,
    ]),
    BillModule,
    NotificationModule,
  ],
  controllers: [PaymentController, MoniepointErpController],
  providers: [
    MoniepointApiClient,
    PaymentReconciliationScheduler,
    MoniepointErpService,
    EncryptionService,
  ],
  exports: [MoniepointErpService],
})
export class PaymentModule {}

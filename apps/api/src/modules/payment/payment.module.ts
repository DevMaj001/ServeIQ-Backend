import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { BillModule } from '../bill/bill.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tab, Bill, Order, PosTerminal, Branch, Business]),
    BillModule,
  ],
  controllers: [PaymentController],
})
export class PaymentModule {}

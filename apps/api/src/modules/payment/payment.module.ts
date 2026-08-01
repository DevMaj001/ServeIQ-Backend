import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tab, Bill, Order, PosTerminal]),
  ],
  controllers: [PaymentController],
})
export class PaymentModule {}
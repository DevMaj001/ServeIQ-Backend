import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Bill } from '../bill/entities/bill.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Tab, Branch, MenuItem, Bill, PosTerminal]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}

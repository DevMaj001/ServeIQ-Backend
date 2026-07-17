import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Branch } from '../branch/entities/branch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Tab, Branch]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}

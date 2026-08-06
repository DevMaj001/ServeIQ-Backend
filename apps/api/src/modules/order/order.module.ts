import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderScheduler } from './order.scheduler';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Department } from '../department/entities/department.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AuditService } from '../../common/services/audit.service';
import { IngredientModule } from '../ingredient/ingredient.module';
import { NotificationModule } from '../notification/notification.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MenuItem, Tab, Department, AuditLog]),
    IngredientModule,
    NotificationModule,
    TrackingModule,
  ],
  providers: [OrderService, OrderScheduler, AuditService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}

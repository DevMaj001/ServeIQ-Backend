import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderScheduler } from './order.scheduler';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Department } from '../department/entities/department.entity';
import { IngredientModule } from '../ingredient/ingredient.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, MenuItem, Tab, Department]), IngredientModule, NotificationModule],
  providers: [OrderService, OrderScheduler],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}

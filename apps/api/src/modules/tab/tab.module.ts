import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TabService } from './tab.service';
import { TabController } from './tab.controller';
import { Tab } from './entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { StockMovement } from '../ingredient/entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tab, Table, User, Order, StockMovement, MenuItem])],
  providers: [TabService],
  controllers: [TabController],
  exports: [TabService],
})
export class TabModule {}

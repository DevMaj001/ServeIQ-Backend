import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicMenuController } from './public-menu.controller';
import { PublicBusinessesController } from './public-businesses.controller';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Advertisement } from '../advertisement/entities/advertisement.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { Order } from '../order/entities/order.entity';
import { Review } from '../review/entities/review.entity';
import { Business } from '../business/entities/business.entity';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      MenuItem,
      Advertisement,
      Tab,
      Table,
      Order,
      Review,
      Business,
    ]),
    TrackingModule,
  ],
  controllers: [PublicMenuController, PublicBusinessesController, CustomerController],
  providers: [CustomerService],
})
export class PublicModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillService } from './bill.service';
import { BillController } from './bill.controller';
import { Bill } from './entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Table } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { IngredientModule } from '../ingredient/ingredient.module';
import { ReceiptService } from './receipt.service';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, Tab, Order, Table, MenuItem, User, Branch, Business]), IngredientModule, CloudinaryModule],
  providers: [BillService, ReceiptService],
  controllers: [BillController],
  exports: [BillService],
})
export class BillModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { Branch } from './entities/branch.entity';
import { Table } from '../table/entities/table.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AuditService } from '../../common/services/audit.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TableModule } from '../table/table.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Table, Tab, Bill, Order, User, AuditLog]),
    SubscriptionModule,
    TableModule,
  ],
  providers: [BranchService, AuditService],
  controllers: [BranchController],
  exports: [BranchService],
})
export class BranchModule {}

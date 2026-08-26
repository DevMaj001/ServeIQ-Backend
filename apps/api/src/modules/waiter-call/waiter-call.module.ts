import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaiterCall } from './entities/waiter-call.entity';
import { WaiterCallService } from './waiter-call.service';
import { WaiterCallController } from './waiter-call.controller';
import { BranchModule } from '../branch/branch.module';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaiterCall, Tab, Table, User]),
    BranchModule,
    GatewayModule,
  ],
  providers: [WaiterCallService],
  controllers: [WaiterCallController],
  exports: [WaiterCallService],
})
export class WaiterCallModule {}
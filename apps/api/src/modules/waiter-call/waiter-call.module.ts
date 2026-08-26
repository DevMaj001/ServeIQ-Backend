import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaiterCall } from './entities/waiter-call.entity';
import { WaiterCallService } from './waiter-call.service';
import { WaiterCallController } from './waiter-call.controller';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [TypeOrmModule.forFeature([WaiterCall]), BranchModule],
  providers: [WaiterCallService],
  controllers: [WaiterCallController],
  exports: [WaiterCallService],
})
export class WaiterCallModule {}
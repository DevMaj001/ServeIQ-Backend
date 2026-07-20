import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Business } from '../business/entities/business.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { Plan } from '../subscription/entities/plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Branch, User, Bill, Subscription, Plan])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

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
import { PlatformPaymentProvider } from './entities/platform-payment-provider.entity';
import { SyncQueue } from '../sync/sync.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      Branch,
      User,
      Bill,
      Subscription,
      Plan,
      PlatformPaymentProvider,
      SyncQueue,
      AuditLog,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

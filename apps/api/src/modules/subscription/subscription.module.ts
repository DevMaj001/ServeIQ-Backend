import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionScheduler } from './subscription.scheduler';
import { PaystackWebhookController } from './webhooks/paystack-webhook.controller';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Subscription, Plan, Branch, Business]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || ('15m' as any) },
      }),
    }),
  ],
  controllers: [SubscriptionController, PaystackWebhookController],
  providers: [
    SubscriptionService,
    SubscriptionScheduler,
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
  exports: [SubscriptionService, TypeOrmModule],
})
export class SubscriptionModule {}

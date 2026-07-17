import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Business } from './modules/business/entities/business.entity';
import { Branch } from './modules/branch/entities/branch.entity';
import { User } from './modules/user/entities/user.entity';
import { Table as RestaurantTable } from './modules/table/entities/table.entity';
import { MenuItem } from './modules/menu/entities/menu-item.entity';
import { Tab } from './modules/tab/entities/tab.entity';
import { Order } from './modules/order/entities/order.entity';
import { Bill } from './modules/bill/entities/bill.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './common/services/audit.service';
import { IngredientModule } from './modules/ingredient/ingredient.module';
import { StockMovement } from './modules/ingredient/entities/stock-movement.entity';
import { SupplierModule } from './modules/supplier/supplier.module';
import { Supplier } from './modules/supplier/entities/supplier.entity';
import { ShiftModule } from './modules/shift/shift.module';
import { PosModule } from './modules/pos/pos.module';
import { Shift } from './modules/shift/entities/shift.entity';
import { PosTerminal } from './modules/pos/entities/pos-terminal.entity';
import { Plan } from './modules/subscription/entities/plan.entity';
import { Subscription } from './modules/subscription/entities/subscription.entity';
import { Notification } from './modules/notification/entities/notification.entity';
import { Printer } from './modules/printer/printer.entity';
import { PrintJob } from './modules/printer/print-job.entity';
import { SyncQueue } from './modules/sync/sync.entity';
import { Department } from './modules/department/entities/department.entity';
import { Advertisement } from './modules/advertisement/entities/advertisement.entity';

import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { UserModule } from './modules/user/user.module';
import { BranchModule } from './modules/branch/branch.module';
import { MenuModule } from './modules/menu/menu.module';
import { TableModule } from './modules/table/table.module';
import { TabModule } from './modules/tab/tab.module';
import { OrderModule } from './modules/order/order.module';
import { BillModule } from './modules/bill/bill.module';
import { AiModule } from './modules/ai/ai.module';
import { UploadModule } from './modules/upload/upload.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrinterModule } from './modules/printer/printer.module';
import { SyncModule } from './modules/sync/sync.module';
import { MenuModifierModule } from './modules/menu-modifier/menu-modifier.module';
import { PublicModule } from './modules/public/public.module';
import { DepartmentModule } from './modules/department/department.module';
import { AuditModule } from './modules/audit/audit.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AdvertisementModule } from './modules/advertisement/advertisement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        Business,
        Branch,
        User,
        RestaurantTable,
        MenuItem,
        Tab,
        Order,
        Bill,
        RefreshToken,
        VerificationToken,
        AuditLog,
        StockMovement,
        Supplier,
        Shift,
        PosTerminal,
        Plan,
        Subscription,
        Notification,
        Printer,
        PrintJob,
        SyncQueue,
        Department,
        Advertisement,
      ],
      migrationsRun: true,
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      retryAttempts: 10,
      retryDelay: 3000,
      autoLoadEntities: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
    }),
    TypeOrmModule.forFeature([AuditLog]),
    AuthModule,
    BusinessModule,
    UserModule,
    BranchModule,
    MenuModule,
    TableModule,
    TabModule,
    OrderModule,
    BillModule,
    CloudinaryModule,
    DashboardModule,
    IngredientModule,
    SupplierModule,
    ShiftModule,
    PosModule,
    AiModule,
    UploadModule,
    SubscriptionModule,
    NotificationModule,
    AdminModule,
    PrinterModule,
    SyncModule,
    MenuModifierModule,
    PublicModule,
    DepartmentModule,
    AuditModule,
    TrackingModule,
    AdvertisementModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuditService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

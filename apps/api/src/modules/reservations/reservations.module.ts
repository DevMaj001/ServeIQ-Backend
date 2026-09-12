import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { BranchModule } from '../branch/branch.module';
import { TableModule } from '../table/table.module';
import { TabModule } from '../tab/tab.module';
import { UserModule } from '../user/user.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationModule } from '../notification/notification.module';
import { ShiftModule } from '../shift/shift.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    BranchModule,
    TableModule,
    TabModule,
    UserModule,
    GatewayModule,
    NotificationModule,
    ShiftModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
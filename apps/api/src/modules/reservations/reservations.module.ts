import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Shift } from '../shift/entities/shift.entity';
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
    TypeOrmModule.forFeature([Reservation, Branch, Table, User, Tab, Shift]),
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
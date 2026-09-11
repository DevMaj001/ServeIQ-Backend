import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rider } from './entities/rider.entity';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Branch } from '../branch/entities/branch.entity';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rider, User, Role, Branch]),
    NotificationModule,
  ],
  controllers: [RiderController],
  providers: [RiderService],
  exports: [RiderService],
})
export class RiderModule {}

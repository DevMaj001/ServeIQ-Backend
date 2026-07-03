import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Branch])],
  providers: [UserService, AuditService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}

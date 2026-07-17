import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RoleSeedService } from './role-seed.service';
import { RoleController } from './role.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission])],
  controllers: [RoleController],
  providers: [RoleSeedService],
  exports: [TypeOrmModule],
})
export class RoleModule {}

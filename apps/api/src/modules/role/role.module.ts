import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RoleSeedService } from './role-seed.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission])],
  providers: [RoleSeedService, PermissionsGuard],
  exports: [TypeOrmModule, PermissionsGuard],
})
export class RoleModule {}

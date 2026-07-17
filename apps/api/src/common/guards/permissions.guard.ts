import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionCode } from '../../modules/role/permission-codes';
import { Role } from '../../modules/role/entities/role.entity';
import { Permission } from '../../modules/role/entities/permission.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // super_admin bypasses all permission checks
    if (user.role === 'superadmin') return true;

    // If user has a role_id, load role permissions from DB
    if (user.role_id) {
      const role = await this.roleRepo.findOne({
        where: { id: user.role_id },
        relations: ['permissions'],
      });
      if (!role) throw new ForbiddenException('Role not found');

      const userPermissionCodes = new Set(role.permissions.map(p => p.code));
      const hasAll = requiredPermissions.every(p => userPermissionCodes.has(p));
      if (hasAll) return true;
    }

    // Fallback: if user.role matches a system role name, check against the legacy string-based system
    // This ensures backward compatibility during migration
    if (user.role === 'superadmin') return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}

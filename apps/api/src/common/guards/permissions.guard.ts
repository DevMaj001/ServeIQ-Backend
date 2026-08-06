import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionCode } from '../../modules/role/permission-codes';
import { Role } from '../../modules/role/entities/role.entity';
import { Permission } from '../../modules/role/entities/permission.entity';

interface PermissionRequestUser {
  role?: string;
  role_id?: string;
}

interface PermissionRequest {
  user?: PermissionRequestUser;
}

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
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionCode[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<PermissionRequest>();
    if (!user) return false;

    // super_admin and owner bypass all permission checks
    if (user.role === 'superadmin' || user.role === 'owner') return true;

    // User must have role_id — legacy fallback removed
    if (!user.role_id) {
      throw new ForbiddenException(
        'User role not linked to permission system. Contact admin to update your account.',
      );
    }

    const role = await this.roleRepo.findOne({
      where: { id: user.role_id },
      relations: { permissions: true },
    });
    if (!role) throw new ForbiddenException('Role not found');

    const userPermissionCodes = new Set(role.permissions.map((p) => p.code));
    const hasAll = requiredPermissions.every((p) => userPermissionCodes.has(p));
    if (hasAll) return true;
    throw new ForbiddenException('Insufficient permissions');
  }
}

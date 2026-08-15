import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../shared';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; roleEntity?: { name?: string } };
    }>();
    const user = request.user;

    // Accept either the PBAC roleEntity.name or the legacy role claim.
    // Case-insensitive comparison since DB has "Owner" but enum is "owner".
    // Superadmin accounts have no dedicated role entity (role_id points at the
    // global Owner role), so their legacy 'superadmin' claim must satisfy the
    // SUPERADMIN requirement.
    const roleEntityName = (user?.roleEntity?.name || '').toLowerCase();
    const legacyRole = (user?.role || '').toLowerCase();
    return requiredRoles.some(
      (role: string) =>
        roleEntityName === role.toLowerCase() ||
        legacyRole === role.toLowerCase(),
    );
  }
}

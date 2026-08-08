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

    // Prefer roleEntity.name (PBAC) over legacy role string
    // Case-insensitive comparison since DB has "Owner" but enum is "owner"
    const userRole = (user?.roleEntity?.name || user?.role || '').toLowerCase();
    return requiredRoles.some((role: string) => userRole === role.toLowerCase());
  }
}

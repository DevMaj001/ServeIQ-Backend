import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../modules/role/permission-codes';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

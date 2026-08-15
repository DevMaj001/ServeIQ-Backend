import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../shared';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const makeContext = (user: any) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  const withRequired = (roles: UserRole[]) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  };

  it('allows when roleEntity.name matches', () => {
    withRequired([UserRole.OWNER]);
    const ctx = makeContext({ role: 'owner', roleEntity: { name: 'Owner' } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows superadmin via legacy role claim when roleEntity is the Owner role', () => {
    withRequired([UserRole.SUPERADMIN]);
    const ctx = makeContext({
      role: 'superadmin',
      roleEntity: { name: 'Owner' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows superadmin when no roleEntity is linked', () => {
    withRequired([UserRole.SUPERADMIN]);
    const ctx = makeContext({ role: 'superadmin', roleEntity: undefined });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when neither roleEntity.name nor legacy role matches', () => {
    withRequired([UserRole.SUPERADMIN]);
    const ctx = makeContext({ role: 'waiter', roleEntity: { name: 'Waiter' } });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('denies an owner for a superadmin requirement', () => {
    withRequired([UserRole.SUPERADMIN]);
    const ctx = makeContext({ role: 'owner', roleEntity: { name: 'Owner' } });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows when no required roles are set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext({ role: 'waiter' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('is case-insensitive for legacy role claims', () => {
    withRequired([UserRole.SUPERADMIN]);
    const ctx = makeContext({ role: 'SuperAdmin', roleEntity: undefined });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
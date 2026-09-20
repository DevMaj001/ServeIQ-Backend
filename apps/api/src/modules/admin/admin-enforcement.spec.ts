import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { AdminService } from './admin.service';

/**
 * Enforcement-layer tests: suspension that actually cuts access at request
 * time, and the admin session-revocation commands.
 */

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn(async (e: any) => e),
  create: jest.fn((d: any) => d),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  increment: jest.fn().mockResolvedValue({ affected: 1 }),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('JwtStrategy suspension enforcement', () => {
  let repos: Record<string, any>;
  let strategy: JwtStrategy;

  const makeStrategy = () => {
    const configService = { get: jest.fn().mockReturnValue('test-secret') };
    const dataSource = {
      getRepository: jest.fn((entity: any) => {
        const name = entity?.name;
        if (!repos[name]) repos[name] = repoMock();
        return repos[name];
      }),
    };
    return new JwtStrategy(configService as any, dataSource as any);
  };

  const activeUser = () => ({
    id: 'u1',
    is_active: true,
    pin_token_version: 1,
    branch_id: 'b1',
    business_id: 'biz1',
    roleEntity: null,
  });

  const payload = {
    sub: 'u1',
    email: 'w@x.test',
    role: 'waiter',
    role_id: 'r1',
    businessId: 'biz1',
    branchId: 'b1',
    pin_token_version: 1,
    staff_token_version: 3,
  };

  beforeEach(() => {
    repos = {};
    strategy = makeStrategy();
  });

  it('rejects a deactivated user even with a valid token', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue({
      ...activeUser(),
      is_active: false,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      'Account deactivated',
    );
  });

  it('rejects when the branch is suspended', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue(activeUser());
    repos['Branch'] = repoMock();
    repos['Branch'].findOne.mockResolvedValue({
      id: 'b1',
      is_active: false,
      staff_token_version: 3,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      'This branch has been suspended',
    );
  });

  it('rejects when the business is suspended', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue(activeUser());
    repos['Branch'] = repoMock();
    repos['Branch'].findOne.mockResolvedValue({
      id: 'b1',
      is_active: true,
      staff_token_version: 3,
    });
    repos['Business'] = repoMock();
    repos['Business'].findOne.mockResolvedValue({
      id: 'biz1',
      is_active: false,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      'This business has been suspended',
    );
  });

  it('still enforces token-version revocation', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue({
      ...activeUser(),
      pin_token_version: 2, // bumped by force-logout
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      'PIN has been reset',
    );
  });

  it('passes an active user in an active branch/business', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue(activeUser());
    repos['Branch'] = repoMock();
    repos['Branch'].findOne.mockResolvedValue({
      id: 'b1',
      is_active: true,
      staff_token_version: 3,
    });
    repos['Business'] = repoMock();
    repos['Business'].findOne.mockResolvedValue({
      id: 'biz1',
      is_active: true,
    });

    const result = await strategy.validate(payload);
    expect(result.userId).toBe('u1');
    expect(result.branchId).toBe('b1');
  });

  it('surfaces impersonation identity on req.user', async () => {
    repos['User'] = repoMock();
    repos['User'].findOne.mockResolvedValue({
      ...activeUser(),
      branch_id: null,
      business_id: null,
    });
    const result = await strategy.validate({
      ...payload,
      pin_token_version: 1,
      staff_token_version: undefined,
      impersonating: true,
      impersonator_id: 'admin-1',
    });
    expect(result.impersonating).toBe(true);
    expect(result.impersonatorId).toBe('admin-1');
  });
});

describe('AdminService session commands', () => {
  let businessRepo: any;
  let branchRepo: any;
  let userRepo: any;
  let auditLogRepo: any;
  let dataSource: any;
  let realtimeService: any;
  let refreshTokenRepo: any;
  let service: AdminService;

  beforeEach(() => {
    businessRepo = repoMock();
    branchRepo = repoMock();
    userRepo = repoMock();
    auditLogRepo = repoMock();
    refreshTokenRepo = repoMock();
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn(() => refreshTokenRepo),
    };
    realtimeService = { disconnectBranch: jest.fn() };
    service = new AdminService(
      businessRepo,
      branchRepo,
      userRepo,
      repoMock() as any, // bill
      repoMock() as any, // subscription
      repoMock() as any, // plan
      repoMock() as any, // payment provider
      repoMock() as any, // sync queue
      auditLogRepo,
      repoMock() as any, // shift template
      dataSource,
      { encrypt: (v: string) => v, decrypt: (v: string) => v } as any,
      realtimeService,
    );
  });

  it('suspending a business bumps token versions, revokes refresh tokens, and drops sockets', async () => {
    businessRepo.findOne.mockResolvedValue({ id: 'biz1', is_active: true });
    branchRepo.find.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

    await service.updateBusiness(
      'biz1',
      { is_active: false } as any,
      'admin-1',
    );

    expect(branchRepo.increment).toHaveBeenCalledWith(
      { business_id: 'biz1' },
      'staff_token_version',
      1,
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true'),
      ['biz1'],
    );
    expect(realtimeService.disconnectBranch).toHaveBeenCalledWith('b1');
    expect(realtimeService.disconnectBranch).toHaveBeenCalledWith('b2');
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);
  });

  it('updating a business WITHOUT suspending revokes nothing', async () => {
    businessRepo.findOne.mockResolvedValue({ id: 'biz1', is_active: true });
    await service.updateBusiness(
      'biz1',
      { name: 'New Name' } as any,
      'admin-1',
    );
    expect(branchRepo.increment).not.toHaveBeenCalled();
    expect(realtimeService.disconnectBranch).not.toHaveBeenCalled();
  });

  it('forceLogoutUser bumps pin_token_version and revokes refresh tokens', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'u1',
      branch_id: 'b1',
      email: 'w@x.test',
    });
    const result = await service.forceLogoutUser('u1', 'admin-1');
    expect(userRepo.increment).toHaveBeenCalledWith(
      { id: 'u1' },
      'pin_token_version',
      1,
    );
    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { user_id: 'u1' },
      { is_revoked: true },
    );
    expect(result.sessions_revoked).toBe(true);
  });

  it('deactivating a user also kills their sessions', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'u1',
      branch_id: 'b1',
      email: 'w@x.test',
      is_active: true,
    });
    const result = await service.updateUserStatus('u1', false, 'admin-1');
    expect(result.is_active).toBe(false);
    expect(userRepo.increment).toHaveBeenCalledWith(
      { id: 'u1' },
      'pin_token_version',
      1,
    );
  });
});

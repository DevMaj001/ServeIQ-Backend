import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { SubscriptionService } from '../subscription/subscription.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hash'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: any;
  let dataSource: any;
  let auditService: any;
  let repoMock: any;
  let bcryptMock: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    password_hash: 'hashed',
    pin_hash: 'hashed-pin',
    pin_token_version: 1,
    role: 'waiter',
    role_id: null,
    business_id: 'biz-1',
    branch_id: 'branch-1',
    is_active: true,
  };

  beforeEach(async () => {
    bcryptMock = require('bcrypt');

    repoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (e: any) => e),
      create: jest.fn((dto: any) => dto),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      }),
    };

    const branchRepoMock = {
      findOne: jest.fn().mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        staff_token_version: 0,
      }),
    };

    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };

    dataSource = {
      getRepository: jest.fn().mockImplementation((entity?: any) => {
        if (
          entity &&
          typeof entity === 'function' &&
          entity.name === 'Branch'
        ) {
          return branchRepoMock;
        }
        return repoMock;
      }),
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn((_entity: any, dto: any) => dto),
          save: jest.fn(async (e: any) => ({ ...e, id: 'new-id' })),
        },
      }),
      query: jest.fn(),
    };

    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const subService = {
      createTrialSubscription: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
        { provide: SubscriptionService, useValue: subService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.access_token).toBe('jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(auditService.log).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user not found', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('waiterLogin', () => {
    it('returns tokens for valid PIN', async () => {
      repoMock.find.mockResolvedValue([mockUser]);
      bcryptMock.compare.mockImplementation(
        async (pin: string) => pin === '1234',
      );

      const result = await service.waiterLogin({
        pin: '1234',
        branchId: 'branch-1',
      });

      expect(result.access_token).toBe('jwt-token');
    });

    it('throws UnauthorizedException for invalid PIN', async () => {
      repoMock.find.mockResolvedValue([mockUser]);
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.waiterLogin({ pin: 'wrong', branchId: 'branch-1' }),
      ).rejects.toThrow('Invalid PIN');
    });

    it('throws BadRequestException when PIN is missing', async () => {
      await expect(
        service.waiterLogin({ pin: '', branchId: 'branch-1' }),
      ).rejects.toThrow('PIN or passcode is required');
    });
  });

  describe('resolveBusinessCode', () => {
    it('returns business info for valid code', async () => {
      repoMock.findOne.mockResolvedValue({
        id: 'biz-1',
        name: 'Test Business',
      });

      const result = await service.resolveBusinessCode('ABCD1234');
      expect(result.businessId).toBe('biz-1');
      expect(result.businessName).toBe('Test Business');
    });

    it('throws for invalid code', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(service.resolveBusinessCode('INVALID')).rejects.toThrow(
        'Invalid business code',
      );
    });
  });

  describe('logout', () => {
    it('revokes refresh token', async () => {
      await service.logout('some-token');
      expect(repoMock.update).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('returns reset token for existing email', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('reset link');
    });
  });
});

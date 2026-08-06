import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BranchService } from './branch.service';
import { Branch } from './entities/branch.entity';
import { Table } from '../table/entities/table.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Bill } from '../bill/entities/bill.entity';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { AuditService } from '../../common/services/audit.service';
import { TableSystemService } from '../table/table-system.service';
import { NotFoundException } from '@nestjs/common';

describe('BranchService (cross-business data isolation)', () => {
  let service: BranchService;

  const branchA = {
    id: 'branch-A',
    business_id: 'biz-A',
    name: 'Branch A',
  } as Branch;
  const branchB = {
    id: 'branch-B',
    business_id: 'biz-B',
    name: 'Branch B',
  } as Branch;

  const branchRepository = {
    findOne: jest.fn(
      (options: { where: { id: string; business_id: string } }) => {
        const { id, business_id } = options.where;
        // Simulates a DB scoped to (id, business_id): the branch is only returned
        // when BOTH the requested id and the caller's business_id match.
        if (id === branchA.id && business_id === branchA.business_id)
          return Promise.resolve(branchA);
        if (id === branchB.id && business_id === branchB.business_id)
          return Promise.resolve(branchB);
        return Promise.resolve(null);
      },
    ),
    find: jest.fn((options: { where: { business_id: string | string[] } }) => {
      const businessIds = Array.isArray(options.where.business_id)
        ? options.where.business_id
        : [options.where.business_id];
      const rows = businessIds.includes(branchA.business_id) ? [branchA] : [];
      if (businessIds.includes(branchB.business_id)) rows.push(branchB);
      return Promise.resolve(rows);
    }),
    save: jest.fn((e: Branch) => Promise.resolve(e)),
    remove: jest.fn((e: Branch) => Promise.resolve(e)),
  };

  const mockEntityRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn((e: any) => Promise.resolve(e)),
    createQueryBuilder: jest.fn().mockReturnValue({ mock: true }),
  });

  const subscriptionService = {
    createTrialSubscription: jest.fn().mockResolvedValue(undefined),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const tableSystemService = {
    ensureSystemTables: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        { provide: getRepositoryToken(Branch), useValue: branchRepository },
        { provide: getRepositoryToken(Table), useValue: mockEntityRepo() },
        { provide: getRepositoryToken(Tab), useValue: mockEntityRepo() },
        { provide: getRepositoryToken(Bill), useValue: mockEntityRepo() },
        { provide: getRepositoryToken(Order), useValue: mockEntityRepo() },
        { provide: getRepositoryToken(User), useValue: mockEntityRepo() },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: AuditService, useValue: auditService },
        { provide: TableSystemService, useValue: tableSystemService },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne — branch scoping (JWT businessId is passed by the controller)', () => {
    it('returns a branch when the caller belongs to its business', async () => {
      await expect(service.findOne('branch-A', 'biz-A')).resolves.toMatchObject(
        { id: 'branch-A' },
      );
    });

    it('throws NotFound when a user of business A requests business B’s branch (no cross-business leak)', async () => {
      await expect(service.findOne('branch-B', 'biz-A')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound for an unknown branch', async () => {
      await expect(service.findOne('nope', 'biz-A')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllByBusiness — list is restricted to the caller’s business', () => {
    it('returns only branches of the requesting business', async () => {
      const result = await service.findAllByBusiness('biz-A');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'branch-A' });
    });
  });
});

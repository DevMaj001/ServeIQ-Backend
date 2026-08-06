import { Test, TestingModule } from '@nestjs/testing';
import { TabService } from './tab.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tab } from './entities/tab.entity';
import { Table, TableStatus } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { StockMovement } from '../ingredient/entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Shift } from '../shift/entities/shift.entity';
import { DataSource } from 'typeorm';
import { TrackingService } from '../tracking/tracking.service';
import { TabType } from '../../common/shared';

describe('TabService — Tab State Machine Transitions', () => {
  let service: TabService;
  let repos: any;
  let dataSource: any;
  let trackingService: any;

  const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => ({
      ...entity,
      id: 'tab-1',
      created_at: new Date(),
      updated_at: new Date(),
    })),
    update: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  });

  const buildMockManager = () => ({
    getRepository: jest.fn((entity: any) => ({
      save: jest.fn(async (e: any) => ({ ...e, id: 'saved-1' })),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    })),
    save: jest.fn(async (e: any) => ({ ...e, id: 'saved-1' })),
    update: jest.fn(),
    findOne: jest.fn(),
  });

  beforeEach(async () => {
    repos = {
      tabRepo: mockRepo(),
      tableRepo: mockRepo(),
      userRepo: mockRepo(),
      orderRepo: mockRepo(),
      stockMovementRepo: mockRepo(),
      menuItemRepo: mockRepo(),
      shiftRepo: mockRepo(),
    };

    const mockManager = buildMockManager();
    dataSource = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: mockManager,
      }),
      transaction: jest.fn(async (cb: any) => cb(mockManager)),
      query: jest.fn(),
    };

    trackingService = {
      generateUniqueCode: jest.fn().mockResolvedValue('TRK-TEST'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TabService,
        { provide: getRepositoryToken(Tab), useValue: repos.tabRepo },
        { provide: getRepositoryToken(Table), useValue: repos.tableRepo },
        { provide: getRepositoryToken(User), useValue: repos.userRepo },
        { provide: getRepositoryToken(Order), useValue: repos.orderRepo },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: repos.stockMovementRepo,
        },
        { provide: getRepositoryToken(MenuItem), useValue: repos.menuItemRepo },
        { provide: getRepositoryToken(Shift), useValue: repos.shiftRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TrackingService, useValue: trackingService },
      ],
    }).compile();

    service = module.get<TabService>(TabService);
  });

  describe('State Machine — open → billed → paid', () => {
    it('TSM-01: Open tab has status "open"', async () => {
      repos.shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        branch_id: 'branch-1',
        status: 'open',
      });
      repos.tableRepo.findOne.mockResolvedValue({
        id: 'table-1',
        is_virtual: false,
      });

      const mockManager = buildMockManager();
      dataSource.createQueryRunner = jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: mockManager,
      });

      const tab = await service.openTab({
        branch_id: 'branch-1',
        table_id: 'table-1',
      });

      expect(tab.status).toBe('open');
      expect(tab.tab_number).toMatch(/TAB-/);
      expect(tab.tracking_code).toBe('TRK-TEST');
    });

    it('TSM-02: Cannot open tab without open shift', async () => {
      repos.shiftRepo.findOne.mockResolvedValue(null);

      await expect(
        service.openTab({ branch_id: 'branch-1', table_id: 'table-1' }),
      ).rejects.toThrow('No open shift for this branch');
    });

    it('TSM-03: Cannot open tab if table already has open tab (different waiter)', async () => {
      repos.shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        branch_id: 'branch-1',
        status: 'open',
      });
      repos.tabRepo.findOne.mockResolvedValue({
        id: 'existing-tab',
        waiter_id: 'waiter-2',
        table_id: 'table-1',
      });

      await expect(
        service.openTab(
          {
            branch_id: 'branch-1',
            table_id: 'table-1',
          },
          'waiter-1',
          'waiter',
        ),
      ).rejects.toThrow('This table is being served by another waiter');
    });

    it('TSM-04: Cannot open tab if table already has open tab (same waiter returns existing)', async () => {
      const existingTab = {
        id: 'existing-tab',
        waiter_id: 'waiter-1',
        table_id: 'table-1',
        status: 'open',
        table: null,
        waiter: null,
        orders: [],
        total_kobo: 0,
      };
      repos.shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        branch_id: 'branch-1',
        status: 'open',
      });
      repos.tabRepo.findOne.mockResolvedValue(existingTab);
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);

      const result = await service.openTab(
        {
          branch_id: 'branch-1',
          table_id: 'table-1',
        },
        'waiter-1',
        'waiter',
      );

      expect(result.id).toBe('existing-tab');
    });

    it('TSM-05: Transfer only allowed on open tabs', async () => {
      repos.tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'paid',
        table_id: 'table-1',
        tab_type: TabType.DINE_IN,
      });
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);
      repos.tableRepo.findOne.mockResolvedValue({
        id: 'table-1',
        is_virtual: false,
      });

      await expect(
        service.transferTab('tab-1', 'branch-1', 'table-2'),
      ).rejects.toThrow('Only open tabs can be transferred');
    });

    it('TSM-06: Cannot transfer takeaway tab', async () => {
      repos.tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
        table_id: 'table-1',
        tab_type: TabType.TAKEAWAY,
      });
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);

      await expect(
        service.transferTab('tab-1', 'branch-1', 'table-2'),
      ).rejects.toThrow('Takeaway tabs cannot be transferred');
    });

    it('TSM-07: Cannot transfer to occupied table', async () => {
      const openTab = {
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
        table_id: 'table-1',
        tab_type: TabType.DINE_IN,
        table: { is_virtual: false },
        waiter: null,
        orders: [],
        total_kobo: 0,
      };
      const targetTable = {
        id: 'table-2',
        status: TableStatus.OCCUPIED,
        branch_id: 'branch-1',
        is_virtual: false,
      };
      repos.tabRepo.findOne.mockResolvedValue(openTab);
      repos.tableRepo.findOne.mockResolvedValue(targetTable);
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);

      await expect(
        service.transferTab('tab-1', 'branch-1', 'table-2'),
      ).rejects.toThrow('Target table is not available');
    });

    it('TSM-08: Void only allowed on open tabs', async () => {
      repos.tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'paid',
        table_id: 'table-1',
        waiter_id: 'waiter-1',
        table: { is_virtual: false },
        waiter: null,
        orders: [],
        total_kobo: 0,
      });
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);

      await expect(
        service.voidTab(
          'tab-1',
          'branch-1',
          'waiter-1',
          'waiter',
          'test reason',
        ),
      ).rejects.toThrow('Only open tabs can be voided');
    });

    it('TSM-09: Another waiter cannot close a tab', async () => {
      const tabWithWaiter = {
        id: 'tab-1',
        branch_id: 'b1',
        status: 'open',
        table_id: 'table-1',
        waiter_id: 'waiter-2',
        table: { is_virtual: false },
        waiter: null,
        orders: [],
        total_kobo: 0,
      };
      repos.tabRepo.findOne.mockResolvedValue(tabWithWaiter);
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);

      await expect(
        service.closeTab('tab-1', 'b1', 'waiter-1', 'waiter'),
      ).rejects.toThrow("You cannot close another waiter's tab");
    });

    it('TSM-10: Owner can close any tab', async () => {
      const mockManager = buildMockManager();

      dataSource.createQueryRunner = jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: mockManager,
      });

      repos.tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'b1',
        status: 'open',
        table_id: 'table-1',
        waiter_id: 'waiter-2',
      });
      repos.userRepo.findOne.mockResolvedValue(null);
      repos.orderRepo.find.mockResolvedValue([]);
      repos.tableRepo.findOne.mockResolvedValue({
        id: 'table-1',
        is_virtual: false,
      });

      await service.closeTab('tab-1', 'b1', 'owner-1', 'owner');
      expect(mockManager.update).toHaveBeenCalledWith(
        Tab,
        'tab-1',
        expect.objectContaining({ status: 'paid' }),
      );
    });
  });
});

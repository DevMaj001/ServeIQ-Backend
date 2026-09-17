import { Test, TestingModule } from '@nestjs/testing';
import { BillService } from './bill.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bill } from './entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Table } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { Department } from '../department/entities/department.entity';
import { DataSource } from 'typeorm';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';
import { OrderService } from '../order/order.service';

const mockRealtimeService = () => ({
  emitBillUpdate: jest.fn(),
  emitDashboardUpdate: jest.fn(),
});

describe('BillService', () => {
  let service: BillService;
  let billRepo: any;
  let tabRepo: any;
  let orderRepo: any;
  let tableRepo: any;
  let branchRepo: any;
  let businessRepo: any;
  let dataSource: any;
  let ingredientService: any;
  let receiptService: any;
  let cloudinaryService: any;

  const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => ({
      ...entity,
      id: 'bill-1',
      created_at: new Date(),
      updated_at: new Date(),
    })),
    update: jest.fn(),
  });

  beforeEach(async () => {
    billRepo = mockRepo();
    tabRepo = mockRepo();
    orderRepo = mockRepo();
    tableRepo = mockRepo();
    branchRepo = mockRepo();
    businessRepo = mockRepo();

    dataSource = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: jest.fn(() => ({
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn(async (e) => e),
            createQueryBuilder: () => ({
              update: () => ({
                set: () => ({
                  where: () => ({
                    andWhere: () => ({ execute: jest.fn() }),
                  }),
                }),
              }),
            }),
          })),
        }),
      ),
    };

    ingredientService = { deductByTab: jest.fn().mockResolvedValue(undefined) };
    receiptService = {
      generatePdf: jest.fn().mockReturnValue(Buffer.from('pdf')),
    };
    cloudinaryService = {
      uploadFile: jest.fn().mockResolvedValue({
        secure_url: 'https://cloudinary.com/receipt.pdf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillService,
        { provide: getRepositoryToken(Bill), useValue: billRepo },
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Table), useValue: tableRepo },
        { provide: getRepositoryToken(MenuItem), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Department), useValue: mockRepo() },
        { provide: DataSource, useValue: dataSource },
        { provide: IngredientService, useValue: ingredientService },
        { provide: ReceiptService, useValue: receiptService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: RealtimeService, useValue: mockRealtimeService() },
        {
          provide: OrderService,
          useValue: { approve: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<BillService>(BillService);
  });

  describe('generateBill', () => {
    it('generates a bill with subtotal, service charge, tax', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: 'waiter-1',
      });
      billRepo.findOne.mockResolvedValue(null);
      orderRepo.find.mockResolvedValue([
        { subtotal_kobo: 10000 },
        { subtotal_kobo: 5000 },
      ]);
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
      });
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });

      const result = await service.generateBill(
        'tab-1',
        'branch-1',
        'waiter-1',
        'waiter',
      );

      expect(result.subtotal_kobo).toBe(15000);
      expect(result.service_charge_kobo).toBe(1500);
      expect(result.tax_kobo).toBe(1125);
      expect(result.total_kobo).toBe(17625);
    });

    it('returns paid existing bill unchanged', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: null,
      });
      const existing = {
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
        paid_at: new Date(),
      };
      billRepo.findOne.mockResolvedValue(existing);

      const result = await service.generateBill(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
      );
      expect(result).toEqual(existing);
      expect(orderRepo.find).not.toHaveBeenCalled();
    });

    it('recomputes an existing unpaid bill from current items', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: null,
      });
      const existing = {
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 1000,
        service_charge_kobo: 100,
        tax_kobo: 75,
        discount_kobo: 0,
        total_kobo: 1175,
        paid_at: null,
      };
      billRepo.findOne.mockResolvedValue(existing);
      orderRepo.find.mockResolvedValue([{ subtotal_kobo: 10000 }]);
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
      });
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });

      const result = await service.generateBill(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
      );
      expect(result.subtotal_kobo).toBe(10000);
      expect(result.total_kobo).toBe(11750);
    });

    it('throws ForbiddenException for another waiter tab', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: 'waiter-other',
      });

      await expect(
        service.generateBill('tab-1', 'branch-1', 'waiter-me', 'waiter'),
      ).rejects.toThrow('This tab belongs to another waiter');
    });

    it('allows manager to bill any tab', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: 'waiter-other',
      });
      billRepo.findOne.mockResolvedValue(null);
      orderRepo.find.mockResolvedValue([{ subtotal_kobo: 10000 }]);
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
      });
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });

      const result = await service.generateBill(
        'tab-1',
        'branch-1',
        'manager-1',
        'manager',
      );
      expect(result.subtotal_kobo).toBe(10000);
    });
  });

  describe('applyDiscount', () => {
    it('applies fixed kobo discount', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 10000,
        service_charge_kobo: 1000,
        tax_kobo: 750,
        discount_kobo: 0,
        total_kobo: 11750,
        paid_at: null,
      });

      const result = await service.applyDiscount('tab-1', 'branch-1', {
        discount_kobo: 2000,
      });

      expect(result.discount_kobo).toBe(2000);
      expect(result.total_kobo).toBe(9750);
    });

    it('applies percent discount', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 10000,
        service_charge_kobo: 1000,
        tax_kobo: 750,
        discount_kobo: 0,
        total_kobo: 11750,
        paid_at: null,
      });

      const result = await service.applyDiscount('tab-1', 'branch-1', {
        discount_percent: 10,
      });

      expect(result.discount_kobo).toBe(1000);
      expect(result.total_kobo).toBe(10750);
    });

    it('rejects discount on paid bill', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        subtotal_kobo: 10000,
        paid_at: new Date(),
      });

      await expect(
        service.applyDiscount('tab-1', 'branch-1', { discount_kobo: 500 }),
      ).rejects.toThrow('Cannot modify a paid bill');
    });

    it('rejects discount when subtotal is below business threshold', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'business-1',
      });
      businessRepo.findOne.mockResolvedValue({
        id: 'business-1',
        currency: 'NGN',
        discount_min_order_amount: 20000,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 10000,
        service_charge_kobo: 1000,
        tax_kobo: 750,
        discount_kobo: 0,
        total_kobo: 11750,
        paid_at: null,
      });

      await expect(
        service.applyDiscount('tab-1', 'branch-1', { discount_kobo: 2000 }),
      ).rejects.toThrow('A minimum purchase of ₦200.00 is required');
    });

    it('applies discount when subtotal meets business threshold', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'business-1',
      });
      businessRepo.findOne.mockResolvedValue({
        id: 'business-1',
        currency: 'NGN',
        discount_min_order_amount: 5000,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 10000,
        service_charge_kobo: 1000,
        tax_kobo: 750,
        discount_kobo: 0,
        total_kobo: 11750,
        paid_at: null,
      });

      const result = await service.applyDiscount('tab-1', 'branch-1', {
        discount_kobo: 2000,
      });

      expect(result.discount_kobo).toBe(2000);
      expect(result.total_kobo).toBe(9750);
    });
  });

  describe('processPayment', () => {
    it('processes payment and updates tab/table status', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: 'table-1',
        waiter_id: null,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
      });
      orderRepo.find.mockResolvedValue([
        { menu_item_id: 'mi-1', order_status: 'delivered' },
      ]);

      const result = await service.processPayment(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
        {
          amount: 5000,
          method: 'cash' as any,
        },
      );

      expect(result.payment_method).toBe('cash');
      expect(result.payment_amount_kobo).toBe(5000);
      expect(result.paid_at).toBeDefined();
    });

    it('returns existing bill for duplicate idempotency key', async () => {
      const existing = { id: 'bill-1', tab_id: 'tab-1', paid_at: new Date() };
      billRepo.findOne.mockResolvedValueOnce({ id: 'bill-1', tab_id: 'tab-1' });
      billRepo.findOne.mockResolvedValueOnce(existing);

      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: null,
      });
      orderRepo.find.mockResolvedValue([
        { menu_item_id: 'mi-1', order_status: 'delivered' },
      ]);

      const result = await service.processPayment(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
        {
          amount: 5000,
          method: 'card' as any,
          idempotency_key: 'dup-key',
        },
      );

      expect(result).toEqual(existing);
    });

    it('rejects cash payments for takeaway tabs', async () => {
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
      });
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        tab_type: 'takeaway',
        waiter_id: null,
      });

      await expect(
        service.processPayment('tab-1', 'branch-1', 'user-1', 'owner', {
          amount: 5000,
          method: 'cash' as any,
        }),
      ).rejects.toThrow('Cash payment is not available for takeaway orders');
    });

    it('releases held prepaid orders to the kitchen queue when branch kds_enabled', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: null,
        tab_type: 'takeaway',
        waiter_id: null,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
      });
      orderRepo.find.mockResolvedValue([
        { menu_item_id: 'mi-1', order_status: 'delivered' },
      ]);
      let releaseUpdate: any;
      dataSource.transaction = jest.fn(async (cb) =>
        cb({
          getRepository: jest.fn((entity) => {
            if (entity === Order) {
              return {
                find: jest.fn(async () => [
                  {
                    id: 'held-1',
                    menu_item_id: 'mi-1',
                    order_status: 'pending_payment_approval',
                    assigned_department: null,
                    estimated_preparation_time_seconds: null,
                  },
                ]),
                update: jest.fn((id, patch) => {
                  releaseUpdate = patch;
                  return Promise.resolve(undefined);
                }),
              };
            }
            if (entity === Branch) {
              return {
                findOne: jest.fn().mockResolvedValue({
                  id: 'branch-1',
                  settings: {
                    feature_flags: { kds_enabled: true },
                    kds_default_department_id: 'dept-default',
                  },
                }),
              };
            }
            if (entity === MenuItem) {
              return {
                find: jest.fn().mockResolvedValue([
                  {
                    id: 'mi-1',
                    prep_time_seconds: 900,
                  },
                ]),
              };
            }
            return {
              findOne: jest.fn(),
              find: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
              save: jest.fn(async (e) => e),
            };
          }),
        }),
      );

      const result = await service.processPayment(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
        { amount: 5000, method: 'card' as any, terminal_id: 'term-1' },
      );

      expect(releaseUpdate.order_status).toBe('assigned_to_department');
      expect(releaseUpdate.assigned_department).toBe('dept-default');
      expect(releaseUpdate.estimated_preparation_time_seconds).toBe(900);
      expect(result.payment_method).toBe('card');
    });

    it('keeps held prepaid orders on the supervisor pipeline when kds_enabled is off', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: null,
        tab_type: 'takeaway',
        waiter_id: null,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
      });
      orderRepo.find.mockResolvedValue([
        { menu_item_id: 'mi-1', order_status: 'delivered' },
      ]);

      let releaseUpdate: any;
      dataSource.transaction = jest.fn(async (cb) =>
        cb({
          getRepository: jest.fn((entity) => {
            if (entity === Order) {
              return {
                find: jest.fn(async () => [
                  {
                    id: 'held-1',
                    menu_item_id: 'mi-1',
                    order_status: 'pending_payment_approval',
                    assigned_department: null,
                    estimated_preparation_time_seconds: 600,
                  },
                ]),
                update: jest.fn((id, patch) => {
                  releaseUpdate = patch;
                  return Promise.resolve(undefined);
                }),
              };
            }
            if (entity === Branch) {
              return {
                findOne: jest.fn().mockResolvedValue({
                  id: 'branch-1',
                  settings: { feature_flags: { kds_enabled: false } },
                }),
              };
            }
            return {
              findOne: jest.fn(),
              find: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
              save: jest.fn(async (e) => e),
            };
          }),
        }),
      );

      await service.processPayment('tab-1', 'branch-1', 'user-1', 'owner', {
        amount: 5000,
        method: 'card' as any,
        terminal_id: 'term-1',
      });

      expect(releaseUpdate.order_status).toBe('pending_supervisor_approval');
      expect(releaseUpdate.estimated_preparation_time_seconds).toBe(600);
    });

    it('skips deduction and returns the paid bill when a concurrent delivery already claimed it', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: 'table-1',
        waiter_id: null,
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
      });
      orderRepo.find.mockResolvedValue([
        { menu_item_id: 'mi-1', order_status: 'delivered' },
      ]);

      // What the winner persisted seconds ago; the loser re-fetches this after
      // losing the claim.
      const winnerPaidBill = {
        id: 'bill-1',
        tab_id: 'tab-1',
        total_kobo: 5000,
        paid_at: new Date(),
        idempotency_key: 'monniepoint-ref-1',
        payment_method: 'pos',
        payment_amount_kobo: 5000,
      };

      // The atomic conditional UPDATE matches zero rows: the OTHER retry
      // claimed the bill first, so paid_at/idempotency_key are already set.
      dataSource.transaction = jest.fn(async (cb) =>
        cb({
          getRepository: jest.fn(() => ({
            findOne: jest.fn().mockResolvedValue(winnerPaidBill),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 0 }),
            save: jest.fn(async (e) => e),
          })),
        }),
      );

      const result = await service.processPayment(
        'tab-1',
        'branch-1',
        'user-1',
        'owner',
        {
          amount: 5000,
          method: 'pos' as any,
          idempotency_key: 'monniepoint-ref-1',
        },
      );

      // Exactly one delivery wins: the loser must not double-deduct stock,
      // void siblings, emit duplicate events, or regenerate the receipt.
      expect(ingredientService.deductByTab).not.toHaveBeenCalled();
      expect(result).toEqual(winnerPaidBill);
    });
  });
});

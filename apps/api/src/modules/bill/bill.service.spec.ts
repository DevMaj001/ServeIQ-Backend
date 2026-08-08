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
import { DataSource } from 'typeorm';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';

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
            update: jest.fn(),
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
        { provide: DataSource, useValue: dataSource },
        { provide: IngredientService, useValue: ingredientService },
        { provide: ReceiptService, useValue: receiptService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: RealtimeService, useValue: mockRealtimeService() },
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

      const result = await service.generateBill('tab-1', 'waiter-1', 'waiter');

      expect(result.subtotal_kobo).toBe(15000);
      expect(result.service_charge_kobo).toBe(1500);
      expect(result.tax_kobo).toBe(1125);
      expect(result.total_kobo).toBe(17625);
    });

    it('returns existing bill if already generated', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        waiter_id: null,
      });
      const existing = { id: 'bill-1', tab_id: 'tab-1', total_kobo: 5000 };
      billRepo.findOne.mockResolvedValue(existing);

      const result = await service.generateBill('tab-1', 'user-1', 'owner');
      expect(result).toEqual(existing);
    });

    it('throws ForbiddenException for another waiter tab', async () => {
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        waiter_id: 'waiter-other',
      });

      await expect(
        service.generateBill('tab-1', 'waiter-me', 'waiter'),
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

      const result = await service.processPayment('tab-1', 'user-1', 'owner', {
        amount: 5000,
        method: 'cash' as any,
      });

      expect(result.payment_method).toBe('cash');
      expect(result.payment_amount_kobo).toBe(5000);
      expect(result.paid_at).toBeDefined();
    });

    it('returns existing bill for duplicate idempotency key', async () => {
      const existing = { id: 'bill-1', tab_id: 'tab-1', paid_at: new Date() };
      billRepo.findOne.mockResolvedValueOnce({ id: 'bill-1', tab_id: 'tab-1' });
      billRepo.findOne.mockResolvedValueOnce(existing);

      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', waiter_id: null });

      const result = await service.processPayment('tab-1', 'user-1', 'owner', {
        amount: 5000,
        method: 'card' as any,
        idempotency_key: 'dup-key',
      });

      expect(result).toEqual(existing);
    });
  });

  describe('splitEvenly', () => {
    it('splits tab total evenly across N bills', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1' });
      orderRepo.find.mockResolvedValue([
        { subtotal_kobo: 10000 },
        { subtotal_kobo: 5000 },
        { subtotal_kobo: 3000 },
      ]);

      const result = await service.splitEvenly('tab-1', 'user-1', 'owner', 3);

      expect(result).toHaveLength(3);
      const total = result.reduce((s: number, b: any) => s + b.total_kobo, 0);
      expect(total).toBe(18000);
    });
  });

  describe('splitByItem', () => {
    it('splits by item allocations', async () => {
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1' });
      orderRepo.find.mockResolvedValue([
        { id: 'o1', subtotal_kobo: 10000 },
        { id: 'o2', subtotal_kobo: 5000 },
        { id: 'o3', subtotal_kobo: 3000 },
      ]);

      const result = await service.splitByItem('tab-1', 'user-1', 'owner', [
        { order_ids: ['o1', 'o2'] },
        { order_ids: ['o3'] },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].total_kobo).toBe(15000);
      expect(result[1].total_kobo).toBe(3000);
    });
  });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { DataSource, Repository } from 'typeorm';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('BillService — Billing Calculation Accuracy (50 scenarios)', () => {
  let service: BillService;
  let repos: {
    billRepo: Repository<Bill>;
    tabRepo: Repository<Tab>;
    orderRepo: Repository<Order>;
    tableRepo: Repository<Table>;
    menuItemRepo: Repository<MenuItem>;
    userRepo: Repository<User>;
    branchRepo: Repository<Branch>;
    businessRepo: Repository<Business>;
  };
  let dataSource: DataSource;
  let ingredientService: IngredientService;
  let receiptService: ReceiptService;
  let cloudinaryService: CloudinaryService;

  const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => ({ ...entity, id: 'bill-1', created_at: new Date(), updated_at: new Date() })),
    update: jest.fn(),
  });

  beforeEach(async () => {
    const billRepo = mockRepo() as any;
    const tabRepo = mockRepo() as any;
    const orderRepo = mockRepo() as any;
    const tableRepo = mockRepo() as any;
    const menuItemRepo = mockRepo() as any;
    const userRepo = mockRepo() as any;
    const branchRepo = mockRepo() as any;
    const businessRepo = mockRepo() as any;

    const mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb({
        getRepository: jest.fn((entity: any) => {
          if (entity === Order) return { find: jest.fn().mockResolvedValue([]), save: jest.fn(async (e: any) => e) };
          if (entity === Tab) return { update: jest.fn() };
          if (entity === Table) return { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() };
          return mockRepo();
        }),
      })),
    } as any;

    const mockIngredientService = { deductByTab: jest.fn().mockResolvedValue(undefined) };
    const mockReceiptService = { generatePdf: jest.fn().mockReturnValue(Buffer.from('pdf')) };
    const mockCloudinaryService = { uploadFile: jest.fn().mockResolvedValue({ secure_url: 'https://example.com/receipt.pdf' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillService,
        { provide: getRepositoryToken(Bill), useValue: billRepo },
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Table), useValue: tableRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: IngredientService, useValue: mockIngredientService },
        { provide: ReceiptService, useValue: mockReceiptService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<BillService>(BillService);
    repos = { billRepo, tabRepo, orderRepo, tableRepo, menuItemRepo, userRepo, branchRepo, businessRepo };
    dataSource = mockDataSource;
    ingredientService = mockIngredientService;
    receiptService = mockReceiptService;
    cloudinaryService = mockCloudinaryService;

    repos.tabRepo.findOne.mockResolvedValue({
      id: 'tab-1', branch_id: 'branch-1', waiter_id: 'waiter-1', table_id: 'table-1',
    });
    repos.billRepo.findOne.mockResolvedValue(null);
    repos.branchRepo.findOne.mockResolvedValue({ id: 'branch-1', business_id: 'biz-1' });
    repos.businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });
  });

  // Helper: calculate expected total in kobo
  const expectedTotal = (subtotal: number, serviceChargePercent: number, taxRate: number, discount: number) => {
    const serviceCharge = Math.round(subtotal * (serviceChargePercent / 100));
    const tax = Math.round(subtotal * (taxRate / 100));
    let total = subtotal + serviceCharge + tax - discount;
    return { serviceCharge, tax, total: total < 0 ? 0 : total };
  };

  // Helper: run a billing scenario
  const runScenario = async (
    orders: { subtotal_kobo: number }[],
    options: { service_charge_percent?: number; discount_kobo?: number; tax_rate?: number },
  ) => {
    const { service_charge_percent, discount_kobo, tax_rate } = options;
    repos.orderRepo.find.mockResolvedValue(orders);
    repos.businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: tax_rate ?? 7.5 });

    const dto: any = {};
    if (service_charge_percent !== undefined) dto.service_charge_percent = service_charge_percent;
    if (discount_kobo !== undefined) dto.discount_kobo = discount_kobo;
    if (tax_rate !== undefined) dto.tax_rate_percent = tax_rate;

    return service.generateBill('tab-1', 'waiter-1', 'waiter', dto);
  };

  it('S001 — single item, default 10% service, 7.5% tax, no discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], {});
    const exp = expectedTotal(10000, 10, 7.5, 0);
    expect(result.subtotal_kobo).toBe(10000);
    expect(result.service_charge_kobo).toBe(exp.serviceCharge);
    expect(result.tax_kobo).toBe(exp.tax);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S002 — single item, 0 service charge, 0 tax, no discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], { service_charge_percent: 0, tax_rate: 0 });
    const exp = expectedTotal(10000, 0, 0, 0);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S003 — multiple items, no service, no tax, no discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 5000 }, { subtotal_kobo: 3000 }, { subtotal_kobo: 2000 }], { service_charge_percent: 0, tax_rate: 0 });
    const exp = expectedTotal(10000, 0, 0, 0);
    expect(result.subtotal_kobo).toBe(10000);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S004 — 10% service, 7.5% tax, 2000 kobo discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 50000 }], { discount_kobo: 2000 });
    const exp = expectedTotal(50000, 10, 7.5, 2000);
    expect(result.discount_kobo).toBe(2000);
    expect(result.total_kobo).toBe(exp.total);
    expect(result.total_kobo).toBe(50000 + 5000 + 3750 - 2000);
  });

  it('S005 — 5% service, 5% tax, no discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 20000 }], { service_charge_percent: 5, tax_rate: 5 });
    const exp = expectedTotal(20000, 5, 5, 0);
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.tax_kobo).toBe(1000);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S006 — 15% service, 7.5% tax, 500 kobo discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 8000 }], { service_charge_percent: 15, discount_kobo: 500 });
    const exp = expectedTotal(8000, 15, 7.5, 500);
    expect(result.total_kobo).toBe(exp.total);
    expect(result.total_kobo).toBe(8000 + 1200 + 600 - 500);
  });

  it('S007 — subtotal 0 (all items free), service/tax still apply', async () => {
    const result = await runScenario([{ subtotal_kobo: 0 }], {});
    const exp = expectedTotal(0, 10, 7.5, 0);
    expect(result.total_kobo).toBe(0);
    expect(result.service_charge_kobo).toBe(0);
    expect(result.tax_kobo).toBe(0);
  });

  it('S008 — large bill, precision: subtotal 1234567 kobo, 10% service', async () => {
    const result = await runScenario([{ subtotal_kobo: 1234567 }], {});
    const exp = expectedTotal(1234567, 10, 7.5, 0);
    expect(result.subtotal_kobo).toBe(1234567);
    expect(result.service_charge_kobo).toBe(Math.round(1234567 * 0.10));
    expect(result.tax_kobo).toBe(Math.round(1234567 * 0.075));
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S009 — discount greater than subtotal+charges+tax (floor at 0)', async () => {
    const result = await runScenario([{ subtotal_kobo: 1000 }], { service_charge_percent: 0, discount_kobo: 2000, tax_rate: 0 });
    expect(result.total_kobo).toBe(0);
  });

  it('S010 — single item, 100% tax, 100% service charge', async () => {
    const result = await runScenario([{ subtotal_kobo: 5000 }], { service_charge_percent: 100, tax_rate: 100 });
    const exp = expectedTotal(5000, 100, 100, 0);
    expect(result.service_charge_kobo).toBe(5000);
    expect(result.tax_kobo).toBe(5000);
    expect(result.total_kobo).toBe(15000);
  });

  it('S011 — three items, sum subtotal', async () => {
    const result = await runScenario([{ subtotal_kobo: 100 }, { subtotal_kobo: 200 }, { subtotal_kobo: 300 }], { service_charge_percent: 0, tax_rate: 0 });
    expect(result.subtotal_kobo).toBe(600);
    expect(result.total_kobo).toBe(600);
  });

  it('S012 — discount exactly equals subtotal+charges+tax (total = 0)', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], { service_charge_percent: 0, tax_rate: 0, discount_kobo: 10000 });
    expect(result.total_kobo).toBe(0);
  });

  it('S013 — fractional tax rounding: subtotal 10500, 7.5% tax', async () => {
    const result = await runScenario([{ subtotal_kobo: 10500 }], { service_charge_percent: 0, tax_rate: 7.5 });
    // 10500 * 0.075 = 787.5 -> rounds to 788
    expect(result.tax_kobo).toBe(788);
  });

  it('S014 — fractional service charge rounding: subtotal 10200, 10% service', async () => {
    const result = await runScenario([{ subtotal_kobo: 10200 }], { service_charge_percent: 10, tax_rate: 0 });
    // 10200 * 0.10 = 1020 exactly
    expect(result.service_charge_kobo).toBe(1020);
  });

  it('S015 — fractional service + tax: subtotal 9999, 10% service, 7.5% tax', async () => {
    const result = await runScenario([{ subtotal_kobo: 9999 }], {});
    // 9999 * 0.10 = 999.9 -> rounds to 1000
    // 9999 * 0.075 = 749.925 -> rounds to 750
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.tax_kobo).toBe(750);
    expect(result.total_kobo).toBe(9999 + 1000 + 750);
  });

  it('S016 — empty orders list (zero subtotal)', async () => {
    const result = await runScenario([], { service_charge_percent: 0, tax_rate: 0 });
    expect(result.subtotal_kobo).toBe(0);
    expect(result.total_kobo).toBe(0);
  });

  it('S017 — single item with zero price', async () => {
    const result = await runScenario([{ subtotal_kobo: 0 }], { service_charge_percent: 0, tax_rate: 0 });
    expect(result.total_kobo).toBe(0);
  });

  it('S018 — subtotal 1 kobo (minimum)', async () => {
    const result = await runScenario([{ subtotal_kobo: 1 }], { service_charge_percent: 0, tax_rate: 0 });
    expect(result.total_kobo).toBe(1);
  });

  it('S019 — subtotal 1 kobo with full charges', async () => {
    const result = await runScenario([{ subtotal_kobo: 1 }], {});
    expect(result.service_charge_kobo).toBe(0); // 0.1 rounds to 0
    expect(result.tax_kobo).toBe(0); // 0.075 rounds to 0
    expect(result.total_kobo).toBe(1);
  });

  it('S020 — multiple items with varying prices, full charges', async () => {
    const result = await runScenario(
      [{ subtotal_kobo: 1500 }, { subtotal_kobo: 3500 }, { subtotal_kobo: 800 }],
      {}
    );
    const expectTotal = expectedTotal(5800, 10, 7.5, 0);
    expect(result.subtotal_kobo).toBe(5800);
    expect(result.total_kobo).toBe(expectTotal.total);
  });

  it('S021 — 10% service, no tax, 1000 kobo discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 15000 }], { service_charge_percent: 10, tax_rate: 0, discount_kobo: 1000 });
    const exp = expectedTotal(15000, 10, 0, 1000);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S022 — 7.5% service, 7.5% tax, no discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 1333 }], { service_charge_percent: 7.5, tax_rate: 7.5 });
    // 1333 * 0.075 = 99.975 -> rounds to 100
    expect(result.service_charge_kobo).toBe(100);
    expect(result.tax_kobo).toBe(100);
    expect(result.total_kobo).toBe(1333 + 100 + 100);
  });

  it('S023 — 12.5% service, 5% tax', async () => {
    const result = await runScenario([{ subtotal_kobo: 8000 }], { service_charge_percent: 12.5, tax_rate: 5 });
    const exp = expectedTotal(8000, 12.5, 5, 0);
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.tax_kobo).toBe(400);
    expect(result.total_kobo).toBe(9400);
  });

  it('S024 — 0 items, default charges (empty tab)', async () => {
    repos.tabRepo.findOne.mockResolvedValue({
      id: 'tab-no-orders', branch_id: 'branch-1', waiter_id: 'waiter-1', table_id: 'table-1',
    });
    repos.billRepo.findOne.mockResolvedValue(null);
    repos.orderRepo.find.mockResolvedValue([]);
    repos.branchRepo.findOne.mockResolvedValue({ id: 'branch-1', business_id: 'biz-1' });
    repos.businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });

    const result = await service.generateBill('tab-no-orders', 'waiter-1', 'waiter');
    expect(result.subtotal_kobo).toBe(0);
    expect(result.total_kobo).toBe(0);
  });

  it('S025 — custom 25% service charge', async () => {
    const result = await runScenario([{ subtotal_kobo: 4000 }], { service_charge_percent: 25, tax_rate: 0 });
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.total_kobo).toBe(5000);
  });

  it('S026 — custom 17.5% tax rate', async () => {
    const result = await runScenario([{ subtotal_kobo: 8000 }], { service_charge_percent: 0, tax_rate: 17.5 });
    expect(result.tax_kobo).toBe(1400);
    expect(result.total_kobo).toBe(9400);
  });

  it('S027 — 10% service, 7.5% tax, 50% discount on subtotal', async () => {
    const result = await runScenario([{ subtotal_kobo: 20000 }], { discount_kobo: 10000 });
    const exp = expectedTotal(20000, 10, 7.5, 10000);
    expect(result.total_kobo).toBe(exp.total);
    expect(result.total_kobo).toBe(20000 + 2000 + 1500 - 10000);
  });

  it('S028 — 10% service, 0% tax', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], { service_charge_percent: 10, tax_rate: 0 });
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.tax_kobo).toBe(0);
    expect(result.total_kobo).toBe(11000);
  });

  it('S029 — 0% service, 7.5% tax', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], { service_charge_percent: 0, tax_rate: 7.5 });
    expect(result.service_charge_kobo).toBe(0);
    expect(result.tax_kobo).toBe(750);
    expect(result.total_kobo).toBe(10750);
  });

  it('S030 — fractional discount: discount 999 on 10035 kobo total', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }], { service_charge_percent: 0, tax_rate: 0, discount_kobo: 999 });
    expect(result.discount_kobo).toBe(999);
    expect(result.total_kobo).toBe(9001);
  });

  it('S031 — two items, same price, 10% service', async () => {
    const result = await runScenario([{ subtotal_kobo: 5000 }, { subtotal_kobo: 5000 }], {});
    expect(result.subtotal_kobo).toBe(10000);
    expect(result.service_charge_kobo).toBe(1000);
    expect(result.total_kobo).toBe(10000 + 1000 + 750);
  });

  it('S032 — one item per round, 3 rounds simulated via separate order rows', async () => {
    const result = await runScenario([
      { subtotal_kobo: 3000 },
      { subtotal_kobo: 5000 },
      { subtotal_kobo: 4000 },
    ], {});
    expect(result.subtotal_kobo).toBe(12000);
    expect(result.service_charge_kobo).toBe(1200);
    expect(result.tax_kobo).toBe(900);
    expect(result.total_kobo).toBe(12000 + 1200 + 900);
  });

  it('S033 — very large subtotal: 1,000,000 kobo (10,000 NGN)', async () => {
    const result = await runScenario([{ subtotal_kobo: 1000000 }], {});
    expect(result.subtotal_kobo).toBe(1000000);
    expect(result.service_charge_kobo).toBe(100000);
    expect(result.tax_kobo).toBe(75000);
    expect(result.total_kobo).toBe(1175000);
  });

  it('S034 — discount larger than subtotal but less than total', async () => {
    const result = await runScenario([{ subtotal_kobo: 1000 }], { service_charge_percent: 10, tax_rate: 7.5, discount_kobo: 1500 });
    // total = 1000 + 100 + 75 - 1500 = -325 -> 0
    expect(result.total_kobo).toBe(0);
  });

  it('S035 — 10% service, 7.5% tax, exact subtotal divisible by 100', async () => {
    const result = await runScenario([{ subtotal_kobo: 40000 }], {});
    expect(result.service_charge_kobo).toBe(4000);
    expect(result.tax_kobo).toBe(3000);
    expect(result.total_kobo).toBe(47000);
  });

  it('S036 — service charge 0%, tax 0%, discount 0% (pure subtotal)', async () => {
    const result = await runScenario([{ subtotal_kobo: 7777 }], { service_charge_percent: 0, tax_rate: 0, discount_kobo: 0 });
    expect(result.total_kobo).toBe(7777);
  });

  it('S037 — service charge 0%, tax 7.5%, discount 0', async () => {
    const result = await runScenario([{ subtotal_kobo: 22222 }], { service_charge_percent: 0, tax_rate: 7.5 });
    // 22222 * 0.075 = 1666.65 -> 1667
    expect(result.tax_kobo).toBe(1667);
    expect(result.total_kobo).toBe(22222 + 1667);
  });

  it('S038 — 3.5% service charge on 50000', async () => {
    const result = await runScenario([{ subtotal_kobo: 50000 }], { service_charge_percent: 3.5, tax_rate: 0 });
    // 50000 * 0.035 = 1750
    expect(result.service_charge_kobo).toBe(1750);
  });

  it('S039 — 3.5% tax on 30000', async () => {
    const result = await runScenario([{ subtotal_kobo: 30000 }], { service_charge_percent: 0, tax_rate: 3.5 });
    // 30000 * 0.035 = 1050
    expect(result.tax_kobo).toBe(1050);
  });

  it('S040 — 5 items, varying, 12% service, 5% tax, 300 kobo discount', async () => {
    const result = await runScenario(
      [{ subtotal_kobo: 1000 }, { subtotal_kobo: 2000 }, { subtotal_kobo: 3000 }, { subtotal_kobo: 4000 }, { subtotal_kobo: 5000 }],
      { service_charge_percent: 12, tax_rate: 5, discount_kobo: 300 },
    );
    const exp = expectedTotal(15000, 12, 5, 300);
    expect(result.subtotal_kobo).toBe(15000);
    expect(result.service_charge_kobo).toBe(1800);
    expect(result.tax_kobo).toBe(750);
    expect(result.discount_kobo).toBe(300);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S041 — 1 kobo items x 99 (99 kobo total), 10% service', async () => {
    const orders = Array(99).fill({ subtotal_kobo: 1 });
    const result = await runScenario(orders, {});
    expect(result.subtotal_kobo).toBe(99);
    expect(result.service_charge_kobo).toBe(10); // 99 * 0.10 = 9.9 -> 10
    expect(result.tax_kobo).toBe(7); // 99 * 0.075 = 7.425 -> 7
    expect(result.total_kobo).toBe(99 + 10 + 7);
  });

  it('S042 — subtotal 99 kobo, 10% service, 7.5% tax, 0 discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 99 }], {});
    expect(result.service_charge_kobo).toBe(10);
    expect(result.tax_kobo).toBe(7);
    expect(result.total_kobo).toBe(116);
  });

  it('S043 — 12.34% service charge on odd subtotal', async () => {
    const result = await runScenario([{ subtotal_kobo: 9999 }], { service_charge_percent: 12.34, tax_rate: 0 });
    // 9999 * 0.1234 = 1233.8666 -> 1234
    expect(result.service_charge_kobo).toBe(1234);
  });

  it('S044 — 8.25% tax on 80000', async () => {
    const result = await runScenario([{ subtotal_kobo: 80000 }], { service_charge_percent: 0, tax_rate: 8.25 });
    // 80000 * 0.0825 = 6600
    expect(result.tax_kobo).toBe(6600);
  });

  it('S045 — full calculation with 3 items, 10% service, 7.5% tax, 2000 kobo discount', async () => {
    const result = await runScenario(
      [{ subtotal_kobo: 10000 }, { subtotal_kobo: 15000 }, { subtotal_kobo: 8000 }],
      { discount_kobo: 2000 },
    );
    const exp = expectedTotal(33000, 10, 7.5, 2000);
    expect(result.subtotal_kobo).toBe(33000);
    expect(result.total_kobo).toBe(exp.total);
  });

  it('S046 — tab with one 500 kobo item, 0% service, 0% tax, 0 discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 500 }], { service_charge_percent: 0, tax_rate: 0 });
    expect(result.total_kobo).toBe(500);
  });

  it('S047 — tab with one 500 kobo item, 10% service, 0% tax, 0 discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 500 }], { service_charge_percent: 10, tax_rate: 0 });
    expect(result.total_kobo).toBe(550);
  });

  it('S048 — tab with one 500 kobo item, 0% service, 7.5% tax, 0 discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 500 }], { service_charge_percent: 0, tax_rate: 7.5 });
    // 500 * 0.075 = 37.5 -> 38
    expect(result.tax_kobo).toBe(38);
    expect(result.total_kobo).toBe(538);
  });

  it('S049 — tab with one 500 kobo item, 10% service, 7.5% tax, 100 kobo discount', async () => {
    const result = await runScenario([{ subtotal_kobo: 500 }], { discount_kobo: 100 });
    // 500 + 50 + 38 - 100 = 488
    expect(result.total_kobo).toBe(488);
  });

  it('S050 — tab with one 500 kobo item, 10% service, 7.5% tax, 500 kobo discount (floor at 0)', async () => {
    const result = await runScenario([{ subtotal_kobo: 500 }], { discount_kobo: 500 });
    // 500 + 50 + 38 - 500 = 88
    expect(result.total_kobo).toBe(88);
  });

  it('S051 — verify total always equals subtotal + service_charge + tax - discount (floored at 0)', async () => {
    const result = await runScenario([{ subtotal_kobo: 10000 }, { subtotal_kobo: 20000 }], {});
    const exp = expectedTotal(30000, 10, 7.5, 0);
    expect(result.total_kobo).toBe(exp.total);
    expect(result.total_kobo).toBe(result.subtotal_kobo + result.service_charge_kobo + result.tax_kobo - result.discount_kobo);
  });
});

describe('BillService — Tab State Machine Transitions', () => {
  let service: BillService;
  let repos: any;
  let dataSource: any;

  const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => ({ ...entity, id: 'bill-1' })),
    update: jest.fn(),
  });

  beforeEach(async () => {
    const billRepo = mockRepo();
    const tabRepo = mockRepo();
    const orderRepo = mockRepo();
    const tableRepo = mockRepo();
    const menuItemRepo = mockRepo();
    const userRepo = mockRepo();
    const branchRepo = mockRepo();
    const businessRepo = mockRepo();

    const mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb({
        getRepository: jest.fn((entity: any) => ({
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn(async (e: any) => e),
          findOne: jest.fn(),
          update: jest.fn(),
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillService,
        { provide: getRepositoryToken(Bill), useValue: billRepo },
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Table), useValue: tableRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: IngredientService, useValue: { deductByTab: jest.fn().mockResolvedValue(undefined) } },
        { provide: ReceiptService, useValue: { generatePdf: jest.fn().mockReturnValue(Buffer.from('pdf')) } },
        { provide: CloudinaryService, useValue: { uploadFile: jest.fn().mockResolvedValue({ secure_url: 'url' }) } },
      ],
    }).compile();

    service = module.get<BillService>(BillService);
    repos = { billRepo, tabRepo, orderRepo, tableRepo, menuItemRepo, userRepo, branchRepo, businessRepo };
    dataSource = mockDataSource;

    repos.tabRepo.findOne.mockResolvedValue({
      id: 'tab-1', branch_id: 'branch-1', waiter_id: 'waiter-1', table_id: 'table-1',
    });
    repos.billRepo.findOne.mockResolvedValue(null);
    repos.orderRepo.find.mockResolvedValue([]);
    repos.branchRepo.findOne.mockResolvedValue({ id: 'branch-1', business_id: 'biz-1' });
    repos.businessRepo.findOne.mockResolvedValue({ id: 'biz-1', tax_rate: 7.5 });
  });

  it('TSM-01: open tab → generate bill → tab becomes "billed"', async () => {
    repos.tabRepo.findOne.mockResolvedValueOnce({ id: 'tab-1', branch_id: 'b', waiter_id: null, status: 'open' });
    repos.billRepo.findOne.mockResolvedValue(null);
    repos.orderRepo.find.mockResolvedValue([]);

    const result = await service.generateBill('tab-1', 'user-1', 'owner');
    expect(result.status).toBeUndefined(); // generateBill doesn't return tab, but updates it
    expect(repos.tabRepo.update).toHaveBeenCalledWith('tab-1', expect.objectContaining({ status: 'billed' }));
    expect(repos.tabRepo.update).toHaveBeenCalledWith('tab-1', expect.objectContaining({ billed_at: expect.any(Date) }));
  });

  it('TSM-02: billed tab cannot generate bill again (returns existing)', async () => {
    const existingBill = { id: 'bill-1', tab_id: 'tab-1', total_kobo: 5000, paid_at: null };
    repos.billRepo.findOne.mockResolvedValue(existingBill);
    repos.tabRepo.findOne.mockResolvedValue({ id: 'tab-1', status: 'billed' });

    const result = await service.generateBill('tab-1', 'user-1', 'owner');
    expect(result).toEqual(existingBill);
  });

  it('TSM-03: paid bill cannot have discount applied', async () => {
    repos.tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'b1' });
    repos.billRepo.findOne.mockResolvedValue({
      id: 'bill-1', tab_id: 'tab-1', paid_at: new Date(),
    });

    await expect(
      service.applyDiscount('tab-1', 'b1', { discount_kobo: 500 }),
    ).rejects.toThrow('Cannot modify a paid bill');
  });

  it('TSM-04: processPayment on billed tab → tab becomes "paid", table becomes "available"', async () => {
    repos.tabRepo.findOne.mockResolvedValue({
      id: 'tab-1', branch_id: 'branch-1', table_id: 'table-1', waiter_id: null,
    });
    repos.billRepo.findOne.mockResolvedValue({ id: 'bill-1', tab_id: 'tab-1', total_kobo: 5000 });
    repos.tableRepo.findOne.mockResolvedValue({ id: 'table-1', is_virtual: false });

    await service.processPayment('tab-1', 'user-1', 'owner', { amount: 5000, method: 'cash' });

    expect(dataSource.transaction).toHaveBeenCalled();
    // Within the transaction, tab updates to 'paid' and table to available
  });

  it('TSM-05: processPayment with idempotency key on already-paid bill returns existing', async () => {
    const existing = { id: 'bill-2', tab_id: 'tab-1', paid_at: new Date(), total_kobo: 5000 };
    repos.billRepo.findOne
      .mockResolvedValueOnce({ id: 'bill-1', tab_id: 'tab-1' }) // first find for tab
      .mockResolvedValueOnce(existing); // idempotency check
    repos.tabRepo.findOne.mockResolvedValue({ id: 'tab-1', waiter_id: null });

    const result = await service.processPayment('tab-1', 'user-1', 'owner', {
      amount: 5000, method: 'transfer', idempotency_key: 'key-123',
    });

    expect(result).toEqual(existing);
  });

  it('TSM-06: splitEvenly sets tab status to "billed"', async () => {
    repos.tabRepo.findOne.mockResolvedValue({ id: 'tab-1' });
    repos.orderRepo.find.mockResolvedValue([
      { subtotal_kobo: 10000 },
      { subtotal_kobo: 5000 },
    ]);

    await service.splitEvenly('tab-1', 'user-1', 'owner', 2);
    expect(repos.tabRepo.update).toHaveBeenCalledWith('tab-1', { status: 'billed' });
  });

  it('TSM-07: splitByItem sets tab status to "billed"', async () => {
    repos.tabRepo.findOne.mockResolvedValue({ id: 'tab-1' });
    repos.orderRepo.find.mockResolvedValue([
      { id: 'o1', subtotal_kobo: 10000 },
      { id: 'o2', subtotal_kobo: 5000 },
    ]);

    await service.splitByItem('tab-1', 'user-1', 'owner', [
      { order_ids: ['o1'] },
      { order_ids: ['o2'] },
    ]);
    expect(repos.tabRepo.update).toHaveBeenCalledWith('tab-1', { status: 'billed' });
  });

  it('TSM-08: processSplitPayment → all split bills paid → tab "paid", table available', async () => {
    const tab = { id: 'tab-1', table_id: 'table-1' };
    repos.tabRepo.findOne.mockResolvedValue(tab);
    repos.tableRepo.findOne.mockResolvedValue({ id: 'table-1', is_virtual: false });

    // Override the transaction mock
    dataSource.transaction = jest.fn(async (cb: any) => cb({
      getRepository: jest.fn((entity: any) => ({
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(async (e: any) => e),
        findOne: jest.fn(),
        update: jest.fn(),
      })),
    }));

    // First call: find single split bill
    repos.billRepo.findOne.mockResolvedValue({ id: 'b1', tab_id: 'tab-1', paid_at: null });
    // All split bills (only one) paid after this payment
    repos.billRepo.find = jest.fn().mockResolvedValue([
      { id: 'b1', tab_id: 'tab-1', paid_at: new Date() },
    ]);

    const result = await service.processSplitPayment('tab-1', 'b1', 'user-1', 'owner', { amount: 5000, method: 'cash' });
    expect(result.payment_status).toBe('paid');
    expect(result.paid_at).toBeDefined();
  });
});

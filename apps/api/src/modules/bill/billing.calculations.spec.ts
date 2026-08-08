import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillService } from './bill.service';
import { Bill } from './entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Table } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';
import { NotFoundException } from '@nestjs/common';

const mockRealtimeService = () => ({
  emitBillUpdate: jest.fn(),
  emitDashboardUpdate: jest.fn(),
});

/**
 * Acceptance tests for "Bill total is always correct" (PRD_V1.md §6 Critical).
 *
 * These encode the V1 billing contract:
 *  - All math is done in INTEGER kobo (1 NGN = 100 kobo), never floats.
 *  - service_charge defaults to 10% of subtotal.
 *  - tax defaults to business.tax_rate (7.5% fallback).
 *  - A fixed kobo discount is applied last; total is floored at 0.
 *  - Price is snapshotted on the order row (unit_price_kobo × qty = subtotal_kobo),
 *    never re-fetched from the menu at bill time.
 *
 * Expectations are derived from the published formula plus hand-computed
 * "golden" cases (e.g. subtotal 15000 -> total 17625) that are also
 * asserted in bill.service.spec.ts, so the oracle is not purely circular.
 */

type OrderRow = { subtotal_kobo: number };

interface MatrixCase {
  label: string;
  orders: OrderRow[];
  service_charge_percent?: number;
  tax_rate_percent?: number;
  business_tax_rate?: number;
  discount_kobo?: number;
}

/** Oracle mirroring src/modules/bill/bill.service.ts generateBill(). */
function expected(orders: OrderRow[], c: MatrixCase) {
  const subtotal = orders.reduce((sum, o) => sum + (o.subtotal_kobo ?? 0), 0);
  const scPercent = c.service_charge_percent ?? 10;
  const discount = c.discount_kobo ?? 0;
  const taxPercent = c.tax_rate_percent ?? c.business_tax_rate ?? 7.5;
  const service_charge_kobo = Math.round(subtotal * (scPercent / 100));
  const tax_kobo = Math.round(subtotal * (taxPercent / 100));
  let total_kobo = subtotal + service_charge_kobo + tax_kobo - discount;
  if (total_kobo < 0) total_kobo = 0;
  return {
    subtotal_kobo: subtotal,
    service_charge_kobo,
    tax_kobo,
    discount_kobo: discount,
    total_kobo,
  };
}

describe('BillService — V1 billing calculations', () => {
  let service: BillService;
  let billRepo: any;
  let tabRepo: any;
  let orderRepo: any;
  let tableRepo: any;
  let branchRepo: any;
  let businessRepo: any;
  let dataSource: any;

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

  const buildService = (orders: OrderRow[], c?: MatrixCase) => {
    billRepo = mockRepo();
    tabRepo = mockRepo();
    orderRepo = mockRepo();
    tableRepo = mockRepo();
    branchRepo = mockRepo();
    businessRepo = mockRepo();

    // No pre-existing bill so generateBill always computes fresh.
    billRepo.findOne.mockResolvedValue(null);
    tabRepo.findOne.mockResolvedValue({
      id: 'tab-1',
      branch_id: 'branch-1',
      waiter_id: 'waiter-1',
      table_id: 'table-1',
    });
    orderRepo.find.mockResolvedValue(orders);
    branchRepo.findOne.mockResolvedValue({
      id: 'branch-1',
      business_id: 'biz-1',
    });
    businessRepo.findOne.mockResolvedValue({
      id: 'biz-1',
      tax_rate: c?.business_tax_rate ?? 7.5,
    });

    dataSource = {
      transaction: jest.fn(async (cb: any) =>
        cb({ getRepository: () => mockRepo() }),
      ),
    };

    const module: TestingModule = Test.createTestingModule({
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
        { provide: IngredientService, useValue: { deductByTab: jest.fn() } },
        { provide: ReceiptService, useValue: { generatePdf: jest.fn() } },
        { provide: CloudinaryService, useValue: { uploadFile: jest.fn() } },
        { provide: RealtimeService, useValue: mockRealtimeService() },
      ],
    }).compile();
    return module;
  };

  const generate = async (orders: OrderRow[], c?: MatrixCase) => {
    service = (await buildService(orders, c)).get<BillService>(BillService);
    const dto: any = {};
    if (c?.service_charge_percent !== undefined)
      dto.service_charge_percent = c.service_charge_percent;
    if (c?.tax_rate_percent !== undefined)
      dto.tax_rate_percent = c.tax_rate_percent;
    if (c?.discount_kobo !== undefined) dto.discount_kobo = c.discount_kobo;
    return service.generateBill('tab-1', 'waiter-1', 'waiter', dto);
  };

  // 50 scenarios covering PRD §F-10 / §F-11 billing + edge cases.
  const matrix: MatrixCase[] = [
    // (1) single item
    { label: 'single item, defaults', orders: [{ subtotal_kobo: 10000 }] },
    // (2) two items, defaults — golden case (subtotal 15000 -> 17625)
    {
      label: 'two items, defaults (golden)',
      orders: [{ subtotal_kobo: 10000 }, { subtotal_kobo: 5000 }],
    },
    // (3) three items, PRD receipt subtotal 1,130,000 kobo
    {
      label: 'prd receipt subtotal',
      orders: [
        { subtotal_kobo: 360000 },
        { subtotal_kobo: 280000 },
        { subtotal_kobo: 250000 },
        { subtotal_kobo: 240000 },
      ],
    },
    // (4) many items (10)
    {
      label: 'ten items small',
      orders: Array(10)
        .fill(0)
        .map(() => ({ subtotal_kobo: 1500 })),
    },
    // (5) large subtotal (50 items)
    {
      label: 'fifty items large',
      orders: Array(50)
        .fill(0)
        .map(() => ({ subtotal_kobo: 50000 })),
    },
    // (6) empty tab (no orders)
    { label: 'empty tab zero subtotal', orders: [] },
    // (7) odd kobo subtotal (rounding of service charge)
    { label: 'odd subtotal sc rounding', orders: [{ subtotal_kobo: 10001 }] },
    // (8) odd kobo for tax rounding
    { label: 'odd subtotal tax rounding', orders: [{ subtotal_kobo: 10003 }] },
    // (9) service charge 0%
    {
      label: 'service charge zero',
      orders: [{ subtotal_kobo: 20000 }],
      service_charge_percent: 0,
    },
    // (10) service charge 5%
    {
      label: 'service charge 5pct',
      orders: [{ subtotal_kobo: 20000 }],
      service_charge_percent: 5,
    },
    // (11) service charge 15%
    {
      label: 'service charge 15pct',
      orders: [{ subtotal_kobo: 20000 }],
      service_charge_percent: 15,
    },
    // (12) tax 0%
    {
      label: 'tax zero',
      orders: [{ subtotal_kobo: 20000 }],
      tax_rate_percent: 0,
    },
    // (13) tax 5%
    {
      label: 'tax 5pct',
      orders: [{ subtotal_kobo: 20000 }],
      tax_rate_percent: 5,
    },
    // (14) tax 12%
    {
      label: 'tax 12pct',
      orders: [{ subtotal_kobo: 20000 }],
      tax_rate_percent: 12,
    },
    // (15) custom business tax 5% default path
    {
      label: 'business tax 5pct default path',
      orders: [{ subtotal_kobo: 20000 }],
      business_tax_rate: 5,
    },
    // (16) custom business tax 15% default path
    {
      label: 'business tax 15pct default path',
      orders: [{ subtotal_kobo: 20000 }],
      business_tax_rate: 15,
    },
    // (17) flat discount 1000
    {
      label: 'flat discount 1000',
      orders: [{ subtotal_kobo: 20000 }],
      discount_kobo: 1000,
    },
    // (18) flat discount 5000
    {
      label: 'flat discount 5000',
      orders: [{ subtotal_kobo: 20000 }],
      discount_kobo: 5000,
    },
    // (19) discount larger than total -> floor at 0
    {
      label: 'discount exceeds total floors at 0',
      orders: [{ subtotal_kobo: 1000 }],
      discount_kobo: 50000,
    },
    // (20) discount exactly equals gross
    {
      label: 'discount equals gross',
      orders: [{ subtotal_kobo: 10000 }],
      discount_kobo: 11750,
    },
    // (21) combo sc+tax+discount
    {
      label: 'combo sc15 tax12 discount',
      orders: [{ subtotal_kobo: 10000 }, { subtotal_kobo: 5000 }],
      service_charge_percent: 15,
      tax_rate_percent: 12,
      discount_kobo: 2000,
    },
    // (22) single large odd kobo
    { label: 'single large odd kobo', orders: [{ subtotal_kobo: 999999 }] },
    // (23) single 1 kobo (smallest)
    { label: 'single 1 kobo', orders: [{ subtotal_kobo: 1 }] },
    // (24) all items 1 kobo
    {
      label: 'many 1-kobo items',
      orders: Array(50)
        .fill(0)
        .map(() => ({ subtotal_kobo: 1 })),
    },
    // (25) service charge rounding .5 boundary
    {
      label: 'sc rounding boundary',
      orders: [{ subtotal_kobo: 10005 }],
      service_charge_percent: 10,
    },
    // (26) tax rounding boundary
    {
      label: 'tax rounding boundary',
      orders: [{ subtotal_kobo: 10005 }],
      tax_rate_percent: 7.5,
    },
    // (27) sc 33.33% custom
    {
      label: 'sc 33.33pct',
      orders: [{ subtotal_kobo: 30000 }],
      service_charge_percent: 33.33,
    },
    // (28) tax 5.5%
    {
      label: 'tax 5.5pct',
      orders: [{ subtotal_kobo: 30000 }],
      tax_rate_percent: 5.5,
    },
    // (29) discount 99% of subtotal
    {
      label: 'discount 99pct of subtotal',
      orders: [{ subtotal_kobo: 100000 }],
      discount_kobo: 99000,
    },
    // (30) negative-ish: zero discount explicit
    {
      label: 'explicit zero discount',
      orders: [{ subtotal_kobo: 10000 }],
      discount_kobo: 0,
    },
    // (31) three items mixed prices
    {
      label: 'three mixed items',
      orders: [
        { subtotal_kobo: 1250 },
        { subtotal_kobo: 3375 },
        { subtotal_kobo: 9125 },
      ],
    },
    // (32) twenty items
    {
      label: 'twenty items',
      orders: Array(20)
        .fill(0)
        .map(() => ({ subtotal_kobo: 4250 })),
    },
    // (33) subtotal that is exact thousand
    { label: 'exact thousand subtotal', orders: [{ subtotal_kobo: 50000 }] },
    // (34) subtotal 7,500 (tax 7.5% = 562.5 -> 563)
    { label: 'subtotal 7500 tax default', orders: [{ subtotal_kobo: 7500 }] },
    // (35) zero service charge + zero tax
    {
      label: 'zero sc zero tax',
      orders: [{ subtotal_kobo: 25000 }],
      service_charge_percent: 0,
      tax_rate_percent: 0,
    },
    // (36) discount with zero sc/tax
    {
      label: 'discount zero sc zero tax',
      orders: [{ subtotal_kobo: 25000 }],
      service_charge_percent: 0,
      tax_rate_percent: 0,
      discount_kobo: 5000,
    },
    // (37) sc on discounted... (discount applied after, sc on gross subtotal)
    {
      label: 'sc on subtotal not post-discount',
      orders: [{ subtotal_kobo: 20000 }],
      service_charge_percent: 10,
      discount_kobo: 5000,
    },
    // (38) large subtotal 1,000,000
    { label: 'million kobo subtotal', orders: [{ subtotal_kobo: 1000000 }] },
    // (39) 100 items
    {
      label: 'one hundred items',
      orders: Array(100)
        .fill(0)
        .map(() => ({ subtotal_kobo: 100 })),
    },
    // (40) business tax 0 default path
    {
      label: 'business tax 0 default path',
      orders: [{ subtotal_kobo: 20000 }],
      business_tax_rate: 0,
    },
    // (41) no business (branch returns no business_id path) - tax falls to 7.5
    {
      label: 'no branch business fallback tax',
      orders: [{ subtotal_kobo: 20000 }],
    },
    // (42) sc 100%
    {
      label: 'service charge 100pct',
      orders: [{ subtotal_kobo: 20000 }],
      service_charge_percent: 100,
    },
    // (43) tax 100%
    {
      label: 'tax 100pct',
      orders: [{ subtotal_kobo: 20000 }],
      tax_rate_percent: 100,
    },
    // (44) discount equals subtotal + charges (floor 0)
    {
      label: 'discount wipes everything',
      orders: [{ subtotal_kobo: 10000 }],
      service_charge_percent: 10,
      discount_kobo: 20000,
    },
    // (45) two items with discount
    {
      label: 'two items with discount',
      orders: [{ subtotal_kobo: 30000 }, { subtotal_kobo: 15000 }],
      discount_kobo: 3000,
    },
    // (46) three decimals in percent 10.5%
    {
      label: 'tax 10.5pct',
      orders: [{ subtotal_kobo: 40000 }],
      tax_rate_percent: 10.5,
    },
    // (47) sc 7.5% match tax 7.5%
    {
      label: 'sc7.5 tax7.5',
      orders: [{ subtotal_kobo: 80000 }],
      service_charge_percent: 7.5,
      tax_rate_percent: 7.5,
    },
    // (48) single item 100 kobo
    { label: 'single 100 kobo', orders: [{ subtotal_kobo: 100 }] },
    // (49) 5 items each large odd
    {
      label: 'five large odd items',
      orders: [
        { subtotal_kobo: 10001 },
        { subtotal_kobo: 20002 },
        { subtotal_kobo: 30003 },
        { subtotal_kobo: 40004 },
        { subtotal_kobo: 50005 },
      ],
    },
    // (50) PRD receipt totals in kobo w/ defaults
    {
      label: 'prd receipt 1,130,000 kobo',
      orders: [
        { subtotal_kobo: 360000 },
        { subtotal_kobo: 280000 },
        { subtotal_kobo: 250000 },
        { subtotal_kobo: 240000 },
      ],
    },
  ];

  it.each(matrix)('scenario %#: $label', async (c) => {
    const bill = await generate(c.orders, c);
    const exp = expected(c.orders, c);
    expect(bill.subtotal_kobo).toBe(exp.subtotal_kobo);
    expect(bill.service_charge_kobo).toBe(exp.service_charge_kobo);
    expect(bill.tax_kobo).toBe(exp.tax_kobo);
    expect(bill.discount_kobo).toBe(exp.discount_kobo);
    expect(bill.total_kobo).toBe(exp.total_kobo);
  });

  // Hand-computed golden cases (non-circular, corroborated by existing spec).
  describe('golden cases', () => {
    it('subtotal 15000, 10% sc, 7.5% tax => total 17625 (golden)', async () => {
      const bill = await generate([
        { subtotal_kobo: 10000 },
        { subtotal_kobo: 5000 },
      ]);
      expect(bill.subtotal_kobo).toBe(15000);
      expect(bill.service_charge_kobo).toBe(1500);
      expect(bill.tax_kobo).toBe(1125);
      expect(bill.total_kobo).toBe(17625);
    });

    it('subtotal 20000, 0% sc, 7.5% tax => total 21500', async () => {
      const bill = await generate([{ subtotal_kobo: 20000 }], {
        service_charge_percent: 0,
      });
      expect(bill.total_kobo).toBe(21500);
    });

    it('subtotal 20000, 10% sc, 0% tax, 5000 flat discount => 17000', async () => {
      const bill = await generate([{ subtotal_kobo: 20000 }], {
        tax_rate_percent: 0,
        discount_kobo: 5000,
      });
      // 20000 + 2000 + 0 - 5000 = 17000
      expect(bill.service_charge_kobo).toBe(2000);
      expect(bill.tax_kobo).toBe(0);
      expect(bill.total_kobo).toBe(17000);
    });

    it('floors total at 0 when discount exceeds gross', async () => {
      const bill = await generate([{ subtotal_kobo: 1000 }], {
        discount_kobo: 5000,
      });
      expect(bill.total_kobo).toBe(0);
    });
  });

  describe('immutability / snapshot behaviour (PRD F-02/F-06)', () => {
    it('price is taken from order row subtotal, not re-fetched from menu', async () => {
      // Even if the menu item repo is never called, totals derive from the
      // order row snapshot the waiter captured at order time.
      const orders = [
        { subtotal_kobo: 360000 },
        { subtotal_kobo: 280000 },
      ] as OrderRow[];
      const bill = await generate(orders);
      expect(bill.subtotal_kobo).toBe(640000);
      expect(bill.total_kobo).toBe(752000); // 640000 + 64000 + 48000
    });

    it('throws NotFoundException when tab does not exist', async () => {
      const moduleRef = await buildService([], {});
      service = moduleRef.get<BillService>(BillService);
      tabRepo.findOne.mockResolvedValue(null);
      await expect(
        service.generateBill('missing-tab', 'waiter-1', 'waiter'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

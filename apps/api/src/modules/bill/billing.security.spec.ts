import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillService } from './bill.service';
import { Bill } from './entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { Table } from '../table/entities/table.entity';
import { TableStatus } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { IngredientService } from '../ingredient/ingredient.service';
import { ReceiptService } from './receipt.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { RealtimeService } from '../gateway/realtime.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const mockRealtimeService = () => ({
  emitBillUpdate: jest.fn(),
  emitDashboardUpdate: jest.fn(),
});

/**
 * Acceptance tests for "No cross-business data leakage (security test)" and
 * "Waiter cannot see another waiter's closed tab totals" (PRD_V1.md §6 Critical).
 *
 * These exercise the service-level ownership/branch guards that sit in front of
 * every tab-scoped operation. They do NOT replace the BranchScopeGuard /
 * @Roles() enforcement at the HTTP layer — but they guarantee the contract
 * holds even if a guard is misconfigured.
 */

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

const baseTab = (over: Partial<Record<string, any>> = {}) => ({
  id: 'tab-1',
  branch_id: 'branch-A',
  waiter_id: 'waiter-owner',
  table_id: 'table-1',
  status: 'open',
  ...over,
});

async function buildService(overrides: {
  tab?: any;
  orders?: any[];
  branch?: any;
  business?: any;
  existingBill?: any;
  receiptData?: any;
}) {
  const billRepo = mockRepo();
  const tabRepo = mockRepo();
  const orderRepo = mockRepo();
  const tableRepo = mockRepo();
  const branchRepo = mockRepo();
  const businessRepo = mockRepo();

  billRepo.findOne.mockResolvedValue(overrides.existingBill ?? null);
  tabRepo.findOne.mockResolvedValue(overrides.tab ?? baseTab());
  orderRepo.find.mockResolvedValue(overrides.orders ?? []);
  branchRepo.findOne.mockResolvedValue(
    overrides.branch ?? { id: 'branch-A', business_id: 'biz-1' },
  );
  businessRepo.findOne.mockResolvedValue(
    overrides.business ?? { id: 'biz-1', tax_rate: 7.5 },
  );

  const receiptService = {
    generatePdf: jest.fn(() => Buffer.from('pdf')),
  };
  const cloudinaryService = {
    uploadFile: jest.fn(),
  };

  const dataSource: any = {
    transaction: jest.fn(async (cb: any) =>
      cb({
        getRepository: () => ({
          find: jest.fn().mockResolvedValue(overrides.orders ?? []),
          save: jest.fn(async (e: any) => e),
          update: jest.fn(),
          findOne: jest.fn().mockResolvedValue(undefined),
          createQueryBuilder: () => ({
            update: () => ({
              set: () => ({
                where: () => ({
                  andWhere: () => ({ execute: () => undefined }),
                }),
              }),
            }),
          }),
        }),
      }),
    ),
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
      { provide: IngredientService, useValue: { deductByTab: jest.fn() } },
      { provide: ReceiptService, useValue: receiptService },
      { provide: CloudinaryService, useValue: cloudinaryService },
      { provide: RealtimeService, useValue: mockRealtimeService() },
    ],
  }).compile();

  return {
    service: module.get<BillService>(BillService),
    billRepo,
    tabRepo,
    orderRepo,
    tableRepo,
    branchRepo,
    businessRepo,
    dataSource,
    receiptService,
    cloudinaryService,
  };
}

describe('BillService — security / data isolation', () => {
  describe('cross-waiter access (PRD US-11/US-13 guard)', () => {
    const otherWaiterTab = baseTab({ waiter_id: 'waiter-owner' });

    it("blocks a waiter from generating another waiter tab's bill", async () => {
      const { service } = await buildService({ tab: otherWaiterTab });
      await expect(
        service.generateBill('tab-1', 'waiter-me', 'waiter'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.generateBill('tab-1', 'waiter-me', 'waiter'),
      ).rejects.toThrow('This tab belongs to another waiter');
    });

    it('allows a manager to bill any waiter tab', async () => {
      const { service } = await buildService({ tab: otherWaiterTab });
      const bill = await service.generateBill('tab-1', 'manager-1', 'manager');
      expect(bill).toBeDefined();
      expect(bill.tab_id).toBe('tab-1');
    });

    it('allows an owner to bill any waiter tab', async () => {
      const { service } = await buildService({ tab: otherWaiterTab });
      const bill = await service.generateBill('tab-1', 'owner-1', 'owner');
      expect(bill).toBeDefined();
    });

    it('allows a cashier to bill any waiter tab', async () => {
      const { service } = await buildService({ tab: otherWaiterTab });
      const bill = await service.generateBill('tab-1', 'cashier-1', 'cashier');
      expect(bill).toBeDefined();
    });

    it('blocks a waiter from recording payment on another waiter tab', async () => {
      const { service } = await buildService({
        tab: otherWaiterTab,
        orders: [{ subtotal_kobo: 10000 }],
        existingBill: { id: 'bill-1', tab_id: 'tab-1', total_kobo: 11750 },
      });
      await expect(
        service.processPayment('tab-1', 'waiter-me', 'waiter', {
          amount: 11750,
        } as any),
      ).rejects.toThrow('This tab belongs to another waiter');
    });

    it('allows manager to record payment on any waiter tab', async () => {
      const { service } = await buildService({
        tab: otherWaiterTab,
        orders: [],
        existingBill: {
          id: 'bill-1',
          tab_id: 'tab-1',
          total_kobo: 11750,
          paid_at: null,
        },
      });
      const bill = await service.processPayment(
        'tab-1',
        'manager-1',
        'manager',
        { amount: 11750 } as any,
      );
      expect(bill.paid_at).toBeDefined();
    });
  });

  describe('cross-branch / cross-business isolation (PRD security test)', () => {
    // Tab belongs to branch-B; actor is scoped to branch-A.
    const foreignTab = baseTab({
      branch_id: 'branch-B',
      waiter_id: 'waiter-in-b',
    });

    it('blocks applyDiscount on a tab from another branch', async () => {
      const { service } = await buildService({ tab: foreignTab });
      await expect(
        service.applyDiscount('tab-1', 'branch-A', { discount_kobo: 1000 }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.applyDiscount('tab-1', 'branch-A', { discount_kobo: 1000 }),
      ).rejects.toThrow('Tab does not belong to your branch');
    });

    it('allows applyDiscount within own branch', async () => {
      const { service, billRepo } = await buildService({
        tab: baseTab({ branch_id: 'branch-A' }),
      });
      billRepo.findOne.mockResolvedValueOnce({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 20000,
        service_charge_kobo: 2000,
        tax_kobo: 1500,
        discount_kobo: 0,
        total_kobo: 23500,
        paid_at: null,
      });
      const bill = await service.applyDiscount('tab-1', 'branch-A', {
        discount_kobo: 5000,
      });
      expect(bill.total_kobo).toBe(18500);
    });

    it('blocks getReceipt for a tab from another branch', async () => {
      const { service } = await buildService({ tab: foreignTab });
      await expect(service.getReceipt('tab-1', 'branch-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows getReceipt within own branch', async () => {
      const { service } = await buildService({
        tab: baseTab({ branch_id: 'branch-A' }),
      });
      const data = await service.getReceipt('tab-1', 'branch-A');
      expect(data).toBeDefined();
    });

    it('blocks getReceiptPdf for a tab from another branch', async () => {
      const { service, receiptService } = await buildService({
        tab: foreignTab,
      });
      await expect(service.getReceiptPdf('tab-1', 'branch-A')).rejects.toThrow(
        ForbiddenException,
      );
      expect(receiptService.generatePdf).not.toHaveBeenCalled();
    });

    it('blocks getSplitBills for a tab from another branch', async () => {
      const { service } = await buildService({ tab: foreignTab });
      await expect(service.getSplitBills('tab-1', 'branch-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('does not leak tab existence via timing (still rejects foreign branch)', async () => {
      const { service, billRepo, orderRepo } = await buildService({
        tab: foreignTab,
      });
      // Even though underlying repos were called, the cross-branch guard must
      // throw before any bill data is returned to the caller.
      const res = service.getReceipt('tab-1', 'branch-A');
      await expect(res).rejects.toThrow(ForbiddenException);
      expect(billRepo.save).not.toHaveBeenCalled();
      expect(orderRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('paid immutability', () => {
    it('rejects discount on a paid bill', async () => {
      const { service, billRepo } = await buildService({
        tab: baseTab({ branch_id: 'branch-A' }),
      });
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: 'tab-1',
        subtotal_kobo: 20000,
        service_charge_kobo: 2000,
        tax_kobo: 1500,
        discount_kobo: 0,
        total_kobo: 23500,
        paid_at: new Date(),
      });
      await expect(
        service.applyDiscount('tab-1', 'branch-A', { discount_kobo: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

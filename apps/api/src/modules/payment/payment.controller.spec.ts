import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { BillService } from '../bill/bill.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Business } from '../business/entities/business.entity';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../../common/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import * as crypto from 'crypto';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto) => dto),
  save: jest.fn(async (e) => ({
    ...e,
    id: 'bill-1',
    created_at: new Date(),
    updated_at: new Date(),
  })),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnThis(),
});

const mockReq = { rawBody: undefined, headers: {} } as any;
const mockSimReq = {
  rawBody: undefined,
  headers: { 'x-simulate': '1' },
} as any;

describe('PaymentController', () => {
  let controller: PaymentController;
  let billRepo: any;
  let tabRepo: any;
  let orderRepo: any;
  let posTerminalRepo: any;
  let branchRepo: any;
  let billService: any;

  beforeEach(async () => {
    billRepo = mockRepo();
    tabRepo = mockRepo();
    orderRepo = mockRepo();
    posTerminalRepo = mockRepo();
    branchRepo = mockRepo();
    billService = {
      processPayment: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: getRepositoryToken(Bill), useValue: billRepo },
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(PosTerminal), useValue: posTerminalRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Business), useValue: mockRepo() },
        { provide: BillService, useValue: billService },
      ],
    })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  describe('monniepointWebhook', () => {
    it('should return received:true for missing reference', async () => {
      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: { status: 'SUCCESSFUL' },
      });
      expect(result.received).toBe(true);
    });

    it('should return received:true for non-successful status', async () => {
      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: { reference: 'ref-1', amount: 100, status: 'FAILED' },
      });
      expect(result.received).toBe(true);
    });

    it('should return received:true when bill not found', async () => {
      billRepo.findOne.mockResolvedValue(null);
      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: { reference: 'ref-1', amount: 100, status: 'SUCCESSFUL' },
      });
      expect(result.received).toBe(true);
      expect(result.error).toBe('Bill not found');
    });

    it('should reject invalid HMAC signature', async () => {
      billRepo.findOne.mockResolvedValue({ tab_id: 'tab-1', paid_at: null });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'hmac-sha512',
              config: { webhook_secret: 'secret123' },
            },
          ],
        },
      });

      await expect(
        controller.monniepointWebhook(mockReq, 'wrong-sig', {
          data: { reference: 'ref-1', amount: 100, status: 'SUCCESSFUL' },
        }),
      ).rejects.toThrow('Invalid Moniepoint signature');
    });

    it('should call processPayment on valid webhook', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 150000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });

      const result = await controller.monniepointWebhook(mockReq, 'valid-sig', {
        data: {
          reference: 'ref-1',
          amount: 150000,
          status: 'SUCCESSFUL',
          terminalId: 'term-1',
        },
      });
      expect(result.received).toBe(true);
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-1',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({
          method: PaymentMethod.POS,
          amount: 150000,
          reference: 'ref-1',
          terminal_id: 'term-1',
          idempotency_key: 'monniepoint-ref-1',
        }),
        { bill: expect.objectContaining({ tab_id: 'tab-1' }) },
      );
    });

    it('should return already_paid if bill already paid', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: new Date(),
        payment_reference: 'ref-1',
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });
      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: { reference: 'ref-1', amount: 100, status: 'SUCCESSFUL' },
      });
      expect(result.status).toBe('already_paid');
    });
  });

  describe('opayWebhook', () => {
    it('should return received:true for missing reference', async () => {
      const result = await controller.opayWebhook(mockReq, 'sig', {
        data: { status: 'SUCCESS' },
      });
      expect(result.received).toBe(true);
    });

    it('should return received:true for non-successful status', async () => {
      const result = await controller.opayWebhook(mockReq, 'sig', {
        data: { reference: 'ref-1', amount: 100, status: 'FAILED' },
      });
      expect(result.received).toBe(true);
    });

    it('should call processPayment with POS method for POS transaction', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 50000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'opay',
              type: 'webhook',
              label: 'OPay',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });

      const result = await controller.opayWebhook(mockSimReq, 'valid-sig', {
        data: {
          reference: 'ref-1',
          amount: 50000,
          status: 'SUCCESS',
          transactionType: 'POS',
        },
      });
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-1',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({
          method: PaymentMethod.POS,
          amount: 50000,
          idempotency_key: 'opay-ref-1',
        }),
        { bill: expect.objectContaining({ tab_id: 'tab-1' }) },
      );
    });

    it('should call processPayment with TRANSFER method for transfer transaction', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 50000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'opay',
              type: 'webhook',
              label: 'OPay',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });

      const result = await controller.opayWebhook(mockSimReq, 'valid-sig', {
        data: {
          reference: 'ref-1',
          amount: 50000,
          status: 'SUCCESS',
          transactionType: 'TRANSFER',
        },
      });
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-1',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({
          method: PaymentMethod.TRANSFER,
          amount: 50000,
          idempotency_key: 'opay-ref-1',
        }),
        { bill: expect.objectContaining({ tab_id: 'tab-1' }) },
      );
    });

    it('should reject an invalid RSA signature when rsa verification is configured', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'opay',
              type: 'webhook',
              label: 'OPay',
              verification_method: 'rsa',
              config: { public_key: '-----BEGIN PUBLIC KEY-----not-a-key' },
            },
          ],
        },
      });

      await expect(
        controller.opayWebhook(mockReq, 'not-a-valid-signature', {
          data: {
            reference: 'ref-1',
            amount: 50000,
            status: 'SUCCESS',
            transactionType: 'TRANSFER',
          },
        }),
      ).rejects.toThrow('Invalid OPay signature');
    });
  });

  describe('opayWebhook real RSA signature verification', () => {
    let keys: crypto.KeyPairSyncResult<string, string>;
    const payload = {
      data: {
        reference: 'ref-1',
        amount: 50000,
        status: 'SUCCESS',
        transactionType: 'TRANSFER',
      },
    };
    const rawBody = JSON.stringify(payload);

    beforeAll(() => {
      keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
    });

    beforeEach(() => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 50000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'opay',
              type: 'webhook',
              label: 'OPay',
              verification_method: 'rsa',
              config: { public_key: keys.publicKey },
            },
          ],
        },
      });
    });

    const sign = (body: string) =>
      crypto
        .sign('RSA-SHA256', Buffer.from(body), keys.privateKey)
        .toString('base64');

    it('should process a webhook carrying a valid RSA signature', async () => {
      const req = { rawBody, headers: {} } as any;
      const result = await controller.opayWebhook(req, sign(rawBody), payload);
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-1',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({ idempotency_key: 'opay-ref-1' }),
        { bill: expect.objectContaining({ tab_id: 'tab-1' }) },
      );
    });

    it('should reject a webhook with a malformed signature', async () => {
      const req = { rawBody, headers: {} } as any;
      await expect(
        controller.opayWebhook(req, 'aW52YWxpZA==', payload),
      ).rejects.toThrow('Invalid OPay signature');
    });

    it('should reject a signature produced by a different key', async () => {
      const other = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const wrongSig = crypto
        .sign('RSA-SHA256', Buffer.from(rawBody), other.privateKey)
        .toString('base64');
      const req = { rawBody, headers: {} } as any;
      await expect(
        controller.opayWebhook(req, wrongSig, payload),
      ).rejects.toThrow('Invalid OPay signature');
    });
  });

  describe('monniepointWebhook amount normalization', () => {
    it('should settle a naira-denominated amount by converting to kobo', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 150000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });

      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: {
          reference: 'ref-1',
          amount: 1500,
          status: 'SUCCESSFUL',
          terminalId: 'term-1',
        },
      });
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-1',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({ amount: 150000 }),
        { bill: expect.objectContaining({ tab_id: 'tab-1' }) },
      );
    });

    it('should reject an amount that matches neither kobo nor naira', async () => {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 150000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'none',
              config: {},
            },
          ],
        },
      });

      const result = await controller.monniepointWebhook(mockReq, 'sig', {
        data: {
          reference: 'ref-1',
          amount: 123,
          status: 'SUCCESSFUL',
          terminalId: 'term-1',
        },
      });
      expect(result.error).toBe('Amount mismatch');
      expect(billService.processPayment).not.toHaveBeenCalled();
    });
  });

  describe('monniepointWebhook raw-body HMAC-SHA512 signature', () => {
    const secret = 'whsec_test';
    const payload = {
      data: {
        reference: 'ref-1',
        amount: 50000,
        status: 'SUCCESSFUL',
        terminalId: 'term-1',
      },
    };
    const rawBody = JSON.stringify(payload);
    const signBody = (body: string) =>
      crypto.createHmac('sha512', secret).update(body).digest('hex');

    function configureBranch() {
      billRepo.findOne.mockResolvedValue({
        tab_id: 'tab-1',
        paid_at: null,
        payment_reference: 'ref-1',
        total_kobo: 50000,
      });
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      branchRepo.findOne.mockResolvedValue({
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'hmac-sha512',
              config: { webhook_secret: secret },
            },
          ],
        },
      });
    }

    it('should accept a valid raw-body HMAC-SHA512 signature', async () => {
      configureBranch();
      const req = { rawBody, headers: {} } as any;
      const result = await controller.monniepointWebhook(
        req,
        signBody(rawBody),
        payload,
      );
      expect(result.status).toBe('processed');
    });

    it('should reject an invalid raw-body signature', async () => {
      configureBranch();
      const req = { rawBody, headers: {} } as any;
      await expect(
        controller.monniepointWebhook(req, 'wrong-signature', payload),
      ).rejects.toThrow('Invalid Moniepoint signature');
    });
  });

  describe('monniepointWebhook Monnify eventData format', () => {
    const monnifyPayload = {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        transactionReference: 'MNFY|20260915|001|000123',
        paymentReference: 'MP-000123',
        amountPaid: 50000,
        totalPayable: 50000,
        paymentStatus: 'PAID',
        paymentMethod: 'ACCOUNT_TRANSFER',
        destinationAccountInformation: { accountNumber: '0123456789' },
      },
    };

    it('should settle using the Monnify eventData shape', async () => {
      billRepo.findOne.mockResolvedValue(null);
      branchRepo.find.mockResolvedValue([
        {
          id: 'branch-1',
          settings: {
            payment_providers: [
              {
                name: 'monniepoint',
                type: 'webhook',
                label: 'Moniepoint',
                verification_method: 'hmac-sha512',
                config: { account_number: '0123456789' },
              },
            ],
          },
        },
      ]);

      // Branch scoped amount fallback finds the single unsettled bill.
      const qb: any = {};
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.orderBy = jest.fn().mockReturnValue(qb);
      qb.getMany = jest
        .fn()
        .mockResolvedValue([
          { id: 'bill-1', tab_id: 'tab-1', total_kobo: 50000, paid_at: null },
        ]);
      (billRepo.createQueryBuilder as any).mockReturnValue(qb);
      tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
      billRepo.save.mockResolvedValue({
        id: 'bill-1',
        payment_reference: 'MP-000123',
      });

      const result = await controller.monniepointWebhook(
        { rawBody: JSON.stringify(monnifyPayload), headers: { 'x-simulate': '1' } } as any,
        'any-sig',
        monnifyPayload,
      );
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalled();
    });
  });

  describe('opayWebhook amount+account fallback', () => {
    function mockQbReturning(rows: any[]) {
      const qb: any = {};
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.orderBy = jest.fn().mockReturnValue(qb);
      qb.getMany = jest.fn().mockResolvedValue(rows);
      return qb;
    }

    it('should settle the single matching unsettled bill by branch + amount', async () => {
      // Reference lookup finds nothing.
      billRepo.findOne.mockResolvedValue(null);
      // Deposit account maps to the branch that configured OPay.
      branchRepo.find.mockResolvedValue([
        {
          id: 'branch-1',
          settings: {
            payment_providers: [
              {
                name: 'opay',
                type: 'webhook',
                label: 'OPay',
                verification_method: 'rsa',
                config: {
                  public_key: 'not-used-due-to-simulate',
                  account_number: '0123456789',
                },
              },
            ],
          },
        },
      ]);
      billRepo.createQueryBuilder.mockReturnValue(
        mockQbReturning([
          {
            id: 'bill-fb',
            tab_id: 'tab-fb',
            total_kobo: 50000,
            paid_at: null,
            voided_at: null,
          },
        ]),
      );
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-fb',
        branch_id: 'branch-1',
      });
      billService.processPayment.mockResolvedValue({});

      const result = await controller.opayWebhook(mockSimReq, 'sig', {
        data: {
          reference: 'provider-ref-xyz',
          amount: 500,
          status: 'SUCCESS',
          transactionType: 'TRANSFER',
          // A Moniepoint/OPay terminal id is never a uuid — the terminal lookup
          // must not crash with 22P02 and must fall through to the account +
          // amount resolution instead.
          terminalId: '3A000001',
          account_number: '0123456789',
        },
      });
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-fb',
        'branch-1',
        'system-webhook',
        'owner',
        expect.objectContaining({
          method: PaymentMethod.TRANSFER,
          amount: 50000,
          idempotency_key: 'opay-provider-ref-xyz',
        }),
        { bill: expect.objectContaining({ tab_id: 'tab-fb' }) },
      );
    });
  });

  describe('initializePayment cash exclusion for takeaway', () => {
    it('omits cash from payment methods for a takeaway tab', async () => {
      const tabId = '11111111-1111-1111-1111-111111111111';
      billRepo.findOne.mockResolvedValue({
        id: 'bill-1',
        tab_id: tabId,
        total_kobo: 10000,
        payment_status: 'pending',
        payment_reference: 'PAY-REF',
      });
      billRepo.create.mockReturnValue({
        payment_reference: 'PAY-REF-2',
        payment_status: 'pending',
      });
      tabRepo.findOne.mockResolvedValue({
        id: tabId,
        branch_id: 'branch-1',
        tab_type: 'takeaway',
        tracking_code: 'SVQ-CODE',
        status: 'open',
      });
      orderRepo.find.mockResolvedValue([{ subtotal_kobo: 9000 }]);
      posTerminalRepo.find.mockResolvedValue([]);
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        settings: {},
      });

      const result = await controller.initializePayment({
        tab_id: tabId,
        tracking_code: 'SVQ-CODE',
      });

      expect(
        result.payment_methods.some((m) => (m as any).type === 'cash'),
      ).toBe(false);
    });

    it('includes cash for a dine-in tab', async () => {
      const tabId = '11111111-1111-1111-1111-111111111111';
      billRepo.findOne.mockResolvedValue(null);
      billRepo.create.mockReturnValue({
        payment_reference: 'PAY-REF-3',
        payment_status: 'pending',
      });
      billRepo.save.mockResolvedValue({ id: 'bill-1' });
      tabRepo.findOne.mockResolvedValue({
        id: tabId,
        branch_id: 'branch-1',
        tab_type: 'dine_in',
        tracking_code: 'SVQ-CODE',
        status: 'open',
      });
      orderRepo.find.mockResolvedValue([{ subtotal_kobo: 9000 }]);
      posTerminalRepo.find.mockResolvedValue([]);
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        settings: {},
      });

      const result = await controller.initializePayment({
        tab_id: tabId,
        tracking_code: 'SVQ-CODE',
      });

      expect(
        result.payment_methods.some((m) => (m as any).type === 'cash'),
      ).toBe(true);
    });
  });

  describe('submitCashIntent', () => {
    it('rejects cash intent on a takeaway tab', async () => {
      const tabId = '11111111-1111-1111-1111-111111111111';
      tabRepo.findOne.mockResolvedValue({
        id: tabId,
        branch_id: 'branch-1',
        tab_type: 'takeaway',
        tracking_code: 'SVQ-CODE',
        status: 'open',
      });

      await expect(
        controller.submitCashIntent({
          tab_id: tabId,
          tracking_code: 'SVQ-CODE',
        }),
      ).rejects.toThrow(
        'Cash payment is not available for takeaway orders. Please pay with transfer or card.',
      );
    });
  });
});

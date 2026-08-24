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
  const mockSimReq = { rawBody: undefined, headers: { 'x-simulate': '1' } } as any;

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
    billService = { processPayment: jest.fn().mockResolvedValue({}) };

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
      );
    });

    it('should call processPayment with TRANSFER method for transfer transaction', async () => {
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
      data: { reference: 'ref-1', amount: 50000, status: 'SUCCESS', transactionType: 'TRANSFER' },
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
      crypto.sign('RSA-SHA256', Buffer.from(body), keys.privateKey).toString('base64');

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
});

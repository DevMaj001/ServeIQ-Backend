import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EncryptionService } from '../../common/services/encryption.service';
import { MoniepointErpCredential } from './entities/moniepoint-erp-credential.entity';
import { MoniepointErpPush } from './entities/moniepoint-erp-push.entity';
import { PosTerminal } from '../pos/entities/pos-terminal.entity';
import { Bill } from '../bill/entities/bill.entity';
import {
  MONIEPOINT_CHANNEL_BASE_URL,
  MoniepointErpService,
} from './moniepoint-erp.service';

const BIZ = 'biz-1';
const BRANCH = 'branch-1';

describe('MoniepointErpService', () => {
  let service: MoniepointErpService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let terminalRepo: { findOne: jest.Mock };
  let billRepo: { findOne: jest.Mock };
  let pushRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let encryption: EncryptionService;

  const secret = 'test-sandbox-secret-0001';
  const terminal = {
    id: 'term-1',
    branch_id: BRANCH,
    serial_number: 'P260xyz',
    is_active: true,
  };
  /** A stored credential row exactly as EncryptionService would produce it. */
  const makeStored = (overrides: Partial<MoniepointErpCredential> = {}) => ({
    id: 'cred-1',
    branch_id: BRANCH,
    business_id: BIZ,
    client_id: 'api-client-test',
    client_secret_enc: encryption.encrypt(secret),
    environment: 'SANDBOX' as const,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(),
    };
    terminalRepo = { findOne: jest.fn() };
    billRepo = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    pushRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (data: any) => ({
        ...data,
        id: 'push-1',
        pushed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })),
      count: jest.fn().mockResolvedValue(0),
    };
    const module = await Test.createTestingModule({
      providers: [
        MoniepointErpService,
        {
          provide: getRepositoryToken(MoniepointErpCredential),
          useValue: repo,
        },
        {
          provide: getRepositoryToken(MoniepointErpPush),
          useValue: pushRepo,
        },
        {
          provide: getRepositoryToken(PosTerminal),
          useValue: terminalRepo,
        },
        {
          provide: getRepositoryToken(Bill),
          useValue: billRepo,
        },
        EncryptionService,
      ],
    }).compile();

    service = module.get(MoniepointErpService);
    encryption = module.get(EncryptionService);
  });

  describe('upsertCredential', () => {
    it('encrypts the secret at rest and returns a view without it', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      repo.save.mockImplementationOnce(async (c) => ({
        ...c,
        id: 'cred-1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const view = await service.upsertCredential(BIZ, BRANCH, {
        clientId: 'api-client-test',
        clientSecret: secret,
      });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.client_secret_enc).toMatch(/^enc:v1:/);
      expect(saved.client_secret_enc).not.toContain(secret);
      expect(saved.business_id).toBe(BIZ);
      expect(saved.environment).toBe('SANDBOX');
      expect(view).not.toHaveProperty('clientSecret');
      expect(view).not.toHaveProperty('clientId');
      expect(view.environment).toBe('SANDBOX');
      expect(view.isActive).toBe(true);
    });

    it('rejects enrollment when the secret is missing (refuses plaintext storage)', async () => {
      await expect(
        service.upsertCredential(BIZ, BRANCH, {
          clientId: 'api-client-test',
          clientSecret: '',
        }),
      ).rejects.toThrow('clientId and clientSecret are required');
    });

    it('updates an existing row in place rather than creating a duplicate', async () => {
      const existing = makeStored({ client_id: 'api-client-old' });
      repo.findOne.mockResolvedValueOnce(existing);
      repo.save.mockImplementationOnce(async (c) => ({ ...c }));

      await service.upsertCredential(BIZ, BRANCH, {
        clientId: 'api-client-new',
        clientSecret: secret,
        environment: 'PROD',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.client_id).toBe('api-client-new');
      expect(saved.environment).toBe('PROD');
    });
  });

  describe('getCredential', () => {
    it('returns null when the branch is not enrolled', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.getCredential(BIZ, BRANCH)).resolves.toBeNull();
    });

    it('scopes the lookup to the business', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      await service.getCredential(BIZ, BRANCH);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { branch_id: BRANCH, business_id: BIZ },
      });
    });
  });

  describe('resolveClient', () => {
    it('returns a branch-bound client with the DECRYPTED secret', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      const client = await service.resolveClient(BIZ, BRANCH);

      expect(client).not.toBeNull();
      // The client must use the per-branch credentials, not env.
      expect((client as any).clientId).toBe('api-client-test');
      expect((client as any).clientSecret).toBe(secret);
      expect((client as any).baseUrl).toBe(MONIEPOINT_CHANNEL_BASE_URL);
    });

    it('returns null for an inactive credential', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored({ is_active: false }));
      await expect(service.resolveClient(BIZ, BRANCH)).resolves.toBeNull();
    });

    it('throws when the stored ciphertext cannot be decrypted', async () => {
      repo.findOne.mockResolvedValueOnce(
        makeStored({ client_secret_enc: 'enc:v1:bogus-ciphertext' }),
      );
      await expect(service.resolveClient(BIZ, BRANCH)).rejects.toThrow(
        /corrupted/,
      );
    });
  });

  describe('pushPayment', () => {
    it('throws NotFoundException when the branch has no active credential', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.pushPayment(BIZ, BRANCH, {
          terminalSerial: 'P260xyz',
          amount: 11000,
          merchantReference: 'ref-1',
          transactionType: 'PURCHASE',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a terminal serial that belongs to another branch', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.pushPayment(BIZ, BRANCH, {
          terminalSerial: 'P999other',
          amount: 11000,
          merchantReference: 'ref-2',
          transactionType: 'PURCHASE',
        }),
      ).rejects.toMatchObject({
        name: 'NotFoundException',
        message: expect.stringContaining('P999other'),
      });
    });

    it('rejects an inactive terminal even when the serial matches', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce({
        ...terminal,
        is_active: false,
      });
      await expect(
        service.pushPayment(BIZ, BRANCH, {
          terminalSerial: 'P260xyz',
          amount: 11000,
          merchantReference: 'ref-2',
          transactionType: 'PURCHASE',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the terminal lookup to the requesting branch', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              accessToken: 'token-abc',
              tokenType: { value: 'bearer' },
              expiresIn: 3600,
              scope: 'profile',
              jti: 'jti-1',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValue(
          new Response(null, { status: 202, statusText: 'Accepted' }),
        );
      (global as any).fetch = fetchMock;

      await service.pushPayment(BIZ, BRANCH, {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-1',
        transactionType: 'PURCHASE',
      });

      expect(terminalRepo.findOne).toHaveBeenCalledWith({
        where: { branch_id: BRANCH, serial_number: 'P260xyz' },
      });
    });

    it('pushes via the branch-bound client only after terminal ownership is proven', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          // /v1/auth
          new Response(
            JSON.stringify({
              accessToken: 'token-abc',
              tokenType: { value: 'bearer' },
              expiresIn: 3600,
              scope: 'profile',
              jti: 'jti-1',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          // /v1/transactions -> 202 Accepted
          new Response(null, { status: 202, statusText: 'Accepted' }),
        );
      (global as any).fetch = fetchMock;

      const view = await service.pushPayment(BIZ, BRANCH, {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-1',
        transactionType: 'PURCHASE',
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [txUrl, txInit] = fetchMock.mock.calls[1];
      expect(String(txUrl)).toBe(
        `${MONIEPOINT_CHANNEL_BASE_URL}/v1/transactions`,
      );
      const body = JSON.parse((txInit as RequestInit).body as string);
      expect(body.terminalSerial).toBe('P260xyz');
      expect(body.amount).toBe(11000);
      expect(body.merchantReference).toBe('ref-1');

      // The push is recorded for reconciliation before returning.
      const row = pushRepo.create.mock.calls[0][0];
      expect(row.status).toBe('pending');
      expect(row.amount_kobo).toBe(11000);
      expect(row.merchant_reference).toBe('ref-1');
      expect(row.branch_id).toBe(BRANCH);
      expect(view.id).toBe('push-1');
      expect(view.status).toBe('pending');
    });

    it('returns the existing pending push without re-invoking the API (idempotent)', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      pushRepo.findOne.mockResolvedValueOnce({
        id: 'push-dup',
        branch_id: BRANCH,
        bill_id: null,
        merchant_reference: 'ref-1',
        terminal_serial: 'P260xyz',
        amount_kobo: 11000,
        status: 'pending',
        error: null,
        pushed_at: new Date(),
        paid_at: null,
      });
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      const view = await service.pushPayment(BIZ, BRANCH, {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-1',
        transactionType: 'PURCHASE',
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(view.id).toBe('push-dup');
      expect(view.duplicate).toBe(true);
      expect(view.status).toBe('pending');
    });

    it('derives the merchant reference from the linked bill', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      billRepo.findOne.mockResolvedValueOnce({
        id: 'bill-1',
        branch_id: BRANCH,
        payment_reference: 'BILL-REF-1',
        paid_at: null,
      });
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              accessToken: 'token-abc',
              tokenType: { value: 'bearer' },
              expiresIn: 3600,
              scope: 'profile',
              jti: 'jti-1',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 202, statusText: 'Accepted' }),
        );
      (global as any).fetch = fetchMock;

      await service.pushPayment(
        BIZ,
        BRANCH,
        {
          terminalSerial: 'P260xyz',
          amount: 11000,
          transactionType: 'PURCHASE',
        },
        { billId: 'bill-1' },
      );

      expect(billRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
      });
      const txBody = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      );
      expect(txBody.merchantReference).toBe('BILL-REF-1');
      const row = pushRepo.create.mock.calls[0][0];
      expect(row.bill_id).toBe('bill-1');
      expect(row.merchant_reference).toBe('BILL-REF-1');
    });

    it('rejects a linked bill that belongs to another branch', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      billRepo.findOne.mockResolvedValueOnce({
        id: 'bill-x',
        branch_id: 'other-branch',
        payment_reference: 'BILL-X',
        paid_at: null,
      });
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      await expect(
        service.pushPayment(
          BIZ,
          BRANCH,
          {
            terminalSerial: 'P260xyz',
            amount: 11000,
            transactionType: 'PURCHASE',
          },
          { billId: 'bill-x' },
        ),
      ).rejects.toMatchObject({ name: 'NotFoundException' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a push against an already-paid bill', async () => {
      repo.findOne.mockResolvedValueOnce(makeStored());
      terminalRepo.findOne.mockResolvedValueOnce(terminal);
      billRepo.findOne.mockResolvedValueOnce({
        id: 'bill-1',
        branch_id: BRANCH,
        payment_reference: 'BILL-REF-1',
        paid_at: new Date(),
      });

      await expect(
        service.pushPayment(
          BIZ,
          BRANCH,
          {
            terminalSerial: 'P260xyz',
            amount: 11000,
            transactionType: 'PURCHASE',
          },
          { billId: 'bill-1' },
        ),
      ).rejects.toMatchObject({ name: 'BadRequestException' });
    });
  });

  describe('listPushes', () => {
    it('returns branch-scoped pushes with a live settled flag for bill-linked rows', async () => {
      pushRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'push-1',
          business_id: BIZ,
          branch_id: BRANCH,
          bill_id: 'bill-1',
          merchant_reference: 'BILL-REF-1',
          terminal_serial: 'P260xyz',
          amount_kobo: 11000,
          status: 'pending',
          error: null,
          pushed_at: new Date(),
          paid_at: null,
        },
      ]);
      billRepo.find.mockResolvedValueOnce([
        { id: 'bill-1', paid_at: new Date() },
      ]);

      const views = await service.listPushes(BIZ, BRANCH, {});

      expect(pushRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: BIZ,
            branch_id: BRANCH,
          }),
        }),
      );
      expect(views).toHaveLength(1);
      expect(views[0].settled).toBe(true);
      expect(views[0].status).toBe('pending');
    });

    it('ignores an unknown status filter but keeps branch scoping', async () => {
      pushRepo.find = jest.fn().mockResolvedValue([]);
      await service.listPushes(BIZ, BRANCH, { status: 'not-a-status' });
      expect(pushRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ business_id: BIZ }),
        }),
      );
      expect(pushRepo.find.mock.calls[0][0].where).not.toHaveProperty('status');
    });
  });
});

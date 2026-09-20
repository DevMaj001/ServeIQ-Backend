import * as crypto from 'crypto';
import { PaymentController } from './payment.controller';
import { BranchController } from '../branch/branch.controller';
import { WebhookEventsService } from './webhook-events.service';
import {
  EncryptionService,
  ENC_PREFIX,
} from '../../common/services/encryption.service';
import {
  encryptSensitiveConfig,
  isMaskedSecret,
  maskSensitiveConfig,
  stripMaskedSecrets,
  SECRET_MASK_PREFIX,
} from './provider-secrets';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto: any) => dto),
  save: jest.fn(async (e: any) => e),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const sign512 = (body: string, secret: string) =>
  crypto.createHmac('sha512', secret).update(body).digest('hex');

describe('provider-secrets', () => {
  const enc = new EncryptionService();

  it('encrypts sensitive keys and leaves non-secrets readable', () => {
    const out = encryptSensitiveConfig(
      { webhook_secret: 's3cret', account_number: '0123456789' },
      enc,
    )!;
    expect(String(out.webhook_secret)).toMatch(/^enc:v1:/);
    expect(out.account_number).toBe('0123456789');
    expect(enc.decrypt(out.webhook_secret)).toBe('s3cret');
  });

  it('does not double-encrypt already-encrypted values', () => {
    const once = encryptSensitiveConfig({ webhook_secret: 's3cret' }, enc)!;
    const twice = encryptSensitiveConfig(once, enc)!;
    expect(twice.webhook_secret).toBe(once.webhook_secret);
  });

  it('masks secrets with the last 4 plaintext characters', () => {
    const stored = encryptSensitiveConfig(
      { webhook_secret: 'supersecret99' },
      enc,
    )!;
    const masked = maskSensitiveConfig(stored, enc)!;
    expect(masked.webhook_secret).toBe(`${SECRET_MASK_PREFIX}et99`);
    expect(isMaskedSecret(masked.webhook_secret)).toBe(true);
  });

  it('strips masked values so a round-trip cannot overwrite a secret', () => {
    const stripped = stripMaskedSecrets({
      webhook_secret: `${SECRET_MASK_PREFIX}et99`,
      account_number: '456',
    })!;
    expect(stripped).not.toHaveProperty('webhook_secret');
    expect(stripped.account_number).toBe('456');
  });
});

describe('WebhookEventsService', () => {
  let repo: any;
  let service: WebhookEventsService;

  beforeEach(() => {
    repo = mockRepo();
    service = new WebhookEventsService(repo);
  });

  it('record never throws even when the repository fails', async () => {
    repo.save.mockRejectedValue(new Error('db down'));
    await expect(
      service.record({
        provider: 'opay',
        payloadHash: 'a'.repeat(64),
        signatureStatus: 'verified',
        outcome: 'settled',
      }),
    ).resolves.toBeUndefined();
  });

  it('truncates oversized payloads before persisting', async () => {
    await service.record({
      provider: 'opay',
      payloadHash: 'a'.repeat(64),
      signatureStatus: 'verified',
      outcome: 'settled',
      payload: { blob: 'x'.repeat(20000) },
    });
    const saved = repo.create.mock.calls[0][0];
    expect(saved.payload).toEqual({ truncated: true });
  });

  it('hasSettledPayload fails open on query errors', async () => {
    repo.count.mockRejectedValue(new Error('db down'));
    await expect(
      service.hasSettledPayload('opay', 'a'.repeat(64)),
    ).resolves.toBe(false);
  });

  it('hasSettledPayload reports a previously settled payload', async () => {
    repo.count.mockResolvedValue(1);
    await expect(
      service.hasSettledPayload('opay', 'a'.repeat(64)),
    ).resolves.toBe(true);
  });
});

describe('webhook pipeline security', () => {
  let tabRepo: any;
  let billRepo: any;
  let orderRepo: any;
  let posTerminalRepo: any;
  let branchRepo: any;
  let businessRepo: any;
  let platformProviderRepo: any;
  let billService: any;
  let notificationService: any;
  let webhookEvents: any;
  let controller: PaymentController;
  const enc = new EncryptionService();

  const makeController = () =>
    new PaymentController(
      tabRepo,
      billRepo,
      orderRepo,
      posTerminalRepo,
      branchRepo,
      businessRepo,
      platformProviderRepo,
      billService,
      notificationService,
      webhookEvents,
      enc,
    );

  beforeEach(() => {
    tabRepo = mockRepo();
    billRepo = mockRepo();
    orderRepo = mockRepo();
    posTerminalRepo = mockRepo();
    branchRepo = mockRepo();
    businessRepo = mockRepo();
    platformProviderRepo = mockRepo();
    billService = { processPayment: jest.fn().mockResolvedValue({}) };
    notificationService = { create: jest.fn().mockResolvedValue(undefined) };
    webhookEvents = {
      record: jest.fn().mockResolvedValue(undefined),
      hasSettledPayload: jest.fn().mockResolvedValue(false),
    };
    controller = makeController();
  });

  const wireReferenceToBranch = (settings: any) => {
    billRepo.findOne.mockResolvedValue({
      id: 'bill-9',
      tab_id: 'tab-9',
      paid_at: null,
      payment_reference: 'ref-9',
      total_kobo: 50000,
    });
    tabRepo.findOne.mockResolvedValue({ id: 'tab-9', branch_id: 'branch-9' });
    branchRepo.findOne.mockResolvedValue({ id: 'branch-9', settings });
  };

  describe('fail-closed verification', () => {
    it("rejects a Moniepoint config with verification_method 'none' (previously skipped verification)", async () => {
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            verification_method: 'none',
            config: {},
          },
        ],
      });
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESSFUL' },
      };
      await expect(
        controller.monniepointWebhook(
          { rawBody: undefined, headers: {} } as any,
          'any-sig',
          payload,
        ),
      ).rejects.toThrow('Moniepoint webhook not configured');
      expect(billService.processPayment).not.toHaveBeenCalled();
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureStatus: 'not-configured',
          outcome: 'rejected',
        }),
      );
    });

    it('verifies against an ENCRYPTED branch secret (decrypt-on-use)', async () => {
      const secret = 'live-webhook-secret';
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: enc.encrypt(secret) },
          },
        ],
      });
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESSFUL' },
      };
      const raw = JSON.stringify(payload);
      const result = await controller.monniepointWebhook(
        { rawBody: raw, headers: {} } as any,
        sign512(raw, secret),
        payload,
      );
      expect(result.status).toBe('processed');
      expect(billService.processPayment).toHaveBeenCalledTimes(1);
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureStatus: 'verified',
          outcome: 'settled',
        }),
      );
    });
  });

  describe('replay dedupe via the event ledger', () => {
    it('short-circuits a byte-identical, already-settled delivery without touching bills', async () => {
      const secret = 'live-webhook-secret';
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: secret },
          },
        ],
      });
      webhookEvents.hasSettledPayload.mockResolvedValue(true);
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESSFUL' },
      };
      const raw = JSON.stringify(payload);
      const result = await controller.monniepointWebhook(
        { rawBody: raw, headers: {} } as any,
        sign512(raw, secret),
        payload,
      );
      expect(result).toEqual({ received: true, status: 'duplicate' });
      expect(billService.processPayment).not.toHaveBeenCalled();
    });

    it('an UNVERIFIED duplicate still gets rejected, not deduped', async () => {
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: 'real-secret' },
          },
        ],
      });
      webhookEvents.hasSettledPayload.mockResolvedValue(true);
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESSFUL' },
      };
      await expect(
        controller.monniepointWebhook(
          { rawBody: JSON.stringify(payload), headers: {} } as any,
          'forged-signature',
          payload,
        ),
      ).rejects.toThrow('Invalid Moniepoint signature');
    });
  });

  describe('hardened OPay ordering', () => {
    it('rejects an unresolvable delivery with 403 instead of leaking bill existence', async () => {
      billRepo.findOne.mockResolvedValue(null);
      branchRepo.find.mockResolvedValue([]);
      const payload = {
        data: {
          reference: 'unknown-ref',
          amount: 100,
          status: 'SUCCESS',
          transactionType: 'TRANSFER',
        },
      };
      await expect(
        controller.opayWebhook(
          { rawBody: JSON.stringify(payload), headers: {} } as any,
          'sig',
          payload,
        ),
      ).rejects.toThrow('Invalid OPay signature');
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureStatus: 'unverifiable',
          outcome: 'rejected',
        }),
      );
    });

    it('alerts reconciliation on an amount mismatch', async () => {
      const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'opay',
            type: 'webhook',
            verification_method: 'rsa',
            config: { public_key: keys.publicKey },
          },
        ],
      });
      const payload = {
        data: {
          reference: 'ref-9',
          amount: 123,
          status: 'SUCCESS',
          transactionType: 'TRANSFER',
        },
      };
      const raw = JSON.stringify(payload);
      const sig = crypto
        .sign('RSA-SHA256', Buffer.from(raw), keys.privateKey)
        .toString('base64');
      const result = await controller.opayWebhook(
        { rawBody: raw, headers: {} } as any,
        sig,
        payload,
      );
      expect(result.error).toBe('Amount mismatch');
      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment_reconciliation' }),
      );
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'amount_mismatch' }),
      );
    });
  });

  describe('generic provider route', () => {
    it('404s for a provider that is not in the platform catalogue', async () => {
      platformProviderRepo.findOne.mockResolvedValue(null);
      await expect(
        controller.genericProviderWebhook(
          'gtbank',
          { rawBody: '{}', headers: {} } as any,
          {},
        ),
      ).rejects.toThrow('Unknown payment provider');
    });

    it('404s for the hand-hardened providers so they cannot be reached generically', async () => {
      await expect(
        controller.genericProviderWebhook(
          'opay',
          { rawBody: '{}', headers: {} } as any,
          {},
        ),
      ).rejects.toThrow('Unknown payment provider');
      expect(platformProviderRepo.findOne).not.toHaveBeenCalled();
    });

    it('settles a catalogue provider configured with hmac-sha512 on the branch', async () => {
      const secret = 'gtb-secret';
      platformProviderRepo.findOne.mockResolvedValue({
        name: 'gtbank',
        label: 'GTBank',
        type: 'webhook',
        verification_method: 'hmac-sha512',
        config: {},
        is_active: true,
      });
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'gtbank',
            type: 'webhook',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: enc.encrypt(secret) },
          },
        ],
      });
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESS' },
      };
      const raw = JSON.stringify(payload);
      const result = await controller.genericProviderWebhook(
        'gtbank',
        {
          rawBody: raw,
          headers: { 'x-gtbank-signature': sign512(raw, secret) },
        } as any,
        payload,
      );
      expect(result).toEqual({ received: true, status: 'processed' });
      expect(billService.processPayment).toHaveBeenCalledWith(
        'tab-9',
        'branch-9',
        'system-webhook',
        'owner',
        expect.objectContaining({ idempotency_key: 'gtbank-ref-9' }),
        { bill: expect.objectContaining({ id: 'bill-9' }) },
      );
    });

    it("fails closed when the effective verification method is 'none'", async () => {
      platformProviderRepo.findOne.mockResolvedValue({
        name: 'gtbank',
        label: 'GTBank',
        type: 'webhook',
        verification_method: 'none',
        config: {},
        is_active: true,
      });
      wireReferenceToBranch({ payment_providers: [] });
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESS' },
      };
      await expect(
        controller.genericProviderWebhook(
          'gtbank',
          { rawBody: JSON.stringify(payload), headers: {} } as any,
          payload,
        ),
      ).rejects.toThrow('GTBank webhook not configured');
      expect(billService.processPayment).not.toHaveBeenCalled();
    });

    it('rejects a bad signature for a catalogue provider', async () => {
      platformProviderRepo.findOne.mockResolvedValue({
        name: 'gtbank',
        label: 'GTBank',
        type: 'webhook',
        verification_method: 'hmac-sha512',
        config: {},
        is_active: true,
      });
      wireReferenceToBranch({
        payment_providers: [
          {
            name: 'gtbank',
            type: 'webhook',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: 'gtb-secret' },
          },
        ],
      });
      const payload = {
        data: { reference: 'ref-9', amount: 50000, status: 'SUCCESS' },
      };
      await expect(
        controller.genericProviderWebhook(
          'gtbank',
          {
            rawBody: JSON.stringify(payload),
            headers: { 'x-gtbank-signature': 'deadbeef' },
          } as any,
          payload,
        ),
      ).rejects.toThrow('Invalid GTBank signature');
    });
  });
});

describe('branch settings secret hygiene', () => {
  const enc = new EncryptionService();
  let branchService: any;
  let branchRepo: any;
  let platformRepo: any;
  let controller: BranchController;
  const storedSecret = 'supersecret99';

  const makeBranch = () => ({
    id: 'branch-1',
    settings: {
      enabled_providers: ['monniepoint'],
      payment_providers: [
        {
          name: 'monniepoint',
          type: 'webhook',
          verification_method: 'hmac-sha512',
          config: {
            webhook_secret: enc.encrypt(storedSecret),
            account_number: '0123456789',
          },
        },
      ],
    },
  });

  beforeEach(() => {
    branchService = {
      findOne: jest.fn().mockResolvedValue(makeBranch()),
      findAllByBusiness: jest.fn().mockResolvedValue([makeBranch()]),
    };
    branchRepo = { save: jest.fn(async (b: any) => b) };
    platformRepo = { find: jest.fn().mockResolvedValue([]) };
    controller = new BranchController(
      branchService,
      branchRepo,
      platformRepo,
      enc,
    );
  });

  it('masks secrets in reads; account numbers stay visible', async () => {
    const branch = await controller.findOne('branch-1', {
      user: { businessId: 'biz-1' },
    });
    const cfg = branch.settings.payment_providers[0].config;
    expect(cfg.webhook_secret).toBe('••••et99');
    expect(cfg.account_number).toBe('0123456789');
  });

  it('a masked secret round-tripped through an update leaves the stored secret intact', async () => {
    await controller.updateSettings(
      'branch-1',
      { user: { businessId: 'biz-1' } },
      {
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              config: { webhook_secret: '••••et99', account_number: '999' },
            },
          ],
        },
      } as any,
    );
    const saved = branchRepo.save.mock.calls[0][0];
    const cfg = saved.settings.payment_providers[0].config;
    expect(enc.decrypt(cfg.webhook_secret)).toBe(storedSecret);
    expect(cfg.account_number).toBe('999');
  });

  it('a new secret is stored encrypted and returned masked', async () => {
    const response = await controller.updateSettings(
      'branch-1',
      { user: { businessId: 'biz-1' } },
      {
        settings: {
          payment_providers: [
            {
              name: 'monniepoint',
              config: { webhook_secret: 'brand-new-secret' },
            },
          ],
        },
      } as any,
    );
    const saved = branchRepo.save.mock.calls[0][0];
    const storedValue =
      saved.settings.payment_providers[0].config.webhook_secret;
    expect(String(storedValue)).toMatch(new RegExp(`^${ENC_PREFIX}`));
    expect(enc.decrypt(storedValue)).toBe('brand-new-secret');
    expect(response.settings.payment_providers[0].config.webhook_secret).toBe(
      '••••cret',
    );
  });
});

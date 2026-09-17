import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { PlatformPaymentProvider } from '../admin/entities/platform-payment-provider.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Repository } from 'typeorm';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn(async (e) => ({
    ...e,
    id: 'branch-1',
    created_at: new Date(),
    updated_at: new Date(),
  })),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnThis(),
});

describe('BranchController', () => {
  let controller: BranchController;
  let branchRepo: any;
  let branchService: any;

  beforeEach(async () => {
    branchRepo = mockRepo();
    branchService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchController],
      providers: [
        { provide: BranchService, useValue: branchService },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        {
          provide: getRepositoryToken(PlatformPaymentProvider),
          useValue: mockRepo(),
        },
      ],
    })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BranchController>(BranchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateSettings', () => {
    it('should merge new settings with existing branch settings', async () => {
      const existingSettings = { takeaway_payment_policy: 'prepay' };
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: existingSettings,
      });
      branchRepo.save.mockResolvedValue({
        id: 'branch-1',
        settings: {
          ...existingSettings,
          payment_provider: 'monniepoint',
          payment_providers: [
            { name: 'manual', type: 'manual', label: 'Manual', config: {} },
            {
              name: 'monniepoint',
              type: 'webhook',
              label: 'Moniepoint',
              verification_method: 'hmac-sha512',
              config: { webhook_secret: 'whsec_xxx' },
            },
          ],
        },
      });

      const result = await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          settings: {
            payment_provider: 'monniepoint',
            payment_providers: [
              { name: 'manual', type: 'manual', label: 'Manual', config: {} },
              {
                name: 'monniepoint',
                type: 'webhook',
                label: 'Moniepoint',
                verification_method: 'hmac-sha512',
                config: { webhook_secret: 'whsec_xxx' },
              },
            ],
          },
        },
      );

      expect(branchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            payment_provider: 'monniepoint',
            payment_providers: expect.any(Array),
          }),
        }),
      );
    });

    it('should create settings object if none existed', async () => {
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: null,
      });
      branchRepo.save.mockResolvedValue({
        id: 'branch-1',
        settings: {
          payment_provider: 'opay',
          payment_providers: [
            { name: 'manual', type: 'manual', label: 'Manual', config: {} },
            {
              name: 'opay',
              type: 'webhook',
              label: 'OPay',
              verification_method: 'rsa',
              config: { public_key: 'key' },
            },
          ],
        },
      });

      await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          settings: {
            payment_provider: 'opay',
            payment_providers: [
              { name: 'manual', type: 'manual', label: 'Manual', config: {} },
              {
                name: 'opay',
                type: 'webhook',
                label: 'OPay',
                verification_method: 'rsa',
                config: { public_key: 'key' },
              },
            ],
          },
        },
      );

      expect(branchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            payment_provider: 'opay',
            payment_providers: expect.any(Array),
          }),
        }),
      );
    });

    it('should merge reservation settings', async () => {
      const existingSettings = { delivery: { enabled: true } };
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: existingSettings,
      });
      branchRepo.save.mockResolvedValue({
        id: 'branch-1',
        settings: {
          ...existingSettings,
          reservation: { enabled: true, allow_online: true, max_party_size: 12 },
        },
      });

      await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          reservation: { enabled: true, allow_online: true, max_party_size: 12 },
        },
      );

      expect(branchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            delivery: { enabled: true },
            reservation: expect.objectContaining({
              enabled: true,
              allow_online: true,
              max_party_size: 12,
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException for unknown branch', async () => {
      branchService.findOne.mockResolvedValue(null);

      await expect(
        controller.updateSettings(
          'unknown',
          { user: { businessId: 'biz-1' } },
          {
            settings: { payment_provider: 'opay' },
          },
        ),
      ).rejects.toThrow('Branch not found');
    });

    it('should NOT wipe configured webhook providers on a partial/stale save', async () => {
      const existingSettings = {
        payment_provider: 'monniepoint',
        enabled_providers: ['manual', 'monniepoint'],
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            label: 'Moniepoint',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: 'secret_123', account_number: '000111' },
          },
        ],
        takeaway_payment_policy: 'prepay',
      };
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: existingSettings,
      });
      branchRepo.save.mockResolvedValue({ id: 'branch-1' });

      // Client only toggles the takeaway policy and sends an empty provider list
      await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          settings: {
            takeaway_payment_policy: 'pay_on_pickup',
            enabled_providers: [],
          },
        },
      );

      const saved = branchRepo.save.mock.calls[0][0];
      const settings = saved.settings;
      expect(settings.takeaway_payment_policy).toBe('pay_on_pickup');
      // The existing Moniepoint config must survive the partial save
      expect(settings.payment_providers).toEqual([
        {
          name: 'monniepoint',
          type: 'webhook',
          label: 'Moniepoint',
          verification_method: 'hmac-sha512',
          config: { webhook_secret: 'secret_123', account_number: '000111' },
        },
      ]);
      expect(settings.payment_provider).toBe('monniepoint');
    });

    it('should upsert provider config by name and upserted secrets merge in', async () => {
      const existingSettings = {
        payment_provider: 'monniepoint',
        payment_providers: [
          {
            name: 'monniepoint',
            type: 'webhook',
            label: 'Moniepoint',
            verification_method: 'hmac-sha512',
            config: { webhook_secret: 'old_secret' },
          },
          { name: 'opay', type: 'webhook', label: 'OPay', config: {} },
        ],
      };
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: existingSettings,
      });
      branchRepo.save.mockResolvedValue({ id: 'branch-1' });

      await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          settings: {
            payment_providers: [
              {
                name: 'monniepoint',
                type: 'webhook',
                label: 'Moniepoint',
                verification_method: 'hmac-sha512',
                config: { account_number: '6912160642' },
              },
            ],
          },
        },
      );

      const saved = branchRepo.save.mock.calls[0][0];
      const providers = saved.settings.payment_providers;
      // opay entry must not have been removed by the partial payload
      expect(providers.map((p: any) => p.name)).toEqual([
        'monniepoint',
        'opay',
      ]);
      const mono = providers.find((p: any) => p.name === 'monniepoint');
      expect(mono.config.webhook_secret).toBe('old_secret');
      expect(mono.config.account_number).toBe('6912160642');
    });

    it('should dedupe enabled_providers', async () => {
      const existingSettings = { takeaway_payment_policy: 'prepay' };
      branchService.findOne.mockResolvedValue({
        id: 'branch-1',
        business_id: 'biz-1',
        settings: existingSettings,
      });
      branchRepo.save.mockResolvedValue({ id: 'branch-1' });

      await controller.updateSettings(
        'branch-1',
        { user: { businessId: 'biz-1' } },
        {
          settings: {
            enabled_providers: [
              'manual',
              'manual',
              'manual',
              'monniepoint',
            ],
          },
        },
      );

      const saved = branchRepo.save.mock.calls[0][0];
      expect(saved.settings.enabled_providers).toEqual([
        'manual',
        'monniepoint',
      ]);
    });
  });
});

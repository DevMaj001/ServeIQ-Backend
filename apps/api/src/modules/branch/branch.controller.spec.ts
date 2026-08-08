import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { PlatformPaymentProvider } from '../admin/entities/platform-payment-provider.entity';
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
    }).compile();

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
  });
});

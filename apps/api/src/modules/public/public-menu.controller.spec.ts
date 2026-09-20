import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PublicMenuController } from './public-menu.controller';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Advertisement } from '../advertisement/entities/advertisement.entity';
import { Table } from '../table/entities/table.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
});

const branch = (overrides: Partial<Branch> = {}): Branch =>
  ({
    id: 'a1f30e7a-e7f1-4f0b-9d8e-1234567890ab',
    name: 'Downtown',
    created_at: new Date('2026-01-01T00:00:00Z'),
    business: {
      name: 'Acme Kitchen',
      logo_url: null,
      brand_primary_color: null,
      brand_accent_color: null,
      currency: 'NGN',
      tax_rate: 7.5,
      service_charge_percent: 10,
    },
    settings: {
      delivery: { enabled: false, fee_kobo: 0, rider_payout_kobo: 0 },
    },
    ...overrides,
  }) as unknown as Branch;

describe('PublicMenuController', () => {
  let controller: PublicMenuController;
  let branchRepo: any;
  let menuItemRepo: any;

  beforeEach(async () => {
    branchRepo = mockRepo();
    menuItemRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicMenuController],
      providers: [
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(Advertisement), useValue: mockRepo() },
        { provide: getRepositoryToken(Table), useValue: mockRepo() },
      ],
    }).compile();

    controller = module.get<PublicMenuController>(PublicMenuController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPublicMenu', () => {
    it('resolves the "default" fallback to the first branch', async () => {
      const b = branch();
      branchRepo.find.mockResolvedValue([b]);
      menuItemRepo.find.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Jollof',
          category: 'Mains',
          price_kobo: 350000,
          track_stock: false,
          quantity_in_stock: 0,
          image_url: null,
          is_available: true,
        },
      ]);

      const result = await controller.getPublicMenu('default');

      expect(branchRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: { business: true },
          order: { created_at: 'ASC' },
          take: 1,
        }),
      );
      expect(result.business_name).toBe('Acme Kitchen');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Jollof');
    });

    it('looks up a UUID branch id directly', async () => {
      branchRepo.findOne.mockResolvedValue(branch());

      await controller.getPublicMenu('a1f30e7a-e7f1-4f0b-9d8e-1234567890ab');

      expect(branchRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1f30e7a-e7f1-4f0b-9d8e-1234567890ab' },
        }),
      );
    });

    it('returns 404 for a non-UUID, non-default branch id instead of a DB cast error', async () => {
      await expect(controller.getPublicMenu('not-a-uuid')).rejects.toThrow(
        NotFoundException,
      );
      expect(branchRepo.find).not.toHaveBeenCalled();
      expect(branchRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns 404 when "default" resolves to no branch', async () => {
      branchRepo.find.mockResolvedValue([]);

      await expect(controller.getPublicMenu('default')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 when the branch has no linked business', async () => {
      branchRepo.find.mockResolvedValue([
        branch({ business: undefined as unknown as Branch['business'] }),
      ]);

      await expect(controller.getPublicMenu('default')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

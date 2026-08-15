import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../order/entities/order.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Review } from '../review/entities/review.entity';
import { TrackingService } from '../tracking/tracking.service';
import { RealtimeService } from '../gateway/realtime.service';
import { DataSource } from 'typeorm';

describe('CustomerService.submitReview', () => {
  let service: CustomerService;
  const tabRepo = { findOne: jest.fn() };
  const branchRepo = { findOne: jest.fn() };
  const reviewRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const openTab = {
    id: 'tab-1',
    branch_id: 'branch-1',
    tracking_code: 'TRACK-1',
    status: 'paid',
    waiter_id: null,
  } as any;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: getRepositoryToken(Table), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(MenuItem),
          useValue: { find: jest.fn() },
        },
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: DataSource, useValue: {} },
        { provide: TrackingService, useValue: { generateUniqueCode: jest.fn() } },
        { provide: RealtimeService, useValue: {} },
      ],
    }).compile();

    service = module.get(CustomerService);
  });

  it('throws NotFoundException when tab does not exist', async () => {
    tabRepo.findOne.mockResolvedValue(null);
    await expect(
      service.submitReview('tab-x', 'TRACK-1', { rating: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when tracking code does not match', async () => {
    tabRepo.findOne.mockResolvedValue(openTab);
    await expect(
      service.submitReview('tab-1', 'WRONG', { rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws BadRequestException when tab is not open/paid', async () => {
    tabRepo.findOne.mockResolvedValue({ ...openTab, status: 'closed' });
    await expect(
      service.submitReview('tab-1', 'TRACK-1', { rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([0, 6, 3.5, Number('abc')])(
    'rejects invalid rating %s',
    async (rating) => {
      tabRepo.findOne.mockResolvedValue(openTab);
      await expect(
        service.submitReview('tab-1', 'TRACK-1', { rating }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('creates a new review with business_id from the branch', async () => {
    tabRepo.findOne.mockResolvedValue(openTab);
    branchRepo.findOne.mockResolvedValue({
      id: 'branch-1',
      business_id: 'biz-1',
    });
    reviewRepo.findOne.mockResolvedValue(null);
    const created = {
      id: 'review-1',
      business_id: 'biz-1',
      branch_id: 'branch-1',
      tab_id: 'tab-1',
      rating: 5,
      comment: 'Food was great!',
      created_at: new Date(),
    };
    reviewRepo.create.mockImplementation((dto: any) => dto);
    reviewRepo.save.mockResolvedValue(created);

    const res = await service.submitReview('tab-1', 'TRACK-1', {
      rating: 5,
      comment: '  Food was great!  ',
    });

    expect(reviewRepo.create).toHaveBeenCalledWith({
      business_id: 'biz-1',
      branch_id: 'branch-1',
      tab_id: 'tab-1',
      rating: 5,
      comment: 'Food was great!',
    });
    expect(res).toEqual({
      success: true,
      review: {
        id: 'review-1',
        rating: 5,
        comment: 'Food was great!',
        created_at: created.created_at,
      },
    });
  });

  it('updates an existing review instead of creating a second', async () => {
    tabRepo.findOne.mockResolvedValue(openTab);
    branchRepo.findOne.mockResolvedValue({
      id: 'branch-1',
      business_id: 'biz-1',
    });
    const existing = {
      id: 'review-1',
      business_id: 'biz-1',
      rating: 3,
      comment: 'old',
    } as any;
    reviewRepo.findOne.mockResolvedValue(existing);
    reviewRepo.save.mockResolvedValue({ ...existing, rating: 4, comment: 'new' });

    await service.submitReview('tab-1', 'TRACK-1', {
      rating: 4,
      comment: 'new',
    });

    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(existing.rating).toBe(4);
    expect(existing.comment).toBe('new');
    expect(reviewRepo.save).toHaveBeenCalledWith(existing);
  });

  it('truncates long comments and stores null for blank comments', async () => {
    tabRepo.findOne.mockResolvedValue(openTab);
    branchRepo.findOne.mockResolvedValue({
      id: 'branch-1',
      business_id: 'biz-1',
    });
    reviewRepo.findOne.mockResolvedValue(null);
    reviewRepo.create.mockImplementation((dto: any) => dto);
    reviewRepo.save.mockImplementation((r: any) =>
      Promise.resolve({ id: 'review-1', ...r, created_at: new Date() }),
    );

    await service.submitReview('tab-1', 'TRACK-1', {
      rating: 4,
      comment: 'x'.repeat(2500),
    });
    expect(reviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'x'.repeat(2000) }),
    );

    await service.submitReview('tab-1', 'TRACK-1', {
      rating: 4,
      comment: '   ',
    });
    expect(reviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null }),
    );
  });
});
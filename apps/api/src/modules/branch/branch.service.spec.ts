import { BranchService } from './branch.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn(async (e) => ({ ...e, id: 'mock-id' })),
  update: jest.fn(),
  remove: jest.fn(),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
});

describe('BranchService', () => {
  let service: BranchService;

  beforeEach(async () => {
    service = new BranchService(
      mockRepo() as any,
      mockRepo() as any,
      mockRepo() as any,
      mockRepo() as any,
      mockRepo() as any,
      mockRepo() as any,
      { createTrialSubscription: jest.fn() } as any,
      { log: jest.fn() } as any,
      { ensureSystemTables: jest.fn() } as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

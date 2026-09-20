import { SyncService } from './sync.service';

/**
 * Regression tests for the offline-sync tenancy fixes.
 *
 * Before these, POST /sync/queue was a cross-tenant mutation primitive:
 * replay trusted payload.branch_id, ran bills with a hardcoded 'owner'
 * role, deleted orders globally by id, and mass-assigned raw payloads into
 * the orders table.
 */
describe('SyncService replay scoping', () => {
  const BRANCH = 'branch-a';
  const OTHER_BRANCH = 'branch-b';
  const actor = { userId: 'user-1', role: 'waiter' };

  let syncQueueRepo: any;
  let billService: any;
  let managerRepos: Map<any, any>;
  let manager: any;
  let dataSource: any;
  let service: SyncService;

  const repoMock = () => ({
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((d: any) => d),
    save: jest.fn(async (e: any) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  });

  beforeEach(() => {
    syncQueueRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (e: any) => ({ id: 'q1', ...e })),
      create: jest.fn((d: any) => d),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    };
    billService = {
      generateBill: jest.fn().mockResolvedValue({}),
      processPayment: jest.fn().mockResolvedValue({}),
    };
    managerRepos = new Map();
    manager = {
      getRepository: jest.fn((entity: any) => {
        if (!managerRepos.has(entity)) managerRepos.set(entity, repoMock());
        return managerRepos.get(entity);
      }),
    };
    dataSource = {
      transaction: jest.fn(async (fn: any) => fn(manager)),
    };
    service = new SyncService(
      syncQueueRepo,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      repoMock() as any,
      billService,
      dataSource,
    );
  });

  const queue = (entityType: string, operation: string, payload: any) =>
    service.queueOperation(
      BRANCH,
      entityType,
      operation,
      payload,
      undefined,
      actor,
    );

  it('bill.pay ignores payload.branch_id and uses the caller identity, never a hardcoded owner role', async () => {
    await queue('bill', 'pay', {
      tab_id: 'tab-1',
      branch_id: OTHER_BRANCH,
      method: 'cash',
      amount: 5000,
    });
    expect(billService.processPayment).toHaveBeenCalledWith(
      'tab-1',
      BRANCH,
      actor.userId,
      actor.role,
      expect.objectContaining({ amount: 5000 }),
    );
  });

  it('bill.create ignores payload.branch_id and passes the real caller role', async () => {
    await queue('bill', 'create', {
      tab_id: 'tab-1',
      branch_id: OTHER_BRANCH,
      discount_kobo: 1000,
    });
    expect(billService.generateBill).toHaveBeenCalledWith(
      'tab-1',
      BRANCH,
      actor.userId,
      actor.role,
      expect.objectContaining({ discount_kobo: 1000 }),
    );
  });

  it('order.delete refuses an order whose tab is in another branch', async () => {
    const [orderRepo, tabRepo] = [{}, {}];
    manager.getRepository = jest.fn((entity: any) => {
      const name = entity?.name;
      if (!managerRepos.has(name)) managerRepos.set(name, repoMock());
      return managerRepos.get(name);
    });
    manager.getRepository({ name: 'Order' }); // pre-create
    const orderRepoMock = managerRepos.get('Order');
    const tabRepoMock =
      (managerRepos.set('Tab', repoMock()), managerRepos.get('Tab'));
    orderRepoMock.findOne.mockResolvedValue({
      id: 'o1',
      tab_id: 'foreign-tab',
      branch_id: null,
    });
    tabRepoMock.findOne.mockResolvedValue(null); // tab not in caller branch

    await expect(queue('order', 'delete', { id: 'o1' })).rejects.toThrow(
      'Order not found in this branch',
    );
    expect(orderRepoMock.delete).not.toHaveBeenCalled();
  });

  it('order.create refuses a tab outside the caller branch', async () => {
    manager.getRepository = jest.fn((entity: any) => {
      const name = entity?.name;
      if (!managerRepos.has(name)) managerRepos.set(name, repoMock());
      return managerRepos.get(name);
    });
    managerRepos.set('Tab', repoMock());
    managerRepos.get('Tab').findOne.mockResolvedValue(null);

    await expect(
      queue('order', 'create', {
        id: 'o1',
        tab_id: 'foreign-tab',
        menu_item_id: 'm1',
        quantity: 2,
      }),
    ).rejects.toThrow('Tab not found in this branch');
  });

  it('tab.update scopes the update to the caller branch', async () => {
    manager.getRepository = jest.fn((entity: any) => {
      const name = entity?.name;
      if (!managerRepos.has(name)) managerRepos.set(name, repoMock());
      return managerRepos.get(name);
    });
    await queue('tab', 'update', { id: 'tab-x', status: 'paid' });
    const tabRepoMock = managerRepos.get('Tab');
    expect(tabRepoMock.update).toHaveBeenCalledWith(
      { id: 'tab-x', branch_id: BRANCH },
      expect.objectContaining({ status: 'paid' }),
    );
  });
});

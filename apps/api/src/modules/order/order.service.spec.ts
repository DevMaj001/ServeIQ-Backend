import { OrderService } from './order.service';

describe('OrderService', () => {
  it('deducts stock when new order items are created', async () => {
    const orderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    } as any;

    const menuRepository = {
      find: jest.fn(),
    } as any;

    const tabRepository = {
      findOne: jest.fn().mockResolvedValue({ branch_id: 'branch-1' }),
    } as any;

    const ingredientService = {
      deductByTab: jest.fn().mockResolvedValue(undefined),
    } as any;

    const departmentRepo = {
      findOne: jest.fn(),
    } as any;

    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as any;

    const manager = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn((dto) => dto),
        save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
    } as any;

    menuRepository.find.mockResolvedValue([
      {
        id: 'menu-1',
        name: 'Jollof Rice',
        price_kobo: 5000,
        track_stock: true,
        quantity_in_stock: 10,
      },
    ]);

    const service = new OrderService(
      orderRepository,
      menuRepository,
      tabRepository,
      departmentRepo,
      dataSource,
      ingredientService,
      auditService,
    );

    await service.addOrderItems('tab-1', [{ menu_item_id: 'menu-1', quantity: 3 }], 'user-1');

    expect(ingredientService.deductByTab).toHaveBeenCalledWith(
      { id: 'tab-1', branch_id: 'branch-1' },
      [{ menu_item_id: 'menu-1', quantity: 3 }],
      manager,
    );
  });
});

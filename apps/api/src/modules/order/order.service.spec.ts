import { OrderService } from './order.service';
import { OrderStatus } from '../../common/shared';

const mockRealtimeService = () => ({
  emitOrderCreated: jest.fn(),
  emitOrderUpdated: jest.fn(),
  emitOrderStatusChange: jest.fn(),
  emitDashboardUpdate: jest.fn(),
});

describe('OrderService', () => {
  const mockOrderRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  });

  const mockMenuRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
  });

  const mockTabRepository = () => ({
    findOne: jest.fn(),
    update: jest.fn(),
  });

  const mockDepartmentRepo = () => ({
    findOne: jest.fn(),
  });

  const mockTableRepository = () => ({
    findOne: jest.fn(),
  });

  const mockBranchRepository = () => ({
    findOne: jest.fn(),
  });

  const mockBusinessRepository = () => ({
    findOne: jest.fn(),
  });

  const mockDataSource = () => ({
    transaction: jest.fn(async (cb) => cb(manager)),
    query: jest.fn(),
  });

  const mockIngredientService = () => ({
    deductByTab: jest.fn().mockResolvedValue(undefined),
  });

  const mockAuditService = () => ({
    log: jest.fn().mockResolvedValue(undefined),
  });

  const mockNotificationService = () => ({
    create: jest.fn().mockResolvedValue(undefined),
  });

  let manager: any;

  beforeEach(() => {
    manager = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn((dto) => dto),
        save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
        findOne: jest.fn(),
      }),
    };
  });

  const buildService = (overrides: any = {}) => {
    const orderRepo = overrides.orderRepository ?? mockOrderRepository();
    const menuRepo = overrides.menuRepository ?? mockMenuRepository();
    const tabRepo = overrides.tabRepository ?? mockTabRepository();
    const tableRepo = overrides.tableRepository ?? mockTableRepository();
    const branchRepo = overrides.branchRepository ?? mockBranchRepository();
    const businessRepo =
      overrides.businessRepository ?? mockBusinessRepository();
    const deptRepo = overrides.departmentRepo ?? mockDepartmentRepo();
    const dataSource = overrides.dataSource ?? mockDataSource();
    const ingredientService =
      overrides.ingredientService ?? mockIngredientService();
    const auditService = overrides.auditService ?? mockAuditService();
    const notificationService =
      overrides.notificationService ?? mockNotificationService();
    const realtimeService = overrides.realtimeService ?? mockRealtimeService();

    return new OrderService(
      orderRepo,
      menuRepo,
      tabRepo,
      tableRepo,
      branchRepo,
      businessRepo,
      deptRepo,
      dataSource,
      ingredientService,
      auditService,
      notificationService,
      realtimeService,
    );
  };

  describe('addOrderItems', () => {
    it('deducts stock when new order items are created', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Jollof Rice',
          price_kobo: 5000,
          track_stock: true,
          quantity_in_stock: 10,
        },
      ]);

      const ingredientService = mockIngredientService();
      const auditService = mockAuditService();

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        ingredientService,
        auditService,
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 3 }],
        'user-1',
      );

      expect(ingredientService.deductByTab).toHaveBeenCalledWith(
        { id: 'tab-1', branch_id: 'branch-1' },
        [{ menu_item_id: 'menu-1', quantity: 3 }],
        manager,
      );
      expect(result).toHaveLength(1);
      expect(result[0].subtotal_kobo).toBe(15000);
    });

    it('throws when menu item not found', async () => {
      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([]);

      const service = buildService({ menuRepository: menuRepo });

      await expect(
        service.addOrderItems(
          'tab-1',
          [{ menu_item_id: 'unknown', quantity: 1 }],
          'user-1',
        ),
      ).rejects.toThrow('Menu item unknown not found');
    });

    it('throws on insufficient stock', async () => {
      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Jollof Rice',
          price_kobo: 5000,
          track_stock: true,
          quantity_in_stock: 2,
        },
      ]);

      const service = buildService({ menuRepository: menuRepo });

      await expect(
        service.addOrderItems(
          'tab-1',
          [{ menu_item_id: 'menu-1', quantity: 5 }],
          'user-1',
        ),
      ).rejects.toThrow('Insufficient stock');
    });

    it('applies the VIP surcharge to a tab sitting on a VIP table', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: 'table-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Pizza',
          price_kobo: 5000,
          track_stock: false,
          quantity_in_stock: 10,
        },
      ]);

      const vipManager = {
        getRepository: jest.fn((entity) => {
          const repos = {
            table: {
              findOne: jest.fn().mockResolvedValue({ is_vip: true }),
            },
            branch: {
              findOne: jest
                .fn()
                .mockResolvedValue({ business_id: 'business-1' }),
            },
            business: {
              findOne: jest
                .fn()
                .mockResolvedValue({ vip_surcharge_percent: 10 }),
            },
            order: {
              create: jest.fn((dto) => dto),
              save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
              findOne: jest.fn(),
            },
          };
          if (entity?.name === 'Table') return repos.table;
          if (entity?.name === 'Branch') return repos.branch;
          if (entity?.name === 'Business') return repos.business;
          return repos.order;
        }),
      };
      const dataSource: any = {
        transaction: jest.fn(async (cb) => cb(vipManager)),
        query: jest.fn(),
      };

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        dataSource,
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 2 }],
        'user-1',
      );

      // 5000 kobo + 10% = 5500 per unit; 2 x 5500 = 11000.
      expect(result[0].unit_price_kobo).toBe(5500);
      expect(result[0].subtotal_kobo).toBe(11000);
    });

    it('does not apply the VIP surcharge on a regular table', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: 'table-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Pizza',
          price_kobo: 5000,
          track_stock: false,
          quantity_in_stock: 10,
        },
      ]);

      const vipManager = {
        getRepository: jest.fn((entity) => {
          const repos = {
            table: {
              findOne: jest.fn().mockResolvedValue({ is_vip: false }),
            },
            order: {
              create: jest.fn((dto) => dto),
              save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
              findOne: jest.fn(),
            },
          };
          if (entity?.name === 'Table') return repos.table;
          return repos.order;
        }),
      };
      const dataSource: any = {
        transaction: jest.fn(async (cb) => cb(vipManager)),
        query: jest.fn(),
      };

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        dataSource,
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 2 }],
        'user-1',
      );

      expect(result[0].unit_price_kobo).toBe(5000);
      expect(result[0].subtotal_kobo).toBe(10000);
    });

    it('calculates subtotal with modifiers', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Pizza',
          price_kobo: 10000,
          track_stock: false,
          quantity_in_stock: 0,
        },
      ]);

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
      });

      const result = await service.addOrderItems(
        'tab-1',
        [
          {
            menu_item_id: 'menu-1',
            quantity: 2,
            modifiers: [{ name: 'Extra Cheese', price_kobo: 1500, qty: 1 }],
          },
        ],
        'user-1',
      );

      expect(result[0].subtotal_kobo).toBe(21500);
      expect(result[0].modifiers).toEqual([
        { name: 'Extra Cheese', price_kobo: 1500, qty: 1 },
      ]);
    });

    it('routes instant items to ready_for_pickup immediately', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Coke',
          price_kobo: 1500,
          track_stock: false,
          prep_type: 'instant',
        },
      ]);

      manager.getRepository = jest.fn().mockReturnValue({
        create: jest.fn((dto) => dto),
        save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
        findOne: jest.fn(),
      });

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        dataSource: {
          transaction: jest.fn(async (cb) => cb(manager)),
          query: jest.fn(),
        },
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 1 }],
        'user-1',
      );

      expect(result[0].order_status).toBe(OrderStatus.READY_FOR_PICKUP);
    });

    it('routes cook items to pending supervisor approval', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Jollof Rice',
          price_kobo: 5000,
          track_stock: false,
          prep_type: 'cook',
        },
      ]);

      manager.getRepository = jest.fn().mockReturnValue({
        create: jest.fn((dto) => dto),
        save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
        findOne: jest.fn(),
      });

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        dataSource: {
          transaction: jest.fn(async (cb) => cb(manager)),
          query: jest.fn(),
        },
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 1 }],
        'user-1',
      );

      expect(result[0].order_status).toBe(
        OrderStatus.PENDING_SUPERVISOR_APPROVAL,
      );
    });

    it('defaults items without prep_type to pending supervisor approval', async () => {
      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const menuRepo = mockMenuRepository();
      menuRepo.find.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Jollof Rice',
          price_kobo: 5000,
          track_stock: false,
        },
      ]);

      manager.getRepository = jest.fn().mockReturnValue({
        create: jest.fn((dto) => dto),
        save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
        findOne: jest.fn(),
      });

      const service = buildService({
        tabRepository: tabRepo,
        menuRepository: menuRepo,
        dataSource: {
          transaction: jest.fn(async (cb) => cb(manager)),
          query: jest.fn(),
        },
      });

      const result = await service.addOrderItems(
        'tab-1',
        [{ menu_item_id: 'menu-1', quantity: 1 }],
        'user-1',
      );

      expect(result[0].order_status).toBe(
        OrderStatus.PENDING_SUPERVISOR_APPROVAL,
      );
    });
  });

  describe('findByTab', () => {
    it('returns orders for a tab', async () => {
      const orderRepo = mockOrderRepository();
      orderRepo.find.mockResolvedValue([
        { id: 'o1', tab_id: 'tab-1', subtotal_kobo: 5000 },
      ]);

      const service = buildService({ orderRepository: orderRepo });
      const result = await service.findByTab('tab-1');

      expect(orderRepo.find).toHaveBeenCalledWith({
        where: { tab_id: 'tab-1' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns order by id', async () => {
      const orderRepo = mockOrderRepository();
      orderRepo.findOne.mockResolvedValue({ id: 'o1', tab_id: 'tab-1' });

      const service = buildService({ orderRepository: orderRepo });
      const result = await service.findOne('o1');
      expect(result.id).toBe('o1');
    });

    it('throws when order not found', async () => {
      const orderRepo = mockOrderRepository();
      orderRepo.findOne.mockResolvedValue(null);

      const service = buildService({ orderRepository: orderRepo });
      await expect(service.findOne('missing')).rejects.toThrow(
        'Order item not found',
      );
    });
  });

  describe('updateOrder', () => {
    it('updates quantity and recalculates subtotal', async () => {
      const orderRepo = mockOrderRepository();
      orderRepo.findOne.mockResolvedValue({
        id: 'o1',
        quantity: 2,
        unit_price_kobo: 5000,
        subtotal_kobo: 10000,
        modifiers: [],
      });
      orderRepo.save.mockImplementation(async (o) => o);

      const service = buildService({ orderRepository: orderRepo });
      const result = await service.updateOrder('o1', { quantity: 3 });

      expect(result.subtotal_kobo).toBe(15000);
    });
  });

  describe('removeOrder', () => {
    it('removes order and returns message', async () => {
      const orderRepo = mockOrderRepository();
      const order = {
        id: 'o1',
        tab_id: 'tab-1',
        order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
      };
      orderRepo.findOne.mockResolvedValue(order);
      orderRepo.remove.mockResolvedValue(undefined);

      const service = buildService({ orderRepository: orderRepo });
      const result = await service.removeOrder('o1');

      expect(orderRepo.remove).toHaveBeenCalledWith(order);
      expect(result.message).toBe('Order item removed successfully');
    });
  });

  describe('approve', () => {
    it('approves a pending order and creates notification', async () => {
      const deptRepo = mockDepartmentRepo();
      deptRepo.findOne.mockResolvedValue({
        id: 'dept-1',
        name: 'Kitchen',
        branch_id: 'branch-1',
      });

      const orderRepo = mockOrderRepository();
      orderRepo.findOne.mockResolvedValue({
        id: 'o1',
        tab_id: 'tab-1',
        order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
      });

      const auditService = mockAuditService();
      const notificationService = mockNotificationService();

      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        tracking_code: 'SVQ-ABCD-123',
        status: 'open',
      });

      const dataSource: any = {
        transaction: jest.fn(async (cb) => {
          const m = {
            getRepository: jest.fn().mockReturnValue({
              findOne: jest.fn().mockResolvedValue({
                id: 'o1',
                tab_id: 'tab-1',
                order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
              }),
              save: jest.fn(async (order) => ({ ...order, id: 'o1' })),
            }),
          };
          return cb(m);
        }),
      };

      const service = buildService({
        tabRepository: tabRepo,
        departmentRepo: deptRepo,
        orderRepository: orderRepo,
        dataSource,
        auditService,
        notificationService,
      });

      const result = await service.approve('o1', 'user-1', {
        department: 'dept-1',
        estimated_preparation_time_seconds: 600,
      });

      expect(result.order_status).toBe(OrderStatus.APPROVED);
      expect(result.approved_by).toBe('user-1');
      expect(auditService.log).toHaveBeenCalled();
      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Tracking: SVQ-ABCD-123'),
        }),
      );
    });
  });

  describe('decline', () => {
    it('declines a pending order', async () => {
      const orderRepo = mockOrderRepository();
      orderRepo.findOne.mockResolvedValue({ id: 'o1', tab_id: 'tab-1' });

      const tabRepo = mockTabRepository();
      tabRepo.findOne.mockResolvedValue({
        id: 'tab-1',
        branch_id: 'branch-1',
        status: 'open',
      });

      const dataSource: any = {
        transaction: jest.fn(async (cb) => {
          const m = {
            getRepository: jest.fn().mockReturnValue({
              findOne: jest.fn().mockResolvedValue({
                id: 'o1',
                tab_id: 'tab-1',
                order_status: OrderStatus.PENDING_SUPERVISOR_APPROVAL,
              }),
              save: jest.fn(async (order) => order),
            }),
          };
          return cb(m);
        }),
      };

      const auditService = mockAuditService();

      const service = buildService({
        orderRepository: orderRepo,
        tabRepository: tabRepo,
        dataSource,
        auditService,
      });

      const result = await service.decline('o1', 'user-1', {
        decline_reason: 'Out of stock',
      });

      expect(result.order_status).toBe(OrderStatus.DECLINED);
      expect(result.declined_by).toBe('user-1');
      expect(result.decline_reason).toBe('Out of stock');
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('expireTimers', () => {
    it('marks expired orders as ready for pickup', async () => {
      const now = new Date();
      const orderRepo = mockOrderRepository();
      orderRepo.find.mockResolvedValue([
        {
          id: 'o1',
          order_status: OrderStatus.APPROVED,
          timer_ends_at: new Date(now.getTime() - 1000),
        },
        {
          id: 'o2',
          order_status: OrderStatus.APPROVED,
          timer_ends_at: new Date(now.getTime() - 5000),
        },
      ]);
      orderRepo.save.mockResolvedValue(undefined);

      const service = buildService({ orderRepository: orderRepo });
      const result = await service.expireTimers();

      expect(result).toHaveLength(2);
      expect(result[0].order_status).toBe(OrderStatus.READY_FOR_PICKUP);
      expect(orderRepo.save).toHaveBeenCalled();
    });
  });
});

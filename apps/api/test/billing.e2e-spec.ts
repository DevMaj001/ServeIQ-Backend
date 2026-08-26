import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DataSource } from 'typeorm';
import { Business } from '../src/modules/business/entities/business.entity';
import { Branch } from '../src/modules/branch/entities/branch.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { Table as RestaurantTable } from '../src/modules/table/entities/table.entity';
import { MenuItem } from '../src/modules/menu/entities/menu-item.entity';
import { Tab } from '../src/modules/tab/entities/tab.entity';
import { Order } from '../src/modules/order/entities/order.entity';
import { Bill } from '../src/modules/bill/entities/bill.entity';
import { TableStatus } from '../src/modules/table/entities/table.entity';
import { OrderStatus } from '../src/common/shared';

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(async (e) => ({
    ...e,
    id: 'repo-' + Math.random().toString(36).slice(2),
    created_at: new Date(),
    updated_at: new Date(),
  })),
  create: jest.fn((e) => e),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  findAndCount: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  createQueryBuilder: jest.fn(),
});

const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockRepo()),
  entityMetadatas: [],
  transaction: jest.fn(async (cb) => {
    const m = { getRepository: jest.fn().mockReturnValue(mockRepo()) };
    return cb(m);
  }),
  manager: { getRepository: jest.fn().mockReturnValue(mockRepo()) },
  options: {},
  isInitialized: true,
  destroy: jest.fn(),
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
};

describe('Billing E2E (V1 acceptance)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new TransformInterceptor(reflector));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('health', () => {
    it('GET / should respond', () => {
      return request(app.getHttpServer()).get('/').expect(200);
    });
  });

  describe('auth', () => {
    it('POST /api/v1/auth/register creates a business', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          businessName: 'Test Bistro',
          ownerName: 'Alice Owner',
          email: 'alice@test.com',
          password: 'SecurePass1!',
          phone: '+2348000000001',
          address: '123 Test St',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('full billing flow', () => {
    let token: string;
    let tabId: string;

    it('POST /api/v1/auth/register — owner registers', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          businessName: 'Billing E2E Bistro',
          ownerName: 'E2E Owner',
          email: 'e2e@test.com',
          password: 'SecurePass1!',
          phone: '+2348000000002',
          address: '456 E2E Ave',
        })
        .expect(201);

      token = res.body.data.token;
      expect(token).toBeDefined();
    });

    it('POST /api/v1/tabs/open — waiter opens a tab', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'table-1',
        branch_id: 'branch-1',
        status: TableStatus.AVAILABLE,
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'tab-1',
        branch_id: 'branch-1',
        table_id: 'table-1',
        waiter_id: 'waiter-1',
        status: 'open',
        opened_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/tabs/open')
        .set('Authorization', `Bearer ${token}`)
        .send({ tableId: 'table-1', waiterId: 'waiter-1' })
        .expect(201);

      tabId = res.body.data?.id || 'tab-1';
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/orders/tab/:tabId — adds items to tab', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'menu-item-1',
        name: 'Jollof Rice',
        price_kobo: 2500,
        is_available: true,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/tab/${tabId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ menuItemId: 'menu-item-1', quantity: 3 })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/bills/tab/:tabId/generate — generates bill', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: tabId,
        branch_id: 'branch-1',
        waiter_id: 'waiter-1',
        status: 'open',
      });
      mockDataSource
        .getRepository()
        .find.mockResolvedValueOnce([
          { subtotal_kobo: 7500, quantity: 3, unit_price_kobo: 2500 },
        ]);
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'branch-1',
        business_id: 'biz-1',
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'biz-1',
        tax_rate: 7.5,
      });
      mockDataSource.getRepository().save.mockResolvedValueOnce({
        id: 'bill-1',
        tab_id: tabId,
        subtotal_kobo: 7500,
        service_charge_kobo: 750,
        tax_kobo: 563,
        total_kobo: 8813,
        paid_at: null,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bills/tab/${tabId}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.total_kobo).toBeGreaterThan(0);
    });

    it('POST /api/v1/bills/tab/:tabId/pay — records payment', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: tabId,
        branch_id: 'branch-1',
        waiter_id: 'waiter-1',
        status: 'billed',
        table_id: 'table-1',
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'bill-1',
        tab_id: tabId,
        total_kobo: 8813,
        paid_at: null,
      });
      mockDataSource.getRepository().save.mockResolvedValueOnce({
        id: 'bill-1',
        paid_at: new Date(),
        payment_method: 'cash',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bills/tab/${tabId}/pay`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 8813, method: 'cash' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.paid_at).toBeDefined();
    });

    it('GET /api/v1/bills/tab/:tabId/receipt — returns receipt', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: tabId,
        branch_id: 'branch-1',
        waiter_id: 'waiter-1',
        status: 'paid',
        table_id: 'table-1',
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'bill-1',
        tab_id: tabId,
        total_kobo: 8813,
        paid_at: new Date(),
        payment_method: 'cash',
      });
      mockDataSource.getRepository().find.mockResolvedValueOnce([
        {
          id: 'o1',
          menu_item_id: 'mi1',
          quantity: 3,
          unit_price_kobo: 2500,
          subtotal_kobo: 7500,
        },
      ]);
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'mi1',
        name: 'Jollof Rice',
        price_kobo: 2500,
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'table-1',
        table_number: 5,
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'waiter-1',
        full_name: 'E2E Waiter',
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'branch-1',
        name: 'Main Branch',
      });
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'biz-1',
        name: 'Billing E2E Bistro',
        address: '456 E2E Ave',
        phone: '+2348000000002',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bills/tab/${tabId}/receipt`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('cross-business data leakage', () => {
    let ownerToken: string;
    let waiterToken: string;

    it('owner registers Business A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          businessName: 'Business A',
          ownerName: 'Owner A',
          email: 'owner-a@e2e.test',
          password: 'SecurePass1!',
          phone: '+2348000000010',
          address: '789 Business A St',
        })
        .expect(201);

      ownerToken = res.body.data.token;
    });

    it('owner registers Business B', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          businessName: 'Business B',
          ownerName: 'Owner B',
          email: 'owner-b@e2e.test',
          password: 'SecurePass1!',
          phone: '+2348000000011',
          address: '789 Business B St',
        })
        .expect(201);

      waiterToken = res.body.data.token;
    });

    it('waiter from Business A cannot generate bill for Business B tab', async () => {
      mockDataSource.getRepository().findOne.mockResolvedValueOnce({
        id: 'foreign-tab',
        branch_id: 'branch-B',
        waiter_id: 'waiter-other',
        status: 'open',
      });

      await request(app.getHttpServer())
        .post('/api/v1/bills/tab/foreign-tab/generate')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({})
        .expect(403);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * V1 billing acceptance test (real-DB backed).
 *
 * This boots the full AppModule against a real Postgres database pointed to by
 * DATABASE_URL (or TEST_DATABASE_URL). It refuses to run against a production
 * database, and requires the env var to be set before jest starts.
 *
 *   TEST_DATABASE_URL=postgresql://... npm run test:e2e -- billing
 *
 * It validates the full billing happy path end-to-end (register -> table ->
 * menu -> open tab -> order -> generate bill -> pay -> receipt) plus
 * cross-business data leakage on the bill endpoints.
 */
const isProdDatabase = (url: string): boolean =>
  /pooler\.supabase\.com|supabase\.co|render\.com|neon\.tech/.test(url);

describe('Billing E2E (V1 acceptance)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const suffix = Date.now().toString(36);
  const emailA = `billing-a-${suffix}@e2e.test`;
  const emailB = `billing-b-${suffix}@e2e.test`;

  let tokenA: string;
  let tokenB: string;
  let waiterTokenB: string;
  let businessA: string;
  let businessB: string;
  let branchA: string;
  let branchB: string;
  let tableId: string;
  let menuItemId: string;
  let tabId: string;
  let orderId: string;
  let billTotalKobo: number;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
    if (!url) {
      throw new Error(
        'Billing E2E requires TEST_DATABASE_URL (or DATABASE_URL) to be set before jest starts.',
      );
    }
    if (isProdDatabase(url)) {
      throw new Error(
        'Refusing to run the billing E2E against a production database.',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (app && dataSource) {
      try {
        await cleanupBusinesses([businessA, businessB].filter(Boolean));
      } catch (e) {
        console.warn(
          '[billing-e2e] cleanup warning:',
          e instanceof Error ? e.message : String(e),
        );
      }
      await app.close();
    }
  });

  it('registers Business A and returns an owner token', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({
        businessName: `Billing Biz A ${suffix}`,
        businessType: 'restaurant',
        fullName: 'Billing Owner A',
        email: emailA,
        password: 'SecurePass1!',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    tokenA = res.body.data.access_token;
    businessA = res.body.data.user.business;
    branchA = res.body.data.user.branch;
    expect(tokenA).toBeTruthy();
  });

  it('registers Business B and returns an owner token', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({
        businessName: `Billing Biz B ${suffix}`,
        businessType: 'restaurant',
        fullName: 'Billing Owner B',
        email: emailB,
        password: 'SecurePass1!',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    tokenB = res.body.data.access_token;
    businessB = res.body.data.user.business;
    branchB = res.body.data.user.branch;
    expect(tokenB).toBeTruthy();
  });

  it('opens a tab at a table', async () => {
    const tableRes = await http()
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ table_number: `BIL-${suffix}`, capacity: 4 })
      .expect(201);
    tableId = tableRes.body.data.id;

    const menuRes = await http()
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Billing Dish ${suffix}`,
        category: 'Food',
        price_kobo: 2500,
        is_available: true,
        track_stock: false,
      })
      .expect(201);
    menuItemId = menuRes.body.data.id;

    await http()
      .post('/api/v1/shifts/open')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ starting_cash_kobo: 0 })
      .expect(201);

    const tabRes = await http()
      .post('/api/v1/tabs/open')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ table_id: tableId })
      .expect(201);

    tabId = tabRes.body.data.id;
    expect(tabId).toBeTruthy();
  });

  it('adds an order item to the tab', async () => {
    const res = await http()
      .post(`/api/v1/orders/tab/${tabId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send([{ menu_item_id: menuItemId, quantity: 3 }])
      .expect(201);

    orderId = res.body.data[0].id;
    expect(orderId).toBeTruthy();
  });

  it('generates a bill for the tab', async () => {
    const res = await http()
      .post(`/api/v1/bills/tab/${tabId}/generate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);

    const bill = res.body.data;
    expect(res.body.success).toBe(true);
    expect(bill.total_kobo).toBeGreaterThan(0);
    billTotalKobo = bill.total_kobo;
  });

  it('records a cash payment and closes the tab', async () => {
    const res = await http()
      .post(`/api/v1/bills/tab/${tabId}/pay`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: billTotalKobo, method: 'cash' })
      .expect([200, 201]);

    expect(res.body.data.paid_at).toBeTruthy();
  });

  it('returns a receipt for the paid bill', async () => {
    const res = await http()
      .get(`/api/v1/bills/tab/${tabId}/receipt`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('rejects Business B from reading Business A tab', async () => {
    await http()
      .get(`/api/v1/tabs/${tabId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('rejects a Business B waiter from billing a Business A tab', async () => {
    const waiterRes = await http()
      .post('/api/v1/user/waiters')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        fullName: 'Billing Waiter B',
        email: `billing-waiter-b-${suffix}@e2e.test`,
        phone: '+2348000000003',
        branchId: branchB,
        role: 'waiter',
      })
      .expect(201);

    const pin = waiterRes.body.data.pin;
    expect(pin).toBeTruthy();

    const login = await http()
      .post('/api/v1/auth/waiter-login')
      .send({ pin, businessId: businessB })
      .expect(200);

    waiterTokenB = login.body.data.access_token;
    expect(waiterTokenB).toBeTruthy();

    await http()
      .post(`/api/v1/bills/tab/${tabId}/generate`)
      .set('Authorization', `Bearer ${waiterTokenB}`)
      .send({})
      .expect(403);
  });

  async function cleanupBusinesses(ids: string[]) {
    if (!ids.length) return;
    const joined = `'${ids.join("','")}'`;
    const run = (sql: string) =>
      dataSource
        .query(sql)
        .catch((e: unknown) =>
          console.warn(
            '[billing-e2e] cleanup statement skipped:',
            e instanceof Error ? e.message : String(e),
          ),
        );

    const tabsIn = `SELECT id FROM tabs WHERE branch_id IN (SELECT id FROM branches WHERE business_id IN (${joined}))`;
    const branchesIn = `SELECT id FROM branches WHERE business_id IN (${joined})`;
    const usersIn = `SELECT id FROM users WHERE business_id IN (${joined})`;

    await run(`DELETE FROM bills WHERE tab_id IN (${tabsIn})`);
    await run(`DELETE FROM orders WHERE tab_id IN (${tabsIn})`);
    await run(`DELETE FROM tabs WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM shifts WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM menu_items WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM tables WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM departments WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM notifications WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM audit_logs WHERE branch_id IN (${branchesIn})`);
    await run(`DELETE FROM refresh_tokens WHERE user_id IN (${usersIn})`);
    await run(`DELETE FROM users WHERE business_id IN (${joined})`);
    await run(`DELETE FROM branches WHERE business_id IN (${joined})`);
    await run(`DELETE FROM businesses WHERE id IN (${joined})`);
  }
});

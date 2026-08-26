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
 * Real-database smoke test for the V1 billing flow.
 *
 * Unlike the other e2e specs (which mock the DataSource), this spec boots the
 * full AppModule against a real Postgres database pointed to by DATABASE_URL
 * (or TEST_DATABASE_URL). It is intentionally gated: it refuses to run
 * against the production Supabase database, and requires the env var to be
 * set before jest starts.
 *
 *   TEST_DATABASE_URL=postgresql://... npm run test:e2e -- real-db
 *
 * It validates the full happy path end-to-end (register -> tables -> menu ->
 * open tab -> order -> generate bill -> pay -> receipt) plus cross-business
 * data leakage on the real schema.
 */
const isProdDatabase = (url: string): boolean =>
  /pooler\.supabase\.com|supabase\.co|render\.com|neon\.tech/.test(url);

describe('Real-DB smoke (V1 acceptance)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const suffix = Date.now().toString(36);
  const emailA = `smoke-a-${suffix}@e2e.test`;
  const emailB = `smoke-b-${suffix}@e2e.test`;

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
  let departmentId: string;
  let billTotalKobo: number;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
    if (!url) {
      throw new Error(
        'Real-DB smoke requires TEST_DATABASE_URL (or DATABASE_URL) to be set before jest starts.',
      );
    }
    if (isProdDatabase(url)) {
      throw new Error(
        'Refusing to run the real-DB smoke test against a production database.',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
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
          '[real-db] cleanup warning:',
          e instanceof Error ? e.message : String(e),
        );
      }
    }
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------
  // Setup: two businesses with isolated data
  // ---------------------------------------------------------------------

  it('registers Business A and returns an owner token', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({
        businessName: `Smoke Biz A ${suffix}`,
        businessType: 'restaurant',
        fullName: 'Smoke Owner A',
        email: emailA,
        password: 'SecurePass1!',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    tokenA = res.body.data.access_token;
    businessA = res.body.data.user.business;
    branchA = res.body.data.user.branch;
    expect(tokenA).toBeTruthy();
    expect(businessA).toBeTruthy();
    expect(branchA).toBeTruthy();
  });

  it('registers Business B and returns an owner token', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({
        businessName: `Smoke Biz B ${suffix}`,
        businessType: 'restaurant',
        fullName: 'Smoke Owner B',
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

  // ---------------------------------------------------------------------
  // Business A: full happy path
  // ---------------------------------------------------------------------

  it('creates a table', async () => {
    const res = await http()
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ table_number: `SMK-${suffix}`, capacity: 4 })
      .expect(201);

    tableId = res.body.data.id;
    expect(tableId).toBeTruthy();
  });

  it('creates a menu item', async () => {
    const res = await http()
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `Smoke Dish ${suffix}`,
        category: 'Food',
        price_kobo: 2500,
        is_available: true,
        track_stock: false,
      })
      .expect(201);

    menuItemId = res.body.data.id;
    expect(menuItemId).toBeTruthy();
  });

  it('opens a shift for the branch', async () => {
    await http()
      .post('/api/v1/shifts/open')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ starting_cash_kobo: 0 })
      .expect(201);
  });

  it('opens a tab at the table', async () => {
    const res = await http()
      .post('/api/v1/tabs/open')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ table_id: tableId })
      .expect(201);

    tabId = res.body.data.id;
    expect(tabId).toBeTruthy();
  });

  it('adds an order item to the tab', async () => {
    const res = await http()
      .post(`/api/v1/orders/tab/${tabId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send([{ menu_item_id: menuItemId, quantity: 2 }])
      .expect(201);

    orderId = res.body.data[0].id;
    expect(orderId).toBeTruthy();
  });

  it('creates a department for order assignment', async () => {
    const res = await http()
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Smoke Kitchen ${suffix}` })
      .expect(201);

    departmentId = res.body.data.id;
    expect(departmentId).toBeTruthy();
  });

  it('approves the order (assigned to department, timer started)', async () => {
    const res = await http()
      .post(`/api/v1/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ department: departmentId, estimated_preparation_time_seconds: 1 });
    if (res.status !== 201) {
      console.log(
        '[real-db] approve status:',
        res.status,
        JSON.stringify(res.body).slice(0, 300),
      );
    }
    expect(res.status).toBe(201);
  });

  it('simulates the prep timer firing (order becomes ready for pickup)', async () => {
    // The OrderScheduler cron flips APPROVED -> READY_FOR_PICKUP every 30s when
    // the prep timer expires. Cron does not fire within a jest test window, so
    // apply the same transition directly against the DB.
    await dataSource.query(
      `UPDATE orders SET order_status = 'ready_for_pickup', actual_ready_time = now() WHERE id = $1`,
      [orderId],
    );

    const res = await http()
      .get(`/api/v1/orders/tab/${tabId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.data[0].order_status).toBe('ready_for_pickup');
  });

  it('delivers the order', async () => {
    const res = await http()
      .post(`/api/v1/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${tokenA}`);
    if (res.status !== 201) {
      console.log(
        '[real-db] deliver status:',
        res.status,
        JSON.stringify(res.body).slice(0, 300),
      );
    }
    expect(res.status).toBe(201);
  });

  it('generates a bill with 10% service charge and 7.5% tax', async () => {
    const res = await http()
      .post(`/api/v1/bills/tab/${tabId}/generate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);

    const bill = res.body.data;
    billTotalKobo = bill.total_kobo;
    expect(bill.subtotal_kobo).toBe(5000);
    expect(bill.service_charge_kobo).toBe(500);
    expect(bill.tax_kobo).toBe(375);
    expect(billTotalKobo).toBe(5875);
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

  // ---------------------------------------------------------------------
  // Cross-business leakage
  // ---------------------------------------------------------------------

  it('rejects Business B from reading Business A tab', async () => {
    await http()
      .get(`/api/v1/tabs/${tabId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('creates a waiter under Business B', async () => {
    const res = await http()
      .post('/api/v1/user/waiters')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        fullName: 'Smoke Waiter B',
        email: `smoke-waiter-b-${suffix}@e2e.test`,
        phone: '+2348000000003',
        branchId: branchB,
        role: 'waiter',
      })
      .expect(201);

    const pin = res.body.data.pin;
    expect(pin).toBeTruthy();

    const login = await http()
      .post('/api/v1/auth/waiter-login')
      .send({ pin, businessId: businessB })
      .expect(200);

    waiterTokenB = login.body.data.access_token;
    expect(waiterTokenB).toBeTruthy();
  });

  it('rejects a Business B waiter from billing a Business A tab', async () => {
    await http()
      .post(`/api/v1/bills/tab/${tabId}/generate`)
      .set('Authorization', `Bearer ${waiterTokenB}`)
      .send({})
      .expect(403);
  });

  // ---------------------------------------------------------------------
  // Cleanup (best-effort, FK-safe order)
  // ---------------------------------------------------------------------

  async function cleanupBusinesses(ids: string[]) {
    if (!ids.length) return;
    const joined = `'${ids.join("','")}'`;
    const run = (sql: string) =>
      dataSource
        .query(sql)
        .catch((e: unknown) =>
          console.warn(
            '[real-db] cleanup statement skipped:',
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

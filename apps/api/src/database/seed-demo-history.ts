import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/modules/**/*.entity.ts'],
  synchronize: false,
  logging: false,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

const DAYS = 30;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const rand = lcg(20260825);
const intBetween = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const PAYMENT_METHODS = [
  'cash',
  'cash',
  'cash',
  'transfer',
  'transfer',
  'pos',
  'card',
];

const CUSTOMER_NAMES = [
  null,
  null,
  'Walk-in Customer',
  'Ade B.',
  'Chinedu O.',
  'Funmi A.',
  'Table Reservation',
  'Birthday Party',
];

async function main() {
  const ds = await AppDataSource.initialize();
  try {
    const bizRows = await ds.query(
      `SELECT * FROM businesses WHERE slug = 'demo-restaurant' AND deleted_at IS NULL LIMIT 1`,
    );
    if (!bizRows.length) {
      throw new Error(
        'Demo business not found — run `npm run seed -w apps/api` first.',
      );
    }
    const biz = bizRows[0];

    const branchRows = await ds.query(
      `SELECT * FROM branches WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [biz.id],
    );
    if (!branchRows.length) throw new Error('No branch for demo business');
    const branch = branchRows[0];

    const billCount = await ds.query(
      `SELECT COUNT(*)::int AS n FROM bills b JOIN tabs t ON t.id = b.tab_id WHERE t.branch_id = $1`,
      [branch.id],
    );
    if (billCount[0].n > 0) {
      console.log(
        `[demo-history] Branch already has ${billCount[0].n} bills — skipping.`,
      );
      return;
    }

    const staffRows: { id: string; email: string }[] = await ds.query(
      `SELECT id, email FROM users WHERE business_id = $1 AND deleted_at IS NULL AND email IN ('waiter@demo.com', 'manager@demo.com')`,
      [biz.id],
    );
    const waiterId = staffRows.find((u) => u.email === 'waiter@demo.com')?.id;
    const managerId = staffRows.find((u) => u.email === 'manager@demo.com')?.id;
    if (!waiterId || !managerId) {
      throw new Error('Demo staff not found — run base seed first.');
    }

    const tables: { id: string }[] = await ds.query(
      `SELECT id FROM tables WHERE branch_id = $1 AND deleted_at IS NULL ORDER BY table_number ASC`,
      [branch.id],
    );
    if (!tables.length) throw new Error('No tables for demo branch');

    const menuItems: { id: string; price_kobo: number }[] = await ds.query(
      `SELECT id, price_kobo FROM menu_items WHERE branch_id = $1 AND deleted_at IS NULL AND is_available = true`,
      [branch.id],
    );
    if (!menuItems.length) throw new Error('No menu items for demo branch');

    const servicePct = Number(biz.service_charge_percent ?? 0);
    const taxPct = Number(biz.tax_rate ?? 0);

    let totalTabs = 0;
    let totalOrders = 0;
    let revenueKobo = 0;

    for (let d = DAYS; d >= 1; d--) {
      const dayBase = new Date();
      dayBase.setUTCHours(16, 0, 0, 0);
      dayBase.setUTCDate(dayBase.getUTCDate() - d);
      const dateTag = dayBase.toISOString().slice(0, 10).replace(/-/g, '');
      const tabsToday = intBetween(4, 12);

      for (let i = 1; i <= tabsToday; i++) {
        const openedAt = new Date(dayBase.getTime());
        openedAt.setUTCMinutes(intBetween(0, 360));

        const rounds = intBetween(1, 3);
        const orderRows: {
          menuItemId: string;
          qty: number;
          unitPrice: number;
          round: number;
          at: Date;
        }[] = [];
        let cursor = openedAt.getTime();
        for (let r = 1; r <= rounds; r++) {
          cursor += intBetween(5, 40) * 60000;
          const lines = intBetween(1, 4);
          for (let l = 0; l < lines; l++) {
            const item = pick(menuItems);
            orderRows.push({
              menuItemId: item.id,
              qty: intBetween(1, 3),
              unitPrice: item.price_kobo,
              round: r,
              at: new Date(cursor),
            });
          }
        }

        const subtotal = orderRows.reduce(
          (sum, o) => sum + o.qty * o.unitPrice,
          0,
        );
        const service = Math.round((subtotal * servicePct) / 100);
        const tax = Math.round(((subtotal + service) * taxPct) / 100);
        const total = subtotal + service + tax;

        const billedAt = new Date(cursor + intBetween(20, 70) * 60000);
        const paidAt = new Date(billedAt.getTime() + intBetween(2, 15) * 60000);

        const tabRes: { id: string }[] = await ds.query(
          `INSERT INTO tabs
             (branch_id, table_id, waiter_id, tab_number, customer_name, party_size,
              status, opened_at, billed_at, closed_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$8,$7,$8)
           RETURNING id`,
          [
            branch.id,
            pick(tables).id,
            waiterId,
            `TAB-${dateTag}-${String(i).padStart(3, '0')}`,
            pick(CUSTOMER_NAMES),
            intBetween(1, 6),
            openedAt,
            paidAt,
          ],
        );
        const tabId = tabRes[0].id;

        const values: unknown[] = [];
        const placeholders = orderRows.map((o, idx) => {
          const p = idx * 9;
          values.push(
            tabId,
            o.menuItemId,
            o.qty,
            o.unitPrice,
            o.qty * o.unitPrice,
            o.round,
            waiterId,
            'delivered',
            o.at,
          );
          return `($${p + 1},$${p + 2},$${p + 3},$${p + 4},$${p + 5},$${p + 6},$${p + 7},'serve',$${p + 8},$${p + 8},$${p + 9})`;
        });
        await ds.query(
          `INSERT INTO orders
             (tab_id, menu_item_id, quantity, unit_price_kobo, subtotal_kobo,
              round_number, created_by, fulfillment_type, order_status,
              delivered_at, created_at, updated_at)
           VALUES ${placeholders.join(',')}`,
          values,
        );

        const method = pick(PAYMENT_METHODS);
        await ds.query(
          `INSERT INTO bills
             (tab_id, payment_status, subtotal_kobo, service_charge_kobo,
              discount_kobo, tax_kobo, total_kobo, payment_method,
              payment_reference, payment_amount_kobo, paid_at, issued_by,
              created_at, updated_at)
           VALUES ($1,'paid',$2,$3,0,$4,$5,$6,$7,$5,$8,$9,$10,$8)`,
          [
            tabId,
            subtotal,
            service,
            tax,
            total,
            method,
            method === 'cash' ? null : `HIST-${dateTag}-${i}`,
            paidAt,
            managerId,
            billedAt,
          ],
        );

        totalTabs++;
        totalOrders += orderRows.length;
        revenueKobo += total;
      }
    }

    console.log('[demo-history] Seeding complete:');
    console.log(`  Days: ${DAYS}`);
    console.log(`  Tabs: ${totalTabs}`);
    console.log(`  Orders: ${totalOrders}`);
    console.log(`  Revenue: ₦${(revenueKobo / 100).toLocaleString()}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[demo-history] Seed failed:', err?.message ?? err);
  process.exit(1);
});

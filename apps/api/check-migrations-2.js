const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:2047@localhost:5432/serveiq_test_fresh' });
c.connect().then(async () => {
  const r = await c.query('SELECT count(*)::int AS cnt FROM migrations');
  console.log('Migrations applied:', r.rows[0].cnt);
  const t = await c.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public'");
  console.log('Tables created:', t.rows[0].cnt);
  const r2 = await c.query('SELECT name FROM migrations ORDER BY id');
  r2.rows.forEach(r => console.log('  ' + r.name));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });

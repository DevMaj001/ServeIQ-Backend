const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:2047@localhost:5432/serveiq' });
c.connect().then(async () => {
  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  for (const t of r.rows) { await c.query('DROP TABLE IF EXISTS "' + t.table_name + '" CASCADE'); }
  console.log('Dropped', r.rows.length, 'tables');
  const e = await c.query("SELECT typname FROM pg_type WHERE typnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') AND typtype='e'");
  for (const t of e.rows) { await c.query('DROP TYPE IF EXISTS "' + t.typname + '" CASCADE'); }
  console.log('Dropped', e.rows.length, 'enums');
  await c.end();
}).catch(e => { console.error(e); process.exit(1); });

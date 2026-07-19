const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:2047@localhost:5432/serveiq_test_fresh' });
c.connect().then(async () => {
  const r = await c.query(`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role_id'
  `);
  console.table(r.rows);
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
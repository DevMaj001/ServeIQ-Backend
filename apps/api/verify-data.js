const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:2047@localhost:5432/serveiq_test_fresh' });
c.connect().then(async () => {
  const tables = (await c.query('SELECT table_number,status,capacity FROM tables ORDER BY table_number')).rows;
  console.log('Tables:', JSON.stringify(tables));
  const tabs = (await c.query("SELECT tab_number,customer_name,status FROM tabs")).rows;
  console.log('Tabs:', JSON.stringify(tabs));
  const menu = (await c.query('SELECT name,category,price_kobo FROM menu_items LIMIT 5')).rows;
  console.log('Menu (5):', JSON.stringify(menu));
  const users = (await c.query("SELECT full_name,email,role FROM users")).rows;
  console.log('Users:', JSON.stringify(users, null, 2));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });

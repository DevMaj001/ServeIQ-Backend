const { Client } = require('pg');
const { spawn } = require('child_process');

async function test() {
  const c = new Client({ connectionString: 'postgresql://postgres:2047@localhost:5432/serveiq_test_fresh' });
  await c.connect();
  
  // Check manager permissions
  const r = await c.query(`
    SELECT p.code 
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN roles r ON r.id = rp.role_id
    WHERE r.name = 'Manager'
    ORDER BY p.code
  `);
  console.log('Manager permissions:', r.rows.map(r => r.code).join(', '));
  
  // Check decline permission
  const hasDecline = r.rows.some(p => p.code === 'decline_orders');
  console.log('Has decline_orders:', hasDecline);
  
  // Check mark_delivered
  const hasDeliver = r.rows.some(p => p.code === 'mark_delivered');
  console.log('Has mark_delivered:', hasDeliver);
  
  // Check approve_orders
  const hasApprove = r.rows.some(p => p.code === 'approve_orders');
  console.log('Has approve_orders:', hasApprove);
  
  await c.end();
}

test().catch(e => { console.error(e.message); process.exit(1); });
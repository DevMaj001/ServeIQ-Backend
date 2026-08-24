const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Export it before running this script.');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  const branchId = process.env.SEED_BRANCH_ID || '9069afae-4858-43c2-9172-8f71d8e68bec';
  const openedBy = process.env.SEED_OPENED_BY || 'b7254b6e-4e0b-47e6-a3b4-37eecd5d6d77';
  const openedAt = new Date().toISOString();
  const result = await pool.query(
    "INSERT INTO shifts (id, branch_id, status, opened_at, opened_by) VALUES (gen_random_uuid(), $1, 'open', $2, $3) ON CONFLICT DO NOTHING RETURNING id",
    [branchId, openedAt, openedBy]
  );
  console.log('Shift created:', JSON.stringify(result.rows));
  await pool.end();
})();

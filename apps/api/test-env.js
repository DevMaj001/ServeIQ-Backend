const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.jynvpfmduwfqnifuepxn:aJ99ObW0ZcFVgXYM@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const branchId = '9069afae-4858-43c2-9172-8f71d8e68bec';
  // Open a shift for the branch
  const openedAt = new Date().toISOString();
  const result = await pool.query(
    "INSERT INTO shifts (id, branch_id, status, opened_at, opened_by) VALUES (gen_random_uuid(), $1, 'open', $2, $3) ON CONFLICT DO NOTHING RETURNING id",
    [branchId, openedAt, 'b7254b6e-4e0b-47e6-a3b4-37eecd5d6d77']
  );
  console.log('Shift created:', JSON.stringify(result.rows));
  await pool.end();
})();
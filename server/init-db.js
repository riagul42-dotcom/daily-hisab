require('dotenv').config();
const { pool } = require('./db');
const { ensureDatabase } = require('./bootstrap');

async function main() {
  await ensureDatabase();
  const counts = await pool.query(
    `SELECT (SELECT count(*) FROM users)::int AS users,
            (SELECT count(*) FROM expenses)::int AS expenses`
  );
  console.log(`ℹ ব্যবহারকারী: ${counts.rows[0].users}, খরচের রেকর্ড: ${counts.rows[0].expenses}`);
  await pool.end();
}

main().catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});

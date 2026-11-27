require('dotenv').config();
const { Pool } = require('pg');

const isLocal = (url) => /localhost|127\.0\.0\.1/.test(url);
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@127.0.0.1:5433/daily_hisab';

const useSsl =
  !isLocal(connectionString) &&
  (process.env.PGSSL !== 'false');

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = { pool, connectionString };

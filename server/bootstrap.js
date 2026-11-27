const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function ensureDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_users BOOLEAN NOT NULL DEFAULT false'
  );

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM users');
  if (rows[0].c > 0) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@dailyhisab.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'সুপার অ্যাডমিন';

  if (!password) {
    console.warn('⚠ কোনো ব্যবহারকারী নেই এবং ADMIN_PASSWORD সেট করা হয়নি — অ্যাডমিন তৈরি হয়নি');
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, account_type)
     VALUES ($1, $2, $3, 'superadmin', 'family')`,
    [name, email, hash]
  );
  console.log('✔ সুপার অ্যাডমিন তৈরি হয়েছে:', email);
}

module.exports = { ensureDatabase };

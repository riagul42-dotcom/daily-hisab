// ডেমো ডেটা: ব্যবহারকারী ও গত ১২ মাসের নমুনা খরচ (ঐচ্ছিক)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../server/db');

const USERS = [
  { name: 'রফিক ম্যানেজার', email: 'manager@dailyhisab.com', password: 'Manager@123', role: 'manager', accountType: 'business' },
  { name: 'সুমন কর্মচারী', email: 'employee@dailyhisab.com', password: 'Employee@123', role: 'employee', accountType: 'business' },
  { name: 'করিম পরিবার', email: 'family@dailyhisab.com', password: 'Family@123', role: 'family', accountType: 'family' },
];

const FAMILY_ITEMS = [
  ['আলু', 'কেজি', 28, 42], ['পেঁয়াজ', 'কেজি', 45, 70], ['চাল', 'কেজি', 62, 78],
  ['ডাল', 'কেজি', 110, 150], ['সয়াবিন তেল', 'লিটার', 160, 185], ['রুই মাছ', 'কেজি', 280, 380],
  ['মুরগি', 'কেজি', 170, 210], ['ডিম', 'হালি', 42, 52], ['দুধ', 'লিটার', 70, 90],
  ['টমেটো', 'কেজি', 40, 80], ['কাঁচা মরিচ', 'কেজি', 80, 160], ['গ্যাস সিলিন্ডার', 'সিলিন্ডার', 1350, 1450],
  ['সাবান', 'পিস', 35, 60], ['শ্যাম্পু', 'পিস', 110, 180], ['মাস্ক', 'প্যাকেট', 100, 150],
];
const BUSINESS_ITEMS = [
  ['মোবাইল কভার', 'পিস', 80, 150], ['চার্জার', 'পিস', 350, 550], ['প্যাকেজিং বক্স', 'পিস', 12, 25],
  ['কুরিয়ার চার্জ', 'চালান', 80, 160], ['দোকান ভাড়া', 'মাস', 8000, 9000], ['বিদ্যুৎ বিল', 'বিল', 1200, 2200],
  ['ইন্টারনেট বিল', 'বিল', 800, 1100], ['স্টাফ বেতন', 'জন', 9000, 12000],
];

const rand = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function ensureUser(u) {
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [u.email]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const hash = await bcrypt.hash(u.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, account_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [u.name, u.email, hash, u.role, u.accountType]
  );
  console.log('✔ তৈরি:', u.email);
  return rows[0].id;
}

async function seed() {
  const counts = await pool.query('SELECT count(*)::int AS c FROM expenses');
  if (counts.rows[0].c > 0) {
    console.log('ℹ খরচের ডেটা আগেই আছে, ডেমো সিড বাদ দেওয়া হলো');
    await pool.end();
    return;
  }

  const familyId = await ensureUser(USERS[2]);
  const employeeId = await ensureUser(USERS[1]);
  await ensureUser(USERS[0]);

  const today = new Date();
  const records = [];

  for (let m = 11; m >= 0; m -= 1) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const maxDay = m === 0 ? today.getDate() : daysInMonth;

    for (let i = 0; i < 9; i += 1) {
      const [name, unit, lo, hi] = pick(FAMILY_ITEMS);
      const qty = Math.max(0.5, Math.round(rand(1, 4) * 2) / 2);
      const price = rand(lo, hi);
      const d = new Date(base.getFullYear(), base.getMonth(), Math.max(1, Math.floor(rand(1, maxDay))));
      records.push([familyId, 'family', 'বাজার/মুদি', name, qty, unit, price,
        Math.round(qty * price * 100) / 100, iso(d), null]);
    }

    for (let i = 0; i < 3; i += 1) {
      const [name, unit, lo, hi] = pick(BUSINESS_ITEMS);
      const qty = Math.max(1, Math.round(rand(1, 6)));
      const price = rand(lo, hi);
      const d = new Date(base.getFullYear(), base.getMonth(), Math.max(1, Math.floor(rand(1, maxDay))));
      records.push([employeeId, 'business', 'ব্যবসার পণ্য', name, qty, unit, price,
        Math.round(qty * price * 100) / 100, iso(d), null]);
    }
  }

  for (const r of records) {
    await pool.query(
      `INSERT INTO expenses (user_id, scope, category, item_name, quantity, unit, unit_price, total, expense_date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      r
    );
  }
  console.log(`✔ ${records.length} টি ডেমো খরচ যোগ হয়েছে`);
  await pool.end();
}

seed().catch(async (err) => {
  console.error('ডেমো সিড ব্যর্থ:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});

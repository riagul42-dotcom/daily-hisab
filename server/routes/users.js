const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../auth');

const router = express.Router();

const ROLES = ['superadmin', 'manager', 'employee', 'family'];
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const canCreateUsers = (user) =>
  Boolean(user && (user.role === 'superadmin' || user.can_create_users));

function requireUserCreator(req, res, next) {
  if (!canCreateUsers(req.user)) {
    return res.status(403).json({ error: 'নতুন আইডি খোলার অনুমতি নেই' });
  }
  next();
}

router.use(authenticate);

// নাম বাছাইয়ের তালিকা — সব লগইন করা ব্যবহারকারী দেখতে পারবে
router.get('/options', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM users WHERE status = 'active' ORDER BY name ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireRole('superadmin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.account_type, u.status,
              u.can_create_users, u.created_at,
              (SELECT count(*) FROM expenses e WHERE e.user_id = u.id) AS expense_count
       FROM users u
       ORDER BY u.created_at ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireUserCreator, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim() || null;
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'employee');
    const accountType = String(req.body.account_type || 'business');

    if (name.length < 2) return res.status(400).json({ error: 'নাম লিখুন' });
    if (!isEmail(email)) return res.status(400).json({ error: 'সঠিক ইমেইল দিন' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' });
    }
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'ভূমিকা সঠিক নয়' });
    if (req.user.role !== 'superadmin' && !['family', 'employee'].includes(role)) {
      return res.status(403).json({ error: 'শুধু পারিবারিক বা কর্মচারী অ্যাকাউন্ট তৈরি করার অনুমতি আছে' });
    }
    if (!['family', 'business'].includes(accountType)) {
      return res.status(400).json({ error: 'অ্যাকাউন্টের ধরন সঠিক নয়' });
    }
    const finalType = role === 'family' ? 'family' : accountType;

    const exists = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, account_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, account_type, status, can_create_users, created_at`,
      [name, email, phone, hash, role, finalType]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ভুল আইডি' });

    const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });

    const updates = [];
    const values = [];
    let i = 1;

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2) return res.status(400).json({ error: 'নাম লিখুন' });
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (req.body.phone !== undefined) {
      updates.push(`phone = $${i++}`);
      values.push(String(req.body.phone).trim() || null);
    }
    if (req.body.role !== undefined) {
      if (!ROLES.includes(req.body.role)) {
        return res.status(400).json({ error: 'ভূমিকা সঠিক নয়' });
      }
      if (id === req.user.id && req.body.role !== 'superadmin') {
        return res.status(400).json({ error: 'নিজের সুপার অ্যাডমিন ভূমিকা বদলানো যাবে না' });
      }
      updates.push(`role = $${i++}`);
      values.push(req.body.role);
    }
    if (req.body.account_type !== undefined) {
      if (!['family', 'business'].includes(req.body.account_type)) {
        return res.status(400).json({ error: 'অ্যাকাউন্টের ধরন সঠিক নয়' });
      }
      updates.push(`account_type = $${i++}`);
      values.push(req.body.account_type);
    }
    if (req.body.status !== undefined) {
      if (!['active', 'inactive'].includes(req.body.status)) {
        return res.status(400).json({ error: 'স্ট্যাটাস সঠিক নয়' });
      }
      if (id === req.user.id && req.body.status !== 'active') {
        return res.status(400).json({ error: 'নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না' });
      }
      updates.push(`status = $${i++}`);
      values.push(req.body.status);
    }
    if (req.body.can_create_users !== undefined) {
      updates.push(`can_create_users = $${i++}`);
      values.push(Boolean(req.body.can_create_users));
    }
    if (req.body.password !== undefined) {
      const password = String(req.body.password);
      if (password.length < 8) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' });
      }
      updates.push(`password_hash = $${i++}`);
      values.push(await bcrypt.hash(password, 12));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'পরিবর্তনের কিছু নেই' });
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
       RETURNING id, name, email, phone, role, account_type, status, can_create_users, created_at`,
      values
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

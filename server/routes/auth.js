const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  authenticate,
} = require('../auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন' },
});

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'ইমেইল ও পাসওয়ার্ড দিন' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' });
    }

    setAuthCookie(res, signToken(user));
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        account_type: user.account_type,
        can_create_users: user.can_create_users,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim() || null;
    const password = String(req.body.password || '');

    if (name.length < 2) return res.status(400).json({ error: 'নাম লিখুন' });
    if (!isEmail(email)) return res.status(400).json({ error: 'সঠিক ইমেইল দিন' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' });
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, account_type)
       VALUES ($1, $2, $3, $4, 'family', 'family')
       RETURNING id, name, email, phone, role, account_type`,
      [name, email, phone, hash]
    );

    const user = rows[0];
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

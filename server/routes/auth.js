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

// নতুন আইডি শুধু অ্যাডমিন/অনুমতিপ্রাপ্ত ব্যবহারকারী খুলতে পারবেন (users রুটে)
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'নিজে থেকে নিবন্ধন বন্ধ আছে; অ্যাডমিনের সাথে যোগাযোগ করুন' });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const COOKIE_NAME = 'dh_token';
const TOKEN_TTL = '7d';

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'dev-only-insecure-secret';
}

function signToken(user) {
  return jwt.sign(
    { uid: user.id, role: user.role },
    jwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

async function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'লগইন প্রয়োজন' });

    const payload = jwt.verify(token, jwtSecret());
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, role, account_type, status, can_create_users FROM users WHERE id = $1',
      [payload.uid]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'অ্যাকাউন্ট পাওয়া যায়নি' });
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন' });
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'এই কাজের অনুমতি নেই' });
    }
    next();
  };
}

const canViewAll = (user) =>
  user && (user.role === 'superadmin' || user.role === 'manager');

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  authenticate,
  requireRole,
  canViewAll,
};

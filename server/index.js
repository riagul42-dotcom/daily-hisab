require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { pool } = require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT count(*)::int AS users FROM users');
    res.json({ ok: true, users: rows[0].users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API পাওয়া যায়নি' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন' });
});

const port = Number(process.env.PORT || 3000);
const { ensureDatabase } = require('./bootstrap');

ensureDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Daily Hisab server: http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('ডেটাবেস প্রস্তুত করা যায়নি:', err.message);
    process.exit(1);
  });

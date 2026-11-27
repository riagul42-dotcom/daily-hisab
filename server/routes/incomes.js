const express = require('express');
const { pool } = require('../db');
const { authenticate, canViewAll } = require('../auth');

const router = express.Router();

const CATEGORIES = [
  'বেতন',
  'ব্যবসার আয়',
  'বিক্রয়',
  'ভাড়া',
  'উপহার',
  'বোনাস',
  'ফেরত পাওয়া',
  'অন্যান্য',
];

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function parseIncome(body) {
  const scope = body.scope === 'business' ? 'business' : 'family';
  const category = String(body.category || '').trim().slice(0, 60) || 'অন্যান্য';
  const source = String(body.source || '').trim().slice(0, 200);
  const amount = Number(body.amount);
  const incomeDate = String(body.income_date || '');
  const note = String(body.note || '').trim().slice(0, 500) || null;

  if (!source) return { error: 'আয়ের উৎস লিখুন' };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'টাকার পরিমাণ সঠিকভাবে লিখুন' };
  }
  if (!isDate(incomeDate)) return { error: 'তারিখ সঠিকভাবে দিন' };

  const rounded = Math.round(amount * 100) / 100;
  return { value: { scope, category, source, amount: rounded, incomeDate, note } };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { from, to, scope, q, page = '1', limit = '20', user_id } = req.query;
    const where = [];
    const values = [];
    let i = 1;

    if (!canViewAll(req.user)) {
      where.push(`i.user_id = $${i++}`);
      values.push(req.user.id);
      if (req.user.role === 'family') {
        where.push(`i.scope = 'family'`);
      }
    } else if (user_id) {
      where.push(`i.user_id = $${i++}`);
      values.push(Number(user_id));
    }

    if (from) {
      if (!isDate(from)) return res.status(400).json({ error: 'শুরুর তারিখ ভুল' });
      where.push(`i.income_date >= $${i++}`);
      values.push(from);
    }
    if (to) {
      if (!isDate(to)) return res.status(400).json({ error: 'শেষ তারিখ ভুল' });
      where.push(`i.income_date <= $${i++}`);
      values.push(to);
    }
    if (scope === 'family' || scope === 'business') {
      where.push(`i.scope = $${i++}`);
      values.push(scope);
    }
    if (q) {
      const like = `%${String(q).trim()}%`;
      where.push(`(i.source ILIKE $${i} OR i.category ILIKE $${i} OR i.note ILIKE $${i})`);
      values.push(like);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = pool.query(
      `SELECT count(*)::int AS total, coalesce(sum(i.amount), 0)::float AS sum
       FROM incomes i ${whereSql}`,
      values
    );
    const listValues = [...values, limitNum, offset];
    const listQuery = pool.query(
      `SELECT i.id, i.user_id, u.name AS user_name, i.scope, i.category, i.source,
              i.amount::float, to_char(i.income_date, 'YYYY-MM-DD') AS income_date,
              i.note, i.created_at
       FROM incomes i
       JOIN users u ON u.id = i.user_id
       ${whereSql}
       ORDER BY i.income_date DESC, i.id DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      listValues
    );

    const [countRes, listRes] = await Promise.all([countQuery, listQuery]);
    res.json({
      incomes: listRes.rows,
      total: countRes.rows[0].total,
      sum: countRes.rows[0].sum,
      page: pageNum,
      limit: limitNum,
      categories: CATEGORIES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = parseIncome(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    let v = parsed.value;
    if (req.user.role === 'family') v = { ...v, scope: 'family' };

    const { rows } = await pool.query(
      `INSERT INTO incomes (user_id, scope, category, source, amount, income_date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, scope, category, source, amount::float,
                 to_char(income_date, 'YYYY-MM-DD') AS income_date, note`,
      [req.user.id, v.scope, v.category, v.source, v.amount, v.incomeDate, v.note]
    );
    res.status(201).json({ income: rows[0] });
  } catch (err) {
    next(err);
  }
});

async function loadOwned(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'ভুল আইডি' });
    return null;
  }
  const { rows } = await pool.query('SELECT * FROM incomes WHERE id = $1', [id]);
  const income = rows[0];
  if (!income) {
    res.status(404).json({ error: 'রেকর্ড পাওয়া যায়নি' });
    return null;
  }
  const allowed = canViewAll(req.user) || income.user_id === req.user.id;
  if (!allowed) {
    res.status(403).json({ error: 'এই রেকর্ডে পরিবর্তনের অনুমতি নেই' });
    return null;
  }
  return income;
}

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwned(req, res);
    if (!existing) return;

    const parsed = parseIncome(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    let v = parsed.value;
    if (req.user.role === 'family') v = { ...v, scope: 'family' };

    const { rows } = await pool.query(
      `UPDATE incomes SET
         scope = $1, category = $2, source = $3, amount = $4,
         income_date = $5, note = $6, updated_at = now()
       WHERE id = $7
       RETURNING id, user_id, scope, category, source, amount::float,
                 to_char(income_date, 'YYYY-MM-DD') AS income_date, note`,
      [v.scope, v.category, v.source, v.amount, v.incomeDate, v.note, existing.id]
    );
    res.json({ income: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwned(req, res);
    if (!existing) return;
    await pool.query('DELETE FROM incomes WHERE id = $1', [existing.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
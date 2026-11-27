const express = require('express');
const { pool } = require('../db');
const { authenticate, canViewAll } = require('../auth');

const router = express.Router();

const CATEGORIES = [
  'বাজার/মুদি',
  'সবজি',
  'মাছ',
  'মাংস',
  'ফলমূল',
  'দুধ ও ডিম',
  'রান্নার গ্যাস',
  'বিদ্যুৎ/বিল',
  'যাতায়াত',
  'চিকিৎসা',
  'শিক্ষা',
  'পোশাক',
  'ব্যবসার পণ্য',
  'কাঁচামাল',
  'পরিবহন',
  'অন্যান্য',
];

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function parseExpense(body) {
  const scope = body.scope === 'business' ? 'business' : 'family';
  const category = String(body.category || '').trim().slice(0, 60) || 'অন্যান্য';
  const itemName = String(body.item_name || '').trim().slice(0, 200);
  const unit = String(body.unit || 'পিস').trim().slice(0, 30) || 'পিস';
  const quantity = Number(body.quantity);
  const unitPrice = Number(body.unit_price);
  const expenseDate = String(body.expense_date || '');
  const note = String(body.note || '').trim().slice(0, 500) || null;

  if (!itemName) return { error: 'পণ্যের নাম লিখুন' };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'পরিমাণ সঠিকভাবে লিখুন' };
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: 'একক মূল্য সঠিকভাবে লিখুন' };
  }
  if (!isDate(expenseDate)) return { error: 'তারিখ সঠিকভাবে দিন' };

  const total = Math.round(quantity * unitPrice * 100) / 100;
  return {
    value: { scope, category, itemName, unit, quantity, unitPrice, expenseDate, note, total },
  };
}

// সারাংশ ও তালিকা — ভূমিকা অনুযায়ী দেখা যাবে
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { from, to, scope, q, page = '1', limit = '20', user_id } = req.query;
    const where = [];
    const values = [];
    let i = 1;

    if (!canViewAll(req.user)) {
      where.push(`e.user_id = $${i++}`);
      values.push(req.user.id);
      if (req.user.role === 'family') {
        where.push(`e.scope = 'family'`);
      }
    } else if (user_id) {
      where.push(`e.user_id = $${i++}`);
      values.push(Number(user_id));
    }

    if (from) {
      if (!isDate(from)) return res.status(400).json({ error: 'শুরুর তারিখ ভুল' });
      where.push(`e.expense_date >= $${i++}`);
      values.push(from);
    }
    if (to) {
      if (!isDate(to)) return res.status(400).json({ error: 'শেষ তারিখ ভুল' });
      where.push(`e.expense_date <= $${i++}`);
      values.push(to);
    }
    if (scope === 'family' || scope === 'business') {
      where.push(`e.scope = $${i++}`);
      values.push(scope);
    }
    if (q) {
      const like = `%${String(q).trim()}%`;
      where.push(`(e.item_name ILIKE $${i} OR e.category ILIKE $${i} OR e.note ILIKE $${i})`);
      values.push(like);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = pool.query(
      `SELECT count(*)::int AS total, coalesce(sum(e.total), 0)::float AS sum
       FROM expenses e ${whereSql}`,
      values
    );
    const listValues = [...values, limitNum, offset];
    const listQuery = pool.query(
      `SELECT e.id, e.user_id, u.name AS user_name, e.scope, e.category, e.item_name,
              e.quantity::float, e.unit, e.unit_price::float, e.total::float,
              to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date, e.note, e.created_at
       FROM expenses e
       JOIN users u ON u.id = e.user_id
       ${whereSql}
       ORDER BY e.expense_date DESC, e.id DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      listValues
    );

    const [countRes, listRes] = await Promise.all([countQuery, listQuery]);
    res.json({
      expenses: listRes.rows,
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

// আগে ব্যবহৃত পণ্যের নাম — ফর্মে অটো-সাজেশনের জন্য
router.get('/items', authenticate, async (req, res, next) => {
  try {
    const where = [];
    const values = [];
    let i = 1;
    if (!canViewAll(req.user)) {
      where.push(`e.user_id = $${i++}`);
      values.push(req.user.id);
      if (req.user.role === 'family') where.push(`e.scope = 'family'`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT e.item_name AS name, count(*)::int AS uses, max(e.id) AS last_id
       FROM expenses e ${whereSql}
       GROUP BY e.item_name
       ORDER BY uses DESC, last_id DESC
       LIMIT 300`,
      values
    );
    res.json({ items: rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = parseExpense(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    let v = parsed.value;
    if (req.user.role === 'family') v = { ...v, scope: 'family' };

    const { rows } = await pool.query(
      `INSERT INTO expenses
         (user_id, scope, category, item_name, quantity, unit, unit_price, total, expense_date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, scope, category, item_name, quantity::float, unit, unit_price::float,
                 total::float, to_char(expense_date, 'YYYY-MM-DD') AS expense_date, note`,
      [req.user.id, v.scope, v.category, v.itemName, v.quantity, v.unit,
        v.unitPrice, v.total, v.expenseDate, v.note]
    );
    res.status(201).json({ expense: rows[0] });
  } catch (err) {
    next(err);
  }
});

// একসাথে অনেক হিসাব — সবগুলো এক ট্রানজেকশনে সংরক্ষণ হয়
router.post('/bulk', authenticate, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ error: 'অন্তত একটি হিসাব দিন' });
    if (items.length > 100) {
      return res.status(400).json({ error: 'একবারে সর্বোচ্চ ১০০টি হিসাব দেওয়া যাবে' });
    }

    const values = [];
    for (let index = 0; index < items.length; index++) {
      const parsed = parseExpense(items[index]);
      if (parsed.error) {
        return res.status(400).json({ error: `সারি ${index + 1}: ${parsed.error}` });
      }
      values.push(req.user.role === 'family' ? { ...parsed.value, scope: 'family' } : parsed.value);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const v of values) {
        const { rows } = await client.query(
          `INSERT INTO expenses
             (user_id, scope, category, item_name, quantity, unit, unit_price, total, expense_date, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, scope, category, item_name, quantity::float, unit, unit_price::float,
                     total::float, to_char(expense_date, 'YYYY-MM-DD') AS expense_date, note`,
          [req.user.id, v.scope, v.category, v.itemName, v.quantity, v.unit,
            v.unitPrice, v.total, v.expenseDate, v.note]
        );
        created.push(rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json({ expenses: created, count: created.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
  const { rows } = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
  const expense = rows[0];
  if (!expense) {
    res.status(404).json({ error: 'রেকর্ড পাওয়া যায়নি' });
    return null;
  }
  const allowed =
    canViewAll(req.user) ||
    expense.user_id === req.user.id;
  if (!allowed) {
    res.status(403).json({ error: 'এই রেকর্ডে পরিবর্তনের অনুমতি নেই' });
    return null;
  }
  return expense;
}

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwned(req, res);
    if (!existing) return;

    const parsed = parseExpense(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    let v = parsed.value;
    if (req.user.role === 'family') v = { ...v, scope: 'family' };

    const { rows } = await pool.query(
      `UPDATE expenses SET
         scope = $1, category = $2, item_name = $3, quantity = $4, unit = $5,
         unit_price = $6, total = $7, expense_date = $8, note = $9, updated_at = now()
       WHERE id = $10
       RETURNING id, user_id, scope, category, item_name, quantity::float, unit, unit_price::float,
                 total::float, to_char(expense_date, 'YYYY-MM-DD') AS expense_date, note`,
      [v.scope, v.category, v.itemName, v.quantity, v.unit,
        v.unitPrice, v.total, v.expenseDate, v.note, existing.id]
    );
    res.json({ expense: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await loadOwned(req, res);
    if (!existing) return;
    await pool.query('DELETE FROM expenses WHERE id = $1', [existing.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;

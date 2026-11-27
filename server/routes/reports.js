const express = require('express');
const { pool } = require('../db');
const { authenticate, canViewAll } = require('../auth');

const router = express.Router();

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function buildFilters(req) {
  const { from, to, scope, user_id } = req.query;
  const where = [];
  const values = [];
  let i = 1;

  if (!canViewAll(req.user)) {
    where.push(`e.user_id = $${i++}`);
    values.push(req.user.id);
    if (req.user.role === 'family') where.push(`e.scope = 'family'`);
  } else if (user_id) {
    where.push(`e.user_id = $${i++}`);
    values.push(Number(user_id));
  }
  if (from) {
    where.push(`e.expense_date >= $${i++}`);
    values.push(from);
  }
  if (to) {
    where.push(`e.expense_date <= $${i++}`);
    values.push(to);
  }
  if (scope === 'family' || scope === 'business') {
    where.push(`e.scope = $${i++}`);
    values.push(scope);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values, nextIndex: i };
}

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !isDate(from)) return res.status(400).json({ error: 'শুরুর তারিখ ভুল' });
    if (to && !isDate(to)) return res.status(400).json({ error: 'শেষ তারিখ ভুল' });

    const { whereSql, values, nextIndex } = buildFilters(req);

    const totalsPromise = pool.query(
      `SELECT count(*)::int AS count,
              coalesce(sum(e.total), 0)::float AS total,
              coalesce(avg(e.total), 0)::float AS avg_record
       FROM expenses e ${whereSql}`,
      values
    );

    const byCategoryPromise = pool.query(
      `SELECT category, sum(e.total)::float AS total, count(*)::int AS count
       FROM expenses e ${whereSql}
       GROUP BY category ORDER BY total DESC`,
      values
    );

    const byScopePromise = pool.query(
      `SELECT e.scope, sum(e.total)::float AS total, count(*)::int AS count
       FROM expenses e ${whereSql}
       GROUP BY e.scope`,
      values
    );

    const byMonthPromise = pool.query(
      `SELECT to_char(e.expense_date, 'YYYY-MM') AS month,
              sum(e.total)::float AS total, count(*)::int AS count
       FROM expenses e ${whereSql}
       GROUP BY 1 ORDER BY 1`,
      values
    );

    const byDayPromise = pool.query(
      `SELECT to_char(e.expense_date, 'YYYY-MM-DD') AS date,
              sum(e.total)::float AS total, count(*)::int AS count
       FROM expenses e ${whereSql}
       GROUP BY 1 ORDER BY 1`,
      values
    );

    let byUserPromise = Promise.resolve({ rows: [] });
    if (canViewAll(req.user)) {
      byUserPromise = pool.query(
        `SELECT e.user_id, u.name AS user_name, sum(e.total)::float AS total, count(*)::int AS count
         FROM expenses e JOIN users u ON u.id = e.user_id ${whereSql}
         GROUP BY e.user_id, u.name ORDER BY total DESC LIMIT 50`,
        values
      );
    }

    const [totals, byCategory, byScope, byMonth, byDay, byUser] = await Promise.all([
      totalsPromise, byCategoryPromise, byScopePromise, byMonthPromise, byDayPromise, byUserPromise,
    ]);

    const days = byDay.rows.length;
    res.json({
      total: totals.rows[0].total,
      count: totals.rows[0].count,
      avgRecord: totals.rows[0].avg_record,
      avgPerDay: days ? Math.round((totals.rows[0].total / days) * 100) / 100 : 0,
      byCategory: byCategory.rows,
      byScope: byScope.rows,
      byMonth: byMonth.rows,
      byDay: byDay.rows,
      byUser: byUser.rows,
      nextIndex,
    });
  } catch (err) {
    next(err);
  }
});

// ড্যাশবোর্ড চার্ট: শেষ N মাসের খরচ (ফাঁকা মাস ০ হিসেবে)
router.get('/monthly', authenticate, async (req, res, next) => {
  try {
    const months = Math.min(36, Math.max(1, parseInt(req.query.months, 10) || 12));
    const scope = req.query.scope;
    const where = [];
    const values = [];
    let i = 1;

    if (!canViewAll(req.user)) {
      where.push(`e.user_id = $${i++}`);
      values.push(req.user.id);
      if (req.user.role === 'family') where.push(`e.scope = 'family'`);
    }
    if (scope === 'family' || scope === 'business') {
      where.push(`e.scope = $${i++}`);
      values.push(scope);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `WITH months AS (
         SELECT to_char(gs, 'YYYY-MM') AS month
         FROM generate_series(
           date_trunc('month', now()) - make_interval(months => $${i} - 1),
           date_trunc('month', now()),
           interval '1 month'
         ) AS gs
       )
       SELECT m.month,
              coalesce(sum(e.total), 0)::float AS total,
              count(e.id)::int AS count
       FROM months m
       LEFT JOIN expenses e
         ON to_char(e.expense_date, 'YYYY-MM') = m.month ${whereSql ? 'AND ' + whereSql.replace('WHERE ', '') : ''}
       GROUP BY m.month
       ORDER BY m.month`,
      [...values, months]
    );
    res.json({ months: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

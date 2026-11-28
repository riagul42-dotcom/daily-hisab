const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/contacts', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role,
              lm.body AS last_body,
              lm.created_at AS last_at,
              lm.sender_id AS last_sender_id,
              COALESCE(un.cnt, 0)::int AS unread
       FROM users u
       LEFT JOIN LATERAL (
         SELECT m.body, m.created_at, m.sender_id
         FROM messages m
         WHERE (m.sender_id = u.id AND m.recipient_id = $1)
            OR (m.sender_id = $1 AND m.recipient_id = u.id)
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS cnt
         FROM messages m
         WHERE m.sender_id = u.id AND m.recipient_id = $1 AND m.read_at IS NULL
       ) un ON true
       WHERE u.id <> $1 AND u.status = 'active'
       ORDER BY lm.created_at DESC NULLS LAST, u.name ASC`,
      [req.user.id]
    );

    const { rows: lastGroup } = await pool.query(
      `SELECT g.body AS last_body, g.created_at AS last_at,
              g.sender_id AS last_sender_id, u.name AS last_sender_name
       FROM group_messages g
       JOIN users u ON u.id = g.sender_id
       ORDER BY g.id DESC
       LIMIT 1`
    );
    const { rows: groupUnread } = await pool.query(
      `SELECT count(*)::int AS unread
       FROM group_messages g
       WHERE g.sender_id <> $1
         AND g.id > COALESCE(
           (SELECT last_read_id FROM group_reads WHERE user_id = $1), 0)`,
      [req.user.id]
    );
    const group = { ...(lastGroup[0] || {}), unread: groupUnread[0].unread };

    res.json({ contacts: rows, group });
  } catch (err) {
    next(err);
  }
});

router.get('/unread', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM messages WHERE recipient_id = $1 AND read_at IS NULL) AS direct,
         (SELECT count(*)::int FROM group_messages g
          WHERE g.sender_id <> $1
            AND g.id > COALESCE(
              (SELECT last_read_id FROM group_reads WHERE user_id = $1), 0)) AS grp`,
      [req.user.id]
    );
    const { direct, grp } = rows[0];
    res.json({ unread: direct, group: grp, total: direct + grp });
  } catch (err) {
    next(err);
  }
});

router.get('/group', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.sender_id, g.body, g.created_at, u.name AS sender_name
       FROM (
         SELECT id, sender_id, body, created_at
         FROM group_messages
         ORDER BY id DESC
         LIMIT 100
       ) g
       JOIN users u ON u.id = g.sender_id
       ORDER BY g.id ASC`
    );

    await pool.query(
      `INSERT INTO group_reads (user_id, last_read_id)
       VALUES ($1, COALESCE((SELECT max(id) FROM group_messages), 0))
       ON CONFLICT (user_id) DO UPDATE SET last_read_id = EXCLUDED.last_read_id
       WHERE group_reads.last_read_id < EXCLUDED.last_read_id`,
      [req.user.id]
    );

    res.json({ messages: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/group', async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'বার্তা লিখুন' });
    if (body.length > 2000) {
      return res.status(400).json({ error: 'বার্তা ২০০০ অক্ষরের মধ্যে দিন' });
    }

    const { rows } = await pool.query(
      `INSERT INTO group_messages (sender_id, body)
       VALUES ($1, $2)
       RETURNING id, sender_id, body, created_at`,
      [req.user.id, body]
    );
    res.status(201).json({ message: { ...rows[0], sender_name: req.user.name } });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const otherId = Number(req.params.userId);
    if (!Number.isInteger(otherId)) return res.status(400).json({ error: 'ভুল ব্যবহারকারী' });
    const { rows: users } = await pool.query(
      "SELECT id, name FROM users WHERE id = $1 AND status = 'active'",
      [otherId]
    );
    if (!users[0]) return res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });

    const { rows } = await pool.query(
      `SELECT id, sender_id, recipient_id, body, created_at, read_at
       FROM (
         SELECT id, sender_id, recipient_id, body, created_at, read_at
         FROM messages
         WHERE (sender_id = $1 AND recipient_id = $2)
            OR (sender_id = $2 AND recipient_id = $1)
         ORDER BY id DESC
         LIMIT 100
       ) recent
       ORDER BY id ASC`,
      [req.user.id, otherId]
    );

    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [otherId, req.user.id]
    );

    res.json({ contact: users[0], messages: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const recipientId = Number(req.body.recipient_id);
    const body = String(req.body.body || '').trim();
    if (!Number.isInteger(recipientId) || recipientId === req.user.id) {
      return res.status(400).json({ error: 'প্রাপক সঠিক নয়' });
    }
    if (!body) return res.status(400).json({ error: 'বার্তা লিখুন' });
    if (body.length > 2000) {
      return res.status(400).json({ error: 'বার্তা ২০০০ অক্ষরের মধ্যে দিন' });
    }

    const { rows: users } = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND status = 'active'",
      [recipientId]
    );
    if (!users[0]) return res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });

    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, body, created_at, read_at`,
      [req.user.id, recipientId, body]
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
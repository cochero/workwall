import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, visibilityWhere } from '../middleware/auth.js';

const router = Router();

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT n.*, a.name AS actor_name, p.name AS project_name
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_id
         LEFT JOIN projects p ON p.id = n.project_id
        WHERE n.user_id = ?
        ORDER BY n.id DESC
        LIMIT 30`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await q('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/poll', requireAuth, async (req, res, next) => {
  try {
    const u = req.user;
    const unreadRow = await q('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [u.id]);

    let projIds;
    if (u.role === 'super') {
      projIds = (await q(`SELECT id FROM projects WHERE status = 'active'`)).map(r => r.id);
    } else {
      projIds = (await q('SELECT project_id FROM project_members WHERE user_id = ?', [u.id])).map(r => r.project_id);
    }

    let projects = [];
    if (projIds.length) {
      projects = await q(
        `SELECT po.project_id AS id, COUNT(*) AS unread
           FROM posts po
           LEFT JOIN project_reads pr ON pr.project_id = po.project_id AND pr.user_id = ?
          WHERE po.project_id IN (?) AND po.author_id <> ?
            AND (pr.last_read_at IS NULL OR po.created_at > pr.last_read_at)
            ${visibilityWhere(u, 'po')}
          GROUP BY po.project_id`,
        [u.id, projIds, u.id]
      );
    }

    res.json({ unread_notifications: unreadRow[0].n, projects });
  } catch (err) {
    next(err);
  }
});

export default router;

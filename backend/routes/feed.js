import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, visibilityWhere } from '../middleware/auth.js';

const router = Router();

router.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const u = req.user;
    let projIds;
    if (u.role === 'super') {
      projIds = (await q(`SELECT id FROM projects WHERE status = 'active'`)).map(r => r.id);
    } else {
      projIds = (await q('SELECT project_id FROM project_members WHERE user_id = ?', [u.id])).map(r => r.project_id);
    }
    if (!projIds.length) return res.json({ posts: [] });

    const posts = await q(
      `SELECT po.*, a.name AS author_name, a.role AS author_role, a.avatar_color AS author_color,
              p.name AS project_name, p.type AS project_type, c.name AS client_name,
              (SELECT COUNT(*) FROM comments cm WHERE cm.parent_type = 'post' AND cm.parent_id = po.id) AS comment_count
         FROM posts po
         JOIN projects p ON p.id = po.project_id
         JOIN clients c ON c.id = p.client_id
         JOIN users a ON a.id = po.author_id
        WHERE po.project_id IN (?) ${visibilityWhere(u, 'po')}
        ORDER BY po.id DESC
        LIMIT 30`,
      [projIds]
    );

    const ids = posts.map(p => p.id);
    let files = [];
    if (ids.length) {
      files = await q(`SELECT f.* FROM files f WHERE f.post_id IN (?)${visibilityWhere(u, 'f')}`, [ids]);
    }

    res.json({ posts: posts.map(p => ({ ...p, files: files.filter(f => f.post_id === p.id) })) });
  } catch (err) {
    next(err);
  }
});

export default router;

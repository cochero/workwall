import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireSuper, requireProjectAccess, visibilityWhere } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { logActivity } from '../lib/activity.js';

const TYPES = ['social', 'apar', 'dev', 'general'];
const router = Router();

router.use(requireAuth);

router.get('/mine', async (req, res, next) => {
  try {
    const u = req.user;
    const baseSelect = `SELECT p.id, p.name, p.type, p.status, p.client_id, c.name AS client_name
                          FROM projects p
                          JOIN clients c ON c.id = p.client_id`;
    let projects;
    if (u.role === 'super') {
      projects = await q(`${baseSelect} WHERE p.status = 'active' ORDER BY c.name, p.name`);
    } else {
      projects = await q(
        `${baseSelect}
          JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
         WHERE p.status = 'active'
         ORDER BY c.name, p.name`,
        [u.id]
      );
    }

    const ids = projects.map(p => p.id);
    let unread = {};
    if (ids.length) {
      const rows = await q(
        `SELECT po.project_id, COUNT(*) AS n
           FROM posts po
           LEFT JOIN project_reads pr ON pr.project_id = po.project_id AND pr.user_id = ?
          WHERE po.project_id IN (?) AND po.author_id <> ?
            AND (pr.last_read_at IS NULL OR po.created_at > pr.last_read_at)
            ${visibilityWhere(u, 'po')}
          GROUP BY po.project_id`,
        [u.id, ids, u.id]
      );
      unread = Object.fromEntries(rows.map(r => [r.project_id, r.n]));
    }

    res.json({ projects: projects.map(p => ({ ...p, unread: unread[p.id] || 0 })) });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireSuper, async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT p.*, c.name AS client_name,
              (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
         FROM projects p
         JOIN clients c ON c.id = p.client_id
        ORDER BY p.status, c.name, p.name`
    );
    res.json({ projects: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireSuper, async (req, res, next) => {
  try {
    const { client_id, name, type, description } = req.body || {};
    if (!client_id || !name || !String(name).trim()) return res.status(400).json({ error: 'Client and project name required' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Bad project type' });
    const client = await q('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (!client.length) return res.status(404).json({ error: 'Client not found' });
    const r = await q(
      'INSERT INTO projects (client_id, name, type, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [client_id, String(name).trim(), type, description || null, req.user.id]
    );
    logActivity(req.user.id, r.insertId, 'project_create');
    res.json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', requireProjectAccess(), async (req, res, next) => {
  try {
    const p = await q(
      `SELECT p.*, c.name AS client_name
         FROM projects p
         JOIN clients c ON c.id = p.client_id
        WHERE p.id = ?`,
      [req.projectId]
    );
    if (!p.length) return res.status(404).json({ error: 'Project not found' });
    const members = await q(
      `SELECT pm.user_id, pm.role AS member_role, u.name, u.email, u.role AS user_role, u.avatar_color
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY pm.role, u.name`,
      [req.projectId]
    );
    res.json({ project: p[0], members, my_role: req.membership.role, my_user_role: req.user.role });
  } catch (err) {
    next(err);
  }
});

router.put('/:projectId', requireSuper, async (req, res, next) => {
  try {
    const id = Number(req.params.projectId);
    const rows = await q('SELECT * FROM projects WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    const p = rows[0];
    const name = req.body.name !== undefined ? String(req.body.name).trim() : p.name;
    const type = req.body.type !== undefined ? req.body.type : p.type;
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Bad project type' });
    const status = req.body.status !== undefined ? req.body.status : p.status;
    if (!['active', 'archived'].includes(status)) return res.status(400).json({ error: 'Bad status' });
    const description = req.body.description !== undefined ? req.body.description : p.description;
    const clientId = req.body.client_id !== undefined ? req.body.client_id : p.client_id;
    await q(
      'UPDATE projects SET name = ?, type = ?, status = ?, description = ?, client_id = ? WHERE id = ?',
      [name, type, status, description, clientId, id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:projectId/read', requireProjectAccess(), async (req, res, next) => {
  try {
    await q(
      `INSERT INTO project_reads (project_id, user_id, last_read_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
      [req.projectId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:projectId/members', requireSuper, async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    const proj = await q('SELECT id, name, client_id FROM projects WHERE id = ?', [projectId]);
    if (!proj.length) return res.status(404).json({ error: 'Project not found' });
    const { user_id } = req.body || {};
    const target = await q('SELECT id, role, client_id, is_active FROM users WHERE id = ?', [user_id]);
    if (!target.length) return res.status(404).json({ error: 'User not found' });
    if (!target[0].is_active) return res.status(400).json({ error: 'User is deactivated' });

    let memberRole = req.body.role;
    if (target[0].role === 'client') {
      if (target[0].client_id !== proj[0].client_id) {
        return res.status(400).json({ error: 'This client user belongs to a different client' });
      }
      memberRole = 'client';
    } else if (!['lead', 'member'].includes(memberRole)) {
      memberRole = 'member';
    }

    await q('INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, user_id, memberRole]);
    notify([user_id], {
      actorId: req.user.id, type: 'member_added', projectId,
      refType: 'project', refId: projectId, preview: `You were added to ${proj[0].name}`
    });
    logActivity(req.user.id, projectId, 'member_add', 'user', user_id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId/members/:userId', requireSuper, async (req, res, next) => {
  try {
    await q('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [
      Number(req.params.projectId), Number(req.params.userId)
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

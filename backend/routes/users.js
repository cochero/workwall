import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { requireAuth, requireSuper } from '../middleware/auth.js';

const router = Router();
const COLORS = ['#7C3AED', '#0D9488', '#DB2777', '#D97706', '#2563EB', '#DC2626'];
const ROLES = ['super', 'team', 'client'];

router.use(requireAuth, requireSuper);

router.get('/', async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT u.id, u.name, u.email, u.role, u.client_id, u.is_active, u.last_login_at, u.avatar_color,
              c.name AS client_name
         FROM users u
         LEFT JOIN clients c ON c.id = u.client_id
        ORDER BY FIELD(u.role, 'super', 'team', 'client'), u.name`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/assignable', async (req, res, next) => {
  try {
    const projectId = Number(req.query.project_id);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });
    const proj = await q('SELECT client_id FROM projects WHERE id = ?', [projectId]);
    if (!proj.length) return res.status(404).json({ error: 'Project not found' });
    const rows = await q(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_color
         FROM users u
        WHERE u.is_active = 1
          AND (u.role = 'team' OR (u.role = 'client' AND u.client_id = ?))
          AND u.id NOT IN (SELECT user_id FROM project_members WHERE project_id = ?)
        ORDER BY u.role, u.name`,
      [proj[0].client_id, projectId]
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, role, client_id, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Bad role' });
    if (role === 'client' && !client_id) return res.status(400).json({ error: 'Client users must be linked to a client' });
    const hash = await bcrypt.hash(String(password), 10);
    const color = COLORS[String(email).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
    const r = await q(
      'INSERT INTO users (name, email, password_hash, role, client_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
      [String(name).trim(), String(email).trim().toLowerCase(), hash, role, role === 'client' ? client_id : null, color]
    );
    res.json({ id: r.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A user with this email already exists' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id && (req.body.role !== undefined || req.body.is_active !== undefined)) {
      return res.status(400).json({ error: 'You cannot change your own role or active status' });
    }
    const rows = await q('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    const name = req.body.name !== undefined ? String(req.body.name).trim() : u.name;
    const role = req.body.role !== undefined ? req.body.role : u.role;
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Bad role' });
    const clientId = role === 'client' ? (req.body.client_id !== undefined ? req.body.client_id : u.client_id) : null;
    if (role === 'client' && !clientId) return res.status(400).json({ error: 'Client users must be linked to a client' });
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : u.is_active;
    await q('UPDATE users SET name = ?, role = ?, client_id = ?, is_active = ? WHERE id = ?', [name, role, clientId, isActive, id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(String(password), 10);
    const r = await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, Number(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

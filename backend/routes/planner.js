import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireProjectAccess, getMembership, visibilityWhere } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

function isTeam(user) { return user.role !== 'client'; }

async function loadTaskAccess(taskId, user) {
  const rows = await q('SELECT * FROM planner_tasks WHERE id = ?', [Number(taskId)]);
  if (!rows.length) return { notFound: true };
  const task = rows[0];
  const membership = await getMembership(task.project_id, user);
  if (!membership) return null;
  if (user.role === 'client' && task.visibility !== 'client') return null;
  return { task, membership };
}

function accessError(res, acc) {
  if (acc && acc.notFound) return res.status(404).json({ error: 'Task not found' });
  return res.status(403).json({ error: 'No access' });
}

function fmtDate(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

router.get('/projects/:projectId/planner', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    const tasks = await q(
      `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color
         FROM planner_tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.project_id = ? ${visibilityWhere(req.user, 't')}
        ORDER BY t.position, t.id`,
      [req.projectId]
    );
    const ids = tasks.map(t => t.id);
    let deps = [];
    if (ids.length) {
      deps = await q('SELECT task_id, depends_on FROM planner_deps WHERE task_id IN (?)', [ids]);
    }
    res.json({
      tasks: tasks.map(t => ({
        ...t,
        start_date: fmtDate(t.start_date),
        end_date: fmtDate(t.end_date),
        deps: deps.filter(d => d.task_id === t.id).map(d => d.depends_on)
      }))
    });
  } catch (err) { next(err); }
});

router.post('/projects/:projectId/planner/tasks', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can create tasks' });
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!b.start_date || !b.end_date) return res.status(400).json({ error: 'Start and end dates are required' });
    const vis = b.visibility === 'client' ? 'client' : 'internal';
    const posRow = await q('SELECT COALESCE(MAX(position),0)+1 AS p FROM planner_tasks WHERE project_id = ?', [req.projectId]);
    const r = await q(
      `INSERT INTO planner_tasks (project_id, title, start_date, end_date, progress, color, assignee_id, visibility, position, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.projectId, title, b.start_date, b.end_date, Number(b.progress) || 0, b.color || null, b.assignee_id || null, vis, posRow[0].p, req.user.id]
    );
    const id = r.insertId;
    if (Array.isArray(b.deps) && b.deps.length) {
      await Promise.all(b.deps.map(dep =>
        q('INSERT IGNORE INTO planner_deps (task_id, depends_on) VALUES (?, ?)', [id, Number(dep)])
      ));
    }
    logActivity(req.user.id, req.projectId, 'planner_create', 'planner_task', id);
    const [row] = await q(
      `SELECT t.*, u.name AS assignee_name, u.avatar_color AS assignee_color
         FROM planner_tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`,
      [id]
    );
    const depRows = await q('SELECT depends_on FROM planner_deps WHERE task_id = ?', [id]);
    res.json({ task: { ...row, start_date: fmtDate(row.start_date), end_date: fmtDate(row.end_date), deps: depRows.map(d => d.depends_on) } });
  } catch (err) { next(err); }
});

router.patch('/planner/tasks/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadTaskAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can edit tasks' });
    const task = acc.task;
    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : task.title;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const start_date = b.start_date !== undefined ? b.start_date : fmtDate(task.start_date);
    const end_date = b.end_date !== undefined ? b.end_date : fmtDate(task.end_date);
    const progress = b.progress !== undefined ? Math.max(0, Math.min(100, Number(b.progress))) : task.progress;
    const color = b.color !== undefined ? (b.color || null) : task.color;
    const assignee_id = b.assignee_id !== undefined ? (b.assignee_id || null) : task.assignee_id;
    const visibility = b.visibility !== undefined ? (b.visibility === 'client' ? 'client' : 'internal') : task.visibility;
    await q(
      `UPDATE planner_tasks SET title=?, start_date=?, end_date=?, progress=?, color=?, assignee_id=?, visibility=? WHERE id=?`,
      [title, start_date, end_date, progress, color, assignee_id, visibility, task.id]
    );
    if (Array.isArray(b.deps)) {
      await q('DELETE FROM planner_deps WHERE task_id = ?', [task.id]);
      if (b.deps.length) {
        await Promise.all(b.deps.map(dep =>
          q('INSERT IGNORE INTO planner_deps (task_id, depends_on) VALUES (?, ?)', [task.id, Number(dep)])
        ));
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/planner/tasks/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadTaskAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can delete tasks' });
    await q('DELETE FROM planner_tasks WHERE id = ?', [acc.task.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;

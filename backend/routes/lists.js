import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireProjectAccess, getMembership, visibilityWhere } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

// Resolve a list + the caller's access to it. Returns { list, membership }, { notFound: true }, or null (no access).
async function loadListAccess(listId, user) {
  const rows = await q('SELECT * FROM lists WHERE id = ?', [Number(listId)]);
  if (!rows.length) return { notFound: true };
  const list = rows[0];
  const membership = await getMembership(list.project_id, user);
  if (!membership) return null;
  if (user.role === 'client' && list.visibility !== 'client') return null;
  return { list, membership };
}

function isTeam(user) {
  return user.role !== 'client';
}

function accessError(res, acc) {
  if (acc && acc.notFound) return res.status(404).json({ error: 'List not found' });
  return res.status(403).json({ error: 'No access' });
}

router.get('/projects/:projectId/lists', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    const u = req.user;
    const lists = await q(
      `SELECT l.* FROM lists l WHERE l.project_id = ? ${visibilityWhere(u, 'l')} ORDER BY l.position, l.id`,
      [req.projectId]
    );
    const ids = lists.map(l => l.id);
    let items = [];
    if (ids.length) {
      items = await q(
        `SELECT i.*, a.name AS assignee_name, a.avatar_color AS assignee_color
           FROM list_items i
           LEFT JOIN users a ON a.id = i.assignee_id
          WHERE i.list_id IN (?)
          ORDER BY i.done, i.position, i.id`,
        [ids]
      );
    }
    res.json({
      lists: lists.map(l => ({ ...l, items: items.filter(i => i.list_id === l.id) }))
    });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/lists', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can create lists' });
    const title = String((req.body && req.body.title) || '').trim();
    if (!title) return res.status(400).json({ error: 'List title is required' });
    const visibility = req.body.visibility === 'client' ? 'client' : 'internal';
    const posRow = await q('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM lists WHERE project_id = ?', [req.projectId]);
    const r = await q(
      'INSERT INTO lists (project_id, title, position, visibility, created_by) VALUES (?, ?, ?, ?, ?)',
      [req.projectId, title, posRow[0].p, visibility, req.user.id]
    );
    logActivity(req.user.id, req.projectId, 'list_create', 'list', r.insertId);
    res.json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch('/lists/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadListAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can edit lists' });
    const l = acc.list;
    const title = req.body.title !== undefined ? String(req.body.title).trim() : l.title;
    if (!title) return res.status(400).json({ error: 'List title is required' });
    const visibility = req.body.visibility !== undefined ? (req.body.visibility === 'client' ? 'client' : 'internal') : l.visibility;
    await q('UPDATE lists SET title = ?, visibility = ? WHERE id = ?', [title, visibility, l.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/lists/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadListAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can delete lists' });
    await q('DELETE FROM lists WHERE id = ?', [acc.list.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function notifyAssignee(assigneeId, text, list, actor) {
  if (!assigneeId || assigneeId === actor.id) return;
  await notify([assigneeId], {
    actorId: actor.id, type: 'assign', projectId: list.project_id,
    refType: 'list', refId: list.id, preview: `Assigned to you: ${text}`.slice(0, 140)
  });
}

router.post('/lists/:id/items', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadListAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    const list = acc.list;
    const text = String((req.body && req.body.text) || '').trim();
    if (!text) return res.status(400).json({ error: 'Item text is required' });
    const assigneeId = req.body.assignee_id ? Number(req.body.assignee_id) : null;
    const dueDate = req.body.due_date || null;
    const posRow = await q('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM list_items WHERE list_id = ?', [list.id]);
    const r = await q(
      'INSERT INTO list_items (list_id, text, position, assignee_id, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [list.id, text, posRow[0].p, assigneeId, dueDate, req.user.id]
    );
    if (assigneeId) await notifyAssignee(assigneeId, text, list, req.user);
    const out = await q(
      `SELECT i.*, a.name AS assignee_name, a.avatar_color AS assignee_color
         FROM list_items i LEFT JOIN users a ON a.id = i.assignee_id WHERE i.id = ?`,
      [r.insertId]
    );
    res.json({ item: out[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/list-items/:id', requireAuth, async (req, res, next) => {
  try {
    const rows = await q('SELECT * FROM list_items WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    const item = rows[0];
    const acc = await loadListAccess(item.list_id, req.user);
    if (!acc || acc.notFound) return res.status(403).json({ error: 'No access' });

    const text = req.body.text !== undefined ? String(req.body.text).trim() : item.text;
    if (!text) return res.status(400).json({ error: 'Item text is required' });
    const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : item.done;
    const assigneeId = req.body.assignee_id !== undefined ? (req.body.assignee_id ? Number(req.body.assignee_id) : null) : item.assignee_id;
    const dueDate = req.body.due_date !== undefined ? (req.body.due_date || null) : item.due_date;
    const doneAt = done && !item.done ? new Date().toISOString().slice(0, 19).replace('T', ' ') : done ? item.done_at : null;

    await q(
      'UPDATE list_items SET text = ?, done = ?, assignee_id = ?, due_date = ?, done_at = ? WHERE id = ?',
      [text, done, assigneeId, dueDate, doneAt, item.id]
    );
    if (assigneeId && assigneeId !== item.assignee_id) {
      await notifyAssignee(assigneeId, text, acc.list, req.user);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/list-items/:id', requireAuth, async (req, res, next) => {
  try {
    const rows = await q('SELECT * FROM list_items WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    const acc = await loadListAccess(rows[0].list_id, req.user);
    if (!acc || acc.notFound) return res.status(403).json({ error: 'No access' });
    await q('DELETE FROM list_items WHERE id = ?', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

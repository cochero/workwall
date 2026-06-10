import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, getMembership } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';

const router = Router();

async function loadParent(parentType, parentId) {
  if (parentType === 'post') {
    const rows = await q('SELECT id, project_id, author_id, visibility FROM posts WHERE id = ?', [parentId]);
    return rows.length ? { ...rows[0], owner_id: rows[0].author_id } : null;
  }
  if (parentType === 'file') {
    const rows = await q('SELECT id, project_id, uploader_id, visibility FROM files WHERE id = ?', [parentId]);
    return rows.length ? { ...rows[0], owner_id: rows[0].uploader_id } : null;
  }
  return null;
}

router.post('/comments', requireAuth, async (req, res, next) => {
  try {
    const { parent_type, parent_id, body } = req.body || {};
    const text = String(body || '').trim();
    if (!text) return res.status(400).json({ error: 'Comment cannot be empty' });
    if (!['post', 'file'].includes(parent_type)) return res.status(400).json({ error: 'Bad parent type' });

    const parent = await loadParent(parent_type, Number(parent_id));
    if (!parent) return res.status(404).json({ error: 'Not found' });
    const membership = await getMembership(parent.project_id, req.user);
    if (!membership) return res.status(403).json({ error: 'No access' });
    if (req.user.role === 'client' && parent.visibility !== 'client') return res.status(403).json({ error: 'No access' });

    const r = await q(
      'INSERT INTO comments (parent_type, parent_id, author_id, body) VALUES (?, ?, ?, ?)',
      [parent_type, parent.id, req.user.id, text]
    );

    const participants = await q(
      'SELECT DISTINCT author_id FROM comments WHERE parent_type = ? AND parent_id = ?',
      [parent_type, parent.id]
    );
    const recipients = new Set(participants.map(p => p.author_id));
    recipients.add(parent.owner_id);
    await notify([...recipients], {
      actorId: req.user.id, type: 'comment', projectId: parent.project_id,
      refType: parent_type, refId: parent.id, preview: text.slice(0, 140)
    });

    const out = await q(
      `SELECT cm.*, a.name AS author_name, a.role AS author_role, a.avatar_color AS author_color
         FROM comments cm
         JOIN users a ON a.id = cm.author_id
        WHERE cm.id = ?`,
      [r.insertId]
    );
    res.json({ comment: out[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/comments/:id', requireAuth, async (req, res, next) => {
  try {
    const rows = await q('SELECT * FROM comments WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].author_id !== req.user.id && req.user.role !== 'super') {
      return res.status(403).json({ error: 'Only the author or an admin can delete a comment' });
    }
    await q('DELETE FROM comments WHERE id = ?', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

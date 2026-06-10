import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireProjectAccess, getMembership, visibilityWhere } from '../middleware/auth.js';
import { makeKey, putObject, categoryFor } from '../lib/storage.js';
import { memberIdsFor, notify } from '../lib/notify.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10 }
});

router.get('/projects/:projectId/posts', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    const u = req.user;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const posts = await q(
      `SELECT po.*, a.name AS author_name, a.role AS author_role, a.avatar_color AS author_color
         FROM posts po
         JOIN users a ON a.id = po.author_id
        WHERE po.project_id = ? ${visibilityWhere(u, 'po')}
        ORDER BY po.pinned DESC, po.id DESC
        LIMIT ${limit}`,
      [req.projectId]
    );

    const ids = posts.map(p => p.id);
    let files = [];
    let comments = [];
    if (ids.length) {
      files = await q(
        `SELECT f.*, uu.name AS uploader_name
           FROM files f
           JOIN users uu ON uu.id = f.uploader_id
          WHERE f.post_id IN (?)${visibilityWhere(u, 'f')}`,
        [ids]
      );
      comments = await q(
        `SELECT cm.*, a.name AS author_name, a.role AS author_role, a.avatar_color AS author_color
           FROM comments cm
           JOIN users a ON a.id = cm.author_id
          WHERE cm.parent_type = 'post' AND cm.parent_id IN (?)
          ORDER BY cm.id`,
        [ids]
      );
    }

    const fileIds = files.map(f => f.id);
    let fcCounts = {};
    if (fileIds.length) {
      const rows = await q(
        `SELECT parent_id, COUNT(*) AS n FROM comments WHERE parent_type = 'file' AND parent_id IN (?) GROUP BY parent_id`,
        [fileIds]
      );
      fcCounts = Object.fromEntries(rows.map(r => [r.parent_id, r.n]));
    }

    res.json({
      posts: posts.map(p => ({
        ...p,
        files: files.filter(f => f.post_id === p.id).map(f => ({ ...f, comment_count: fcCounts[f.id] || 0 })),
        comments: comments.filter(c => c.parent_id === p.id)
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/posts', requireAuth, requireProjectAccess(), upload.array('files', 10), async (req, res, next) => {
  try {
    const u = req.user;
    const body = String((req.body && req.body.body) || '').trim();
    const attachments = req.files || [];
    if (!body && !attachments.length) return res.status(400).json({ error: 'Write something or attach a file' });

    let visibility = req.body.visibility === 'client' ? 'client' : 'internal';
    if (u.role === 'client') visibility = 'client';

    const r = await q(
      'INSERT INTO posts (project_id, author_id, body, visibility) VALUES (?, ?, ?, ?)',
      [req.projectId, u.id, body, visibility]
    );
    const postId = r.insertId;

    for (const f of attachments) {
      const key = makeKey(req.projectId, f.originalname);
      await putObject(key, f.buffer, f.mimetype);
      const fr = await q(
        `INSERT INTO files
           (project_id, post_id, uploader_id, original_name, stored_key, mime_type, category, size_bytes, version_no, status, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?)`,
        [req.projectId, postId, u.id, f.originalname, key, f.mimetype, categoryFor(f.originalname, f.mimetype), f.size, visibility]
      );
      await q('UPDATE files SET version_group_id = ? WHERE id = ?', [fr.insertId, fr.insertId]);
    }

    const preview = (body || `Shared ${attachments.length} file(s)`).slice(0, 140);
    const memberIds = await memberIdsFor(req.projectId, { visibility, excludeUserId: u.id });
    let mentioned = [];
    try {
      mentioned = JSON.parse(req.body.mentioned || '[]').map(Number).filter(Boolean);
    } catch {
      mentioned = [];
    }
    mentioned = mentioned.filter(id => memberIds.includes(id));
    await notify(mentioned, { actorId: u.id, type: 'mention', projectId: req.projectId, refType: 'post', refId: postId, preview });
    await notify(memberIds.filter(id => !mentioned.includes(id)), {
      actorId: u.id, type: 'post', projectId: req.projectId, refType: 'post', refId: postId, preview
    });
    logActivity(u.id, req.projectId, 'post_create', 'post', postId);
    res.json({ id: postId });
  } catch (err) {
    next(err);
  }
});

router.patch('/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await q('SELECT * FROM posts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    const post = rows[0];
    const membership = await getMembership(post.project_id, req.user);
    if (!membership) return res.status(403).json({ error: 'No access' });
    if (req.user.role === 'client') return res.status(403).json({ error: 'Team access required' });
    if (req.body.pinned !== undefined) {
      await q('UPDATE posts SET pinned = ? WHERE id = ?', [req.body.pinned ? 1 : 0, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await q('SELECT * FROM posts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    const post = rows[0];
    if (post.author_id !== req.user.id && req.user.role !== 'super') {
      return res.status(403).json({ error: 'Only the author or an admin can delete a post' });
    }
    await q("DELETE FROM comments WHERE parent_type = 'post' AND parent_id = ?", [id]);
    await q('UPDATE files SET post_id = NULL WHERE post_id = ?', [id]);
    await q('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireProjectAccess, getMembership, visibilityWhere } from '../middleware/auth.js';
import { makeKey, putObject, presignedGetUrl, localPath, deleteObject, categoryFor, driverName } from '../lib/storage.js';
import { memberIdsFor, notify } from '../lib/notify.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 10 }
});
const STATUSES = ['draft', 'review', 'approved', 'final'];
const CATEGORIES = ['image', 'pdf', 'doc', 'sheet', 'other'];

router.get('/projects/:projectId/files', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    const u = req.user;
    const params = [req.projectId, req.projectId];
    let extra = '';
    if (req.query.category && CATEGORIES.includes(req.query.category)) {
      extra += ' AND f.category = ?';
      params.push(req.query.category);
    }
    if (req.query.status && STATUSES.includes(req.query.status)) {
      extra += ' AND f.status = ?';
      params.push(req.query.status);
    }
    if (req.query.search) {
      extra += ' AND f.original_name LIKE ?';
      params.push(`%${String(req.query.search).slice(0, 80)}%`);
    }
    const rows = await q(
      `SELECT f.*, uu.name AS uploader_name,
              (SELECT COUNT(*) FROM comments cm WHERE cm.parent_type = 'file' AND cm.parent_id = f.id) AS comment_count,
              (SELECT COUNT(*) FROM files v WHERE v.version_group_id = f.version_group_id) AS version_count
         FROM files f
         JOIN users uu ON uu.id = f.uploader_id
         JOIN (SELECT version_group_id, MAX(version_no) AS mv
                 FROM files
                WHERE project_id = ?
                GROUP BY version_group_id) g
           ON g.version_group_id = f.version_group_id AND f.version_no = g.mv
        WHERE f.project_id = ? ${visibilityWhere(u, 'f')}${extra}
        ORDER BY f.id DESC`,
      params
    );
    res.json({ files: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/files', requireAuth, requireProjectAccess(), upload.array('files', 10), async (req, res, next) => {
  try {
    const u = req.user;
    const attachments = req.files || [];
    if (!attachments.length) return res.status(400).json({ error: 'No files attached' });
    let visibility = req.body.visibility === 'client' ? 'client' : 'internal';
    if (u.role === 'client') visibility = 'client';

    const created = [];
    for (const f of attachments) {
      const key = makeKey(req.projectId, f.originalname);
      await putObject(key, f.buffer, f.mimetype);
      const fr = await q(
        `INSERT INTO files
           (project_id, uploader_id, original_name, stored_key, mime_type, category, size_bytes, version_no, status, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?)`,
        [req.projectId, u.id, f.originalname, key, f.mimetype, categoryFor(f.originalname, f.mimetype), f.size, visibility]
      );
      await q('UPDATE files SET version_group_id = ? WHERE id = ?', [fr.insertId, fr.insertId]);
      created.push(fr.insertId);
      logActivity(u.id, req.projectId, 'file_upload', 'file', fr.insertId, { name: f.originalname });
    }

    const memberIds = await memberIdsFor(req.projectId, { visibility, excludeUserId: u.id });
    await notify(memberIds, {
      actorId: u.id, type: 'file', projectId: req.projectId,
      refType: 'file', refId: created[0], preview: `Uploaded ${attachments.length} file(s) to the library`
    });
    res.json({ ids: created });
  } catch (err) {
    next(err);
  }
});

async function loadFileWithAccess(req, res) {
  const id = Number(req.params.id);
  const rows = await q('SELECT * FROM files WHERE id = ?', [id]);
  if (!rows.length) {
    res.status(404).json({ error: 'File not found' });
    return null;
  }
  const file = rows[0];
  const membership = await getMembership(file.project_id, req.user);
  if (!membership) {
    res.status(403).json({ error: 'No access' });
    return null;
  }
  if (req.user.role === 'client' && file.visibility !== 'client') {
    res.status(403).json({ error: 'No access' });
    return null;
  }
  return file;
}

router.get('/files/:id', requireAuth, async (req, res, next) => {
  try {
    const file = await loadFileWithAccess(req, res);
    if (!file) return;
    const versions = await q(
      `SELECT f.id, f.version_no, f.original_name, f.size_bytes, f.status, f.created_at, u.name AS uploader_name
         FROM files f
         JOIN users u ON u.id = f.uploader_id
        WHERE f.version_group_id = ?
        ORDER BY f.version_no DESC`,
      [file.version_group_id]
    );
    const comments = await q(
      `SELECT cm.*, a.name AS author_name, a.role AS author_role, a.avatar_color AS author_color
         FROM comments cm
         JOIN users a ON a.id = cm.author_id
        WHERE cm.parent_type = 'file' AND cm.parent_id = ?
        ORDER BY cm.id`,
      [file.id]
    );
    const uploader = await q('SELECT name FROM users WHERE id = ?', [file.uploader_id]);
    res.json({ file: { ...file, uploader_name: uploader[0] ? uploader[0].name : '' }, versions, comments });
  } catch (err) {
    next(err);
  }
});

router.post('/files/:id/version', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const file = await loadFileWithAccess(req, res);
    if (!file) return;
    if (!req.file) return res.status(400).json({ error: 'No file attached' });

    const maxRow = await q('SELECT MAX(version_no) AS mv FROM files WHERE version_group_id = ?', [file.version_group_id]);
    const nextVersion = (maxRow[0].mv || 1) + 1;
    const key = makeKey(file.project_id, req.file.originalname);
    await putObject(key, req.file.buffer, req.file.mimetype);
    const fr = await q(
      `INSERT INTO files
         (project_id, post_id, uploader_id, original_name, stored_key, mime_type, category, size_bytes, version_group_id, version_no, status, visibility)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?)`,
      [file.project_id, req.user.id, req.file.originalname, key, req.file.mimetype,
       categoryFor(req.file.originalname, req.file.mimetype), req.file.size,
       file.version_group_id, nextVersion, file.visibility]
    );

    const memberIds = await memberIdsFor(file.project_id, { visibility: file.visibility, excludeUserId: req.user.id });
    await notify(memberIds, {
      actorId: req.user.id, type: 'file_version', projectId: file.project_id,
      refType: 'file', refId: fr.insertId, preview: `New version v${nextVersion} of ${req.file.originalname}`
    });
    logActivity(req.user.id, file.project_id, 'file_version', 'file', fr.insertId, { version: nextVersion });
    res.json({ id: fr.insertId, version_no: nextVersion });
  } catch (err) {
    next(err);
  }
});

router.patch('/files/:id', requireAuth, async (req, res, next) => {
  try {
    const file = await loadFileWithAccess(req, res);
    if (!file) return;
    if (req.user.role === 'client') return res.status(403).json({ error: 'Team access required' });
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
    await q('UPDATE files SET status = ? WHERE id = ?', [status, file.id]);
    logActivity(req.user.id, file.project_id, 'file_status', 'file', file.id, { from: file.status, to: status });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/files/:id/download', requireAuth, async (req, res, next) => {
  try {
    const file = await loadFileWithAccess(req, res);
    if (!file) return;
    const inline = req.query.inline === '1';
    logActivity(req.user.id, file.project_id, 'file_download', 'file', file.id);
    if (driverName === 's3') {
      const url = await presignedGetUrl(file.stored_key, file.original_name, inline);
      return res.redirect(url);
    }
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.original_name)}"`);
    res.sendFile(localPath(file.stored_key));
  } catch (err) {
    next(err);
  }
});

router.delete('/files/:id', requireAuth, async (req, res, next) => {
  try {
    const file = await loadFileWithAccess(req, res);
    if (!file) return;
    if (req.user.role !== 'super') return res.status(403).json({ error: 'Admin access required' });
    await deleteObject(file.stored_key);
    await q("DELETE FROM comments WHERE parent_type = 'file' AND parent_id = ?", [file.id]);
    await q('DELETE FROM files WHERE id = ?', [file.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

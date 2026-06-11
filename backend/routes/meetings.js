import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireProjectAccess, getMembership, visibilityWhere } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

async function loadMeetingAccess(meetingId, user) {
  const rows = await q('SELECT * FROM meetings WHERE id = ?', [Number(meetingId)]);
  if (!rows.length) return { notFound: true };
  const meeting = rows[0];
  const membership = await getMembership(meeting.project_id, user);
  if (!membership) return null;
  if (user.role === 'client' && meeting.visibility !== 'client') return null;
  return { meeting, membership };
}

function isTeam(user) { return user.role !== 'client'; }

function accessError(res, acc) {
  if (acc && acc.notFound) return res.status(404).json({ error: 'Meeting not found' });
  return res.status(403).json({ error: 'No access' });
}

async function loadAttendees(meetingIds) {
  if (!meetingIds.length) return [];
  return q(
    `SELECT ma.meeting_id, u.id AS user_id, u.name, u.avatar_color
       FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id
      WHERE ma.meeting_id IN (?)`,
    [meetingIds]
  );
}

router.get('/projects/:projectId/meetings', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    const meetings = await q(
      `SELECT * FROM meetings WHERE project_id = ? ${visibilityWhere(req.user)} ORDER BY meeting_at ASC`,
      [req.projectId]
    );
    const attendees = await loadAttendees(meetings.map(m => m.id));
    res.json({
      meetings: meetings.map(m => ({
        ...m,
        attendees: attendees.filter(a => a.meeting_id === m.id)
      }))
    });
  } catch (err) { next(err); }
});

router.post('/projects/:projectId/meetings', requireAuth, requireProjectAccess(), async (req, res, next) => {
  try {
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can create meetings' });
    const { title, meeting_at, duration_min, link, location_text, agenda, visibility, attendees } = req.body || {};
    const t = String(title || '').trim();
    if (!t) return res.status(400).json({ error: 'Title is required' });
    if (!meeting_at) return res.status(400).json({ error: 'Date/time is required' });
    const vis = visibility === 'client' ? 'client' : 'internal';
    const r = await q(
      `INSERT INTO meetings (project_id, title, meeting_at, duration_min, link, location_text, agenda, visibility, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.projectId, t, meeting_at, duration_min || null, link || null, location_text || null, agenda || null, vis, req.user.id]
    );
    const id = r.insertId;
    if (Array.isArray(attendees) && attendees.length) {
      await Promise.all(attendees.map(uid =>
        q('INSERT IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)', [id, Number(uid)])
      ));
      const toNotify = attendees.map(Number).filter(uid => uid !== req.user.id);
      if (toNotify.length) {
        await notify(toNotify, {
          actorId: req.user.id, type: 'meeting', projectId: req.projectId,
          refType: 'meeting', refId: id, preview: `Meeting: ${t}`.slice(0, 140)
        });
      }
    }
    logActivity(req.user.id, req.projectId, 'meeting_create', 'meeting', id);
    const atts = await loadAttendees([id]);
    const [row] = await q('SELECT * FROM meetings WHERE id = ?', [id]);
    res.json({ meeting: { ...row, attendees: atts } });
  } catch (err) { next(err); }
});

router.patch('/meetings/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadMeetingAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can edit meetings' });
    const m = acc.meeting;
    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : m.title;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const meeting_at = b.meeting_at !== undefined ? b.meeting_at : m.meeting_at;
    const duration_min = b.duration_min !== undefined ? (b.duration_min || null) : m.duration_min;
    const link = b.link !== undefined ? (b.link || null) : m.link;
    const location_text = b.location_text !== undefined ? (b.location_text || null) : m.location_text;
    const agenda = b.agenda !== undefined ? (b.agenda || null) : m.agenda;
    const visibility = b.visibility !== undefined ? (b.visibility === 'client' ? 'client' : 'internal') : m.visibility;
    await q(
      `UPDATE meetings SET title=?, meeting_at=?, duration_min=?, link=?, location_text=?, agenda=?, visibility=? WHERE id=?`,
      [title, meeting_at, duration_min, link, location_text, agenda, visibility, m.id]
    );
    if (Array.isArray(b.attendees)) {
      await q('DELETE FROM meeting_attendees WHERE meeting_id = ?', [m.id]);
      if (b.attendees.length) {
        await Promise.all(b.attendees.map(uid =>
          q('INSERT IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)', [m.id, Number(uid)])
        ));
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/meetings/:id', requireAuth, async (req, res, next) => {
  try {
    const acc = await loadMeetingAccess(req.params.id, req.user);
    if (!acc || acc.notFound) return accessError(res, acc);
    if (!isTeam(req.user)) return res.status(403).json({ error: 'Only team members can delete meetings' });
    await q('DELETE FROM meetings WHERE id = ?', [acc.meeting.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;

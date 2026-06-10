import { q } from '../db.js';

export async function logActivity(userId, projectId, action, refType = null, refId = null, meta = null) {
  try {
    await q(
      'INSERT INTO activity_log (user_id, project_id, action, ref_type, ref_id, meta) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, projectId, action, refType, refId, meta ? JSON.stringify(meta) : null]
    );
  } catch (err) {
    console.error('activity log failed:', err.message);
  }
}

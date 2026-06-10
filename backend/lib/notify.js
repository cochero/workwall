import { q } from '../db.js';

export async function memberIdsFor(projectId, { visibility = 'internal', excludeUserId = null } = {}) {
  const rows = await q(
    `SELECT pm.user_id, u.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ? AND u.is_active = 1`,
    [projectId]
  );
  return rows
    .filter(r => (visibility === 'client' ? true : r.role !== 'client'))
    .map(r => r.user_id)
    .filter(id => id !== excludeUserId);
}

export async function notify(userIds, { actorId = null, type, projectId = null, refType = null, refId = null, preview = null }) {
  const unique = [...new Set(userIds)].filter(id => id && id !== actorId);
  if (!unique.length) return;
  const values = unique.map(uid => [uid, actorId, type, projectId, refType, refId, preview]);
  await q(
    'INSERT INTO notifications (user_id, actor_id, type, project_id, ref_type, ref_id, preview) VALUES ?',
    [values]
  );
}

import jwt from 'jsonwebtoken';
import { q } from '../db.js';
import { config } from '../config.js';

export const COOKIE_NAME = 'ww_token';

export function signToken(userId) {
  return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Session expired — log in again' });
    }
    const rows = await q(
      'SELECT id, name, email, role, client_id, avatar_color, is_active FROM users WHERE id = ?',
      [payload.uid]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Account inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export function requireSuper(req, res, next) {
  if (req.user.role !== 'super') return res.status(403).json({ error: 'Admin access required' });
  next();
}

export function requireTeam(req, res, next) {
  if (req.user.role === 'client') return res.status(403).json({ error: 'Team access required' });
  next();
}

export async function getMembership(projectId, user) {
  if (user.role === 'super') return { role: 'super', client_id: null };
  const rows = await q(
    `SELECT pm.role, p.client_id
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
      WHERE pm.project_id = ? AND pm.user_id = ?`,
    [projectId, user.id]
  );
  if (!rows.length) return null;
  if (user.role === 'client' && rows[0].client_id !== user.client_id) return null;
  return rows[0];
}

export function requireProjectAccess(param = 'projectId') {
  return async (req, res, next) => {
    try {
      const projectId = Number(req.params[param]);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ error: 'Bad project id' });
      }
      const membership = await getMembership(projectId, req.user);
      if (!membership) return res.status(403).json({ error: 'No access to this project' });
      req.projectId = projectId;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function visibilityWhere(user, alias = '') {
  const col = alias ? `${alias}.visibility` : 'visibility';
  return user.role === 'client' ? ` AND ${col} = 'client'` : '';
}

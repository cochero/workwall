import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';
import { config } from '../config.js';
import { COOKIE_NAME, cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, client_id: u.client_id, avatar_color: u.avatar_color };
}

// Stateless math captcha: the answer is carried in a short-lived signed token,
// so no server-side session storage is needed and it survives restarts.
router.get('/captcha', (req, res) => {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const token = jwt.sign({ s: a + b, k: 'captcha' }, config.jwtSecret, { expiresIn: '5m' });
  res.json({ token, question: `${a} + ${b}` });
});

function captchaOk(token, answer) {
  try {
    const decoded = jwt.verify(String(token || ''), config.jwtSecret);
    return decoded.k === 'captcha' && Number(answer) === decoded.s;
  } catch {
    return false;
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, captcha_token, captcha_answer } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (!captchaOk(captcha_token, captcha_answer)) {
      return res.status(400).json({ error: 'Captcha incorrect or expired — please try the new one' });
    }
    const rows = await q('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const user = rows[0];
    if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    logActivity(user.id, null, 'login');
    res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions());
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current, password } = req.body || {};
    if (!current || !password) return res.status(400).json({ error: 'Both passwords required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const rows = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(String(current), rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(String(password), 10);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

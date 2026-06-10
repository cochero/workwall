import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireSuper } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireSuper);

router.get('/', async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT c.*, COUNT(p.id) AS project_count
         FROM clients c
         LEFT JOIN projects p ON p.client_id = c.id
        GROUP BY c.id
        ORDER BY c.name`
    );
    res.json({ clients: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact_name, contact_email, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Client name required' });
    const r = await q(
      'INSERT INTO clients (name, contact_name, contact_email, phone, notes) VALUES (?, ?, ?, ?, ?)',
      [String(name).trim(), contact_name || null, contact_email || null, phone || null, notes || null]
    );
    res.json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await q('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    const c = rows[0];
    const { name, contact_name, contact_email, phone, notes } = req.body || {};
    await q(
      'UPDATE clients SET name = ?, contact_name = ?, contact_email = ?, phone = ?, notes = ? WHERE id = ?',
      [
        name !== undefined ? String(name).trim() : c.name,
        contact_name !== undefined ? contact_name : c.contact_name,
        contact_email !== undefined ? contact_email : c.contact_email,
        phone !== undefined ? phone : c.phone,
        notes !== undefined ? notes : c.notes,
        id
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const projects = await q('SELECT COUNT(*) AS n FROM projects WHERE client_id = ?', [id]);
    if (projects[0].n > 0) {
      return res.status(409).json({ error: 'Client has projects — archive or delete those first' });
    }
    await q('DELETE FROM clients WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

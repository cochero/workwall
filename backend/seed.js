import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, q } from './db.js';

const demo = process.argv.includes('--demo');
const COLORS = ['#7C3AED', '#0D9488', '#DB2777', '#D97706', '#2563EB', '#DC2626'];
const created = [];

async function ensureUser({ name, email, role, clientId = null, password }, i = 0) {
  const rows = await q('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length) return rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const res = await q(
    'INSERT INTO users (name, email, password_hash, role, client_id, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, hash, role, clientId, COLORS[i % COLORS.length]]
  );
  created.push({ name, email, role, password });
  return res.insertId;
}

async function ensureClient(name, extra = {}) {
  const rows = await q('SELECT id FROM clients WHERE name = ?', [name]);
  if (rows.length) return rows[0].id;
  const res = await q(
    'INSERT INTO clients (name, contact_name, contact_email, phone) VALUES (?, ?, ?, ?)',
    [name, extra.contactName || null, extra.contactEmail || null, extra.phone || null]
  );
  return res.insertId;
}

async function ensureProject({ clientId, name, type, description, createdBy }) {
  const rows = await q('SELECT id FROM projects WHERE client_id = ? AND name = ?', [clientId, name]);
  if (rows.length) return rows[0].id;
  const res = await q(
    'INSERT INTO projects (client_id, name, type, description, created_by) VALUES (?, ?, ?, ?, ?)',
    [clientId, name, type, description || null, createdBy]
  );
  return res.insertId;
}

async function addMember(projectId, userId, role) {
  await q('INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, userId, role]);
}

async function addPost(projectId, authorId, body, visibility, pinned = 0) {
  const res = await q(
    'INSERT INTO posts (project_id, author_id, body, visibility, pinned) VALUES (?, ?, ?, ?, ?)',
    [projectId, authorId, body, visibility, pinned]
  );
  return res.insertId;
}

async function addComment(parentType, parentId, authorId, body) {
  await q(
    'INSERT INTO comments (parent_type, parent_id, author_id, body) VALUES (?, ?, ?, ?)',
    [parentType, parentId, authorId, body]
  );
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(8).toString('base64url');
  const adminId = await ensureUser(
    { name: 'Christopher', email: 'admin@klickevents.in', role: 'super', password: adminPassword },
    0
  );

  if (demo) {
    const priyaId = await ensureUser({ name: 'Priya M.', email: 'priya@klickevents.in', role: 'team', password: 'Demo@1234' }, 1);
    const rahulId = await ensureUser({ name: 'Rahul K.', email: 'rahul@klickevents.in', role: 'team', password: 'Demo@1234' }, 2);

    const sunriseId = await ensureClient('Sunrise Dental', { contactName: 'Meera Nair', contactEmail: 'meera@sunrisedental.in' });
    const greenleafId = await ensureClient('GreenLeaf Traders', { contactName: 'Anand Pillai', contactEmail: 'anand@greenleaftraders.in' });

    const meeraId = await ensureUser(
      { name: 'Meera Nair', email: 'meera@sunrisedental.in', role: 'client', clientId: sunriseId, password: 'Demo@1234' }, 3
    );
    const anandId = await ensureUser(
      { name: 'Anand Pillai', email: 'anand@greenleaftraders.in', role: 'client', clientId: greenleafId, password: 'Demo@1234' }, 4
    );

    const smmId = await ensureProject({
      clientId: sunriseId, name: 'Social media — monthly', type: 'social',
      description: 'Instagram + Facebook management for Sunrise Dental', createdBy: adminId
    });
    const aparId = await ensureProject({
      clientId: greenleafId, name: 'AP/AR processing', type: 'apar',
      description: 'Monthly invoice and receivables processing', createdBy: adminId
    });
    const devId = await ensureProject({
      clientId: sunriseId, name: 'Website revamp', type: 'dev',
      description: 'New marketing website build', createdBy: adminId
    });

    await addMember(smmId, priyaId, 'lead');
    await addMember(smmId, rahulId, 'member');
    await addMember(smmId, meeraId, 'client');
    await addMember(aparId, priyaId, 'lead');
    await addMember(aparId, anandId, 'client');
    await addMember(devId, rahulId, 'lead');
    await addMember(devId, meeraId, 'client');

    const existingPosts = await q('SELECT id FROM posts WHERE project_id = ? LIMIT 1', [smmId]);
    if (!existingPosts.length) {
      await addPost(
        smmId, adminId,
        'Project brief: 12 posts + 8 reels per month. Brand colors and logo pack are in the Files tab. Client approval needed before anything is scheduled.',
        'client', 1
      );
      const p1 = await addPost(
        smmId, priyaId,
        'June content calendar is ready for review. Please check the dates against the clinic holiday list before we send it to the client.',
        'internal'
      );
      await addComment('post', p1, rahulId, 'Looks good. Row for June 15 might clash with the dental camp — double-check.');
      const p2 = await addPost(
        smmId, priyaId,
        'Hi Meera, the June calendar draft is up. Could you confirm the offer dates for the teeth-whitening campaign?',
        'client'
      );
      await addComment('post', p2, meeraId, 'Offer runs June 10-20. Rest looks fine to me.');

      await addPost(
        aparId, priyaId,
        'May cycle closed. June invoices received so far are uploaded to the Files tab — statement reconciliation starts Monday.',
        'client'
      );
      await addPost(
        devId, rahulId,
        'Staging is up. Homepage and services pages done; contact form pending SMTP credentials from the client.',
        'internal'
      );
      console.log('Demo wall posts created.');
    }
  }

  if (created.length) {
    console.log('');
    console.log('=== Seeded accounts (save these now — passwords are hashed and not retrievable later) ===');
    for (const u of created) {
      console.log(`${u.role.padEnd(7)} ${u.email.padEnd(36)} ${u.password}`);
    }
  } else {
    console.log('Nothing to seed — all accounts already exist.');
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

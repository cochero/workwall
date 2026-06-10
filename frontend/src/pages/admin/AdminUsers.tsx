import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { AdminClient, AdminUser, Role } from '../../lib/types';

const ROLE_PILL: Record<Role, string> = {
  super: 'bg-violet-50 text-violet-700 border-violet-200',
  team: 'bg-blue-50 text-blue-700 border-blue-200',
  client: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const ROLE_LABEL: Record<Role, string> = { super: 'Admin', team: 'Team', client: 'Client' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [modal, setModal] = useState<null | { id?: number }>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'team' as Role, client_id: 0, is_active: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/clients')]);
    setUsers(u.users);
    setClients(c.clients);
  }

  useEffect(() => {
    load();
  }, []);

  if (me && me.role !== 'super') return <Navigate to="/feed" replace />;

  function openCreate() {
    setForm({ name: '', email: '', password: '', role: 'team', client_id: 0, is_active: true });
    setModal({});
    setError('');
  }

  function openEdit(u: AdminUser) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, client_id: u.client_id || 0, is_active: !!u.is_active });
    setModal({ id: u.id });
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (modal?.id) {
        await api.put(`/users/${modal.id}`, {
          name: form.name,
          ...(modal.id === me?.id ? {} : { role: form.role, is_active: form.is_active }),
          client_id: form.role === 'client' ? form.client_id || null : null
        });
      } else {
        await api.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          client_id: form.role === 'client' ? form.client_id || null : null
        });
      }
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    if (!resetFor) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/users/${resetFor.id}/reset-password`, { password: resetPw });
      setResetFor(null);
      setResetPw('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-gray-400">Team members and client logins</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} /> Add user
        </button>
      </div>

      {error && !modal && !resetFor && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Last login</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} color={u.avatar_color} px={28} />
                    <div>
                      <p className="font-medium text-gray-800">
                        {u.name} {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_PILL[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{u.client_name || '—'}</td>
                <td className="px-4 py-2.5">
                  {u.is_active ? (
                    <span className="text-xs font-medium text-emerald-600">Active</span>
                  ) : (
                    <span className="text-xs font-medium text-gray-400">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{u.last_login_at ? timeAgo(u.last_login_at) : 'never'}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setResetFor(u);
                      setResetPw('');
                      setError('');
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600"
                    title="Reset password"
                  >
                    <KeyRound size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Edit user' : 'Add user'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Full name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            {!modal.id && (
              <>
                <div>
                  <label className="label">Email *</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password * (min 8 characters)</label>
                  <input className="input" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={form.role}
                  disabled={modal.id === me?.id}
                  onChange={e => setForm({ ...form, role: e.target.value as Role })}
                >
                  <option value="team">Team member</option>
                  <option value="client">Client</option>
                  <option value="super">Admin (super user)</option>
                </select>
              </div>
              {form.role === 'client' && (
                <div>
                  <label className="label">Client company *</label>
                  <select className="input" value={form.client_id} onChange={e => setForm({ ...form, client_id: Number(e.target.value) })}>
                    <option value={0}>Select…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {modal.id && modal.id !== me?.id && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Account active
              </label>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {resetFor && (
        <Modal title={`Reset password — ${resetFor.name}`} onClose={() => setResetFor(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">New password (min 8 characters)</label>
              <input className="input" type="text" value={resetPw} onChange={e => setResetPw(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setResetFor(null)} className="btn-ghost">Cancel</button>
              <button onClick={doReset} disabled={saving || resetPw.length < 8} className="btn-primary">
                {saving ? 'Saving…' : 'Reset password'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

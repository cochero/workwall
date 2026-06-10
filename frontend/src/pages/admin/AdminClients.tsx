import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { AdminClient } from '../../lib/types';

const EMPTY = { name: '', contact_name: '', contact_email: '', phone: '', notes: '' };

export default function AdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [modal, setModal] = useState<null | { id?: number }>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await api.get('/clients');
    setClients(d.clients);
  }

  useEffect(() => {
    load();
  }, []);

  if (user && user.role !== 'super') return <Navigate to="/feed" replace />;

  function openCreate() {
    setForm({ ...EMPTY });
    setModal({});
    setError('');
  }

  function openEdit(c: AdminClient) {
    setForm({
      name: c.name,
      contact_name: c.contact_name || '',
      contact_email: c.contact_email || '',
      phone: c.phone || '',
      notes: c.notes || ''
    });
    setModal({ id: c.id });
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (modal?.id) await api.put(`/clients/${modal.id}`, form);
      else await api.post('/clients', form);
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: AdminClient) {
    if (!window.confirm(`Delete client "${c.name}"?`)) return;
    setError('');
    try {
      await api.del(`/clients/${c.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-gray-400">Companies you work for</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} /> Add client
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Projects</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.contact_name || '—'}
                  {c.contact_email && <span className="block text-xs text-gray-400">{c.contact_email}</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.project_count || 0}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    title={c.project_count ? 'Has projects — cannot delete' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!clients.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Edit client' : 'Add client'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Company name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact person</label>
                <input className="input" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Contact email</label>
              <input className="input" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

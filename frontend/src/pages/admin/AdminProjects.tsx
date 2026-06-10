import { useEffect, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Pencil, Plus, UserPlus, X } from 'lucide-react';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import { TypeBadge, TYPE_LABELS } from '../../components/Badges';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { AdminClient, Member, ProjectLite, ProjectType } from '../../lib/types';
import type { ShellContext } from '../Shell';

interface AssignableUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_color?: string | null;
}

function MembersModal({ project, onClose }: { project: ProjectLite; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [pickId, setPickId] = useState(0);
  const [pickRole, setPickRole] = useState('member');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, a] = await Promise.all([
      api.get(`/projects/${project.id}`),
      api.get(`/users/assignable?project_id=${project.id}`)
    ]);
    setMembers(d.members);
    setAssignable(a.users);
    setPickId(0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const picked = assignable.find(u => u.id === pickId);

  async function add() {
    if (!pickId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/projects/${project.id}/members`, { user_id: pickId, role: pickRole });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: number) {
    setBusy(true);
    setError('');
    try {
      await api.del(`/projects/${project.id}/members/${userId}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Members — ${project.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Add person</label>
            <select className="input" value={pickId} onChange={e => setPickId(Number(e.target.value))}>
              <option value={0}>Select…</option>
              {assignable.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role === 'client' ? '(client)' : ''}
                </option>
              ))}
            </select>
          </div>
          {picked && picked.role !== 'client' && (
            <div>
              <label className="label">Role</label>
              <select className="input !w-28" value={pickRole} onChange={e => setPickRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          )}
          <button onClick={add} disabled={!pickId || busy} className="btn-primary">
            <UserPlus size={14} /> Add
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.user_id} className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
              <Avatar name={m.name} color={m.avatar_color} px={26} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{m.name}</p>
                <p className="truncate text-xs text-gray-400">{m.email}</p>
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {m.user_role === 'client' ? 'client' : m.member_role}
              </span>
              <button
                onClick={() => remove(m.user_id)}
                disabled={busy}
                className="rounded-lg p-1 text-gray-300 hover:bg-gray-100 hover:text-red-500"
                title="Remove from project"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {!members.length && <p className="py-4 text-center text-sm text-gray-400">No members yet.</p>}
        </div>
      </div>
    </Modal>
  );
}

const EMPTY = { name: '', client_id: 0, type: 'general' as ProjectType, description: '', status: 'active' };

export default function AdminProjects() {
  const { user } = useAuth();
  const { reloadProjects } = useOutletContext<ShellContext>();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [modal, setModal] = useState<null | { id?: number }>(null);
  const [membersFor, setMembersFor] = useState<ProjectLite | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([api.get('/projects'), api.get('/clients')]);
    setProjects(p.projects);
    setClients(c.clients);
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

  function openEdit(p: ProjectLite) {
    setForm({ name: p.name, client_id: p.client_id, type: p.type, description: p.description || '', status: p.status });
    setModal({ id: p.id });
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (modal?.id) {
        await api.put(`/projects/${modal.id}`, form);
      } else {
        await api.post('/projects', form);
      }
      setModal(null);
      await load();
      reloadProjects();
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
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-gray-400">One wall per client project</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} /> New project
        </button>
      </div>

      {error && !modal && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Members</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.client_name}</td>
                <td className="px-4 py-3">
                  <TypeBadge t={p.type} />
                </td>
                <td className="px-4 py-3">
                  {p.status === 'active' ? (
                    <span className="text-xs font-medium text-emerald-600">Active</span>
                  ) : (
                    <span className="text-xs font-medium text-gray-400">Archived</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.member_count || 0}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setMembersFor(p)} className="btn-ghost !px-2.5 !py-1 text-xs">
                    Members
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="ml-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!projects.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.id ? 'Edit project' : 'New project'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Project name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client *</label>
                <select className="input" value={form.client_id} onChange={e => setForm({ ...form, client_id: Number(e.target.value) })}>
                  <option value={0}>Select…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ProjectType })}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {modal.id && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.client_id} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {membersFor && (
        <MembersModal
          project={membersFor}
          onClose={() => {
            setMembersFor(null);
            load();
            reloadProjects();
          }}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import Avatar from './Avatar';
import { VisibilityPill } from './Badges';
import { api } from '../lib/api';
import { parseDbDate } from '../lib/format';
import type { Member, Visibility } from '../lib/types';

interface LItem {
  id: number;
  list_id: number;
  text: string;
  done: 0 | 1;
  assignee_id: number | null;
  assignee_name?: string | null;
  assignee_color?: string | null;
  due_date: string | null;
}

interface WList {
  id: number;
  project_id: number;
  title: string;
  visibility: Visibility;
  items: LItem[];
}

function dueLabel(due: string): { text: string; cls: string } {
  const d = parseDbDate(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const text = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (diff < 0) return { text, cls: 'border-red-200 bg-red-50 text-red-700' };
  if (diff === 0) return { text: 'Today', cls: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (diff <= 2) return { text, cls: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { text, cls: 'border-gray-200 bg-gray-50 text-gray-600' };
}

function ItemRow({
  item,
  members,
  onChange,
  onDelete
}: {
  item: LItem;
  members: Member[];
  onChange: (patch: Partial<LItem>) => void;
  onDelete: () => void;
}) {
  const due = item.due_date ? dueLabel(item.due_date) : null;
  return (
    <div className="group flex items-center gap-2 py-1.5">
      <button
        onClick={() => onChange({ done: item.done ? 0 : 1 })}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          item.done ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 hover:border-violet-400'
        }`}
        aria-label={item.done ? 'Mark not done' : 'Mark done'}
      >
        {item.done === 1 && <Check size={11} strokeWidth={3} />}
      </button>
      <span className={`min-w-0 flex-1 text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.text}</span>

      {due && (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${due.cls}`}>{due.text}</span>
      )}
      <input
        type="date"
        value={item.due_date ? item.due_date.slice(0, 10) : ''}
        onChange={e => onChange({ due_date: e.target.value || null })}
        className="w-[26px] shrink-0 cursor-pointer rounded text-transparent opacity-60 hover:opacity-100"
        title="Set due date"
      />

      <select
        value={item.assignee_id ?? ''}
        onChange={e => onChange({ assignee_id: e.target.value ? Number(e.target.value) : null })}
        className="shrink-0 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[11px] text-gray-600"
        title="Assign"
      >
        <option value="">—</option>
        {members.map(m => (
          <option key={m.user_id} value={m.user_id}>
            {m.name}
          </option>
        ))}
      </select>
      {item.assignee_id && <Avatar name={item.assignee_name || ''} color={item.assignee_color} px={22} />}

      <button
        onClick={onDelete}
        className="invisible shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500 group-hover:visible"
        aria-label="Delete item"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ListCard({
  list,
  members,
  canManage,
  onDeleteList
}: {
  list: WList;
  members: Member[];
  canManage: boolean;
  onDeleteList: () => void;
}) {
  const [items, setItems] = useState<LItem[]>(list.items);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const doneCount = items.filter(i => i.done).length;

  async function addItem() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const d = await api.post(`/lists/${list.id}/items`, { text });
      setItems(prev => [...prev, d.item]);
      setDraft('');
    } finally {
      setAdding(false);
    }
  }

  async function patchItem(item: LItem, patch: Partial<LItem>) {
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...patch } : i)));
    try {
      await api.patch(`/list-items/${item.id}`, patch);
    } catch {
      setItems(prev => prev.map(i => (i.id === item.id ? item : i))); // revert on failure
    }
  }

  async function removeItem(item: LItem) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    await api.del(`/list-items/${item.id}`).catch(() => setItems(prev => [...prev, item]));
  }

  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold">{list.title}</h3>
        <span className="text-[11px] text-gray-400">
          {doneCount}/{items.length}
        </span>
        <VisibilityPill v={list.visibility} />
        {canManage && (
          <button
            onClick={onDeleteList}
            className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-500"
            aria-label="Delete list"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="mt-1.5 divide-y divide-gray-50">
        {sorted.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            members={members}
            onChange={patch => patchItem(item, patch)}
            onDelete={() => removeItem(item)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
        <Plus size={15} className="text-gray-300" />
        <input
          className="flex-1 bg-transparent text-sm placeholder-gray-400 focus:outline-none"
          placeholder="Add an item…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
      </div>
    </div>
  );
}

export default function ListsTab({
  projectId,
  members,
  canManage
}: {
  projectId: number;
  members: Member[];
  canManage: boolean;
}) {
  const [lists, setLists] = useState<WList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [vis, setVis] = useState<Visibility>('internal');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const d = await api.get(`/projects/${projectId}/lists`);
    setLists(d.lists);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(e => setError(e.message || 'Could not load lists'))
      .finally(() => setLoading(false));
  }, [load]);

  async function addList() {
    const t = title.trim();
    if (!t || creating) return;
    setCreating(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/lists`, { title: t, visibility: vis });
      setTitle('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Could not create list');
    } finally {
      setCreating(false);
    }
  }

  async function deleteList(id: number) {
    if (!window.confirm('Delete this list and all its items?')) return;
    setLists(prev => prev.filter(l => l.id !== id));
    await api.del(`/lists/${id}`).catch(() => load());
  }

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Loading lists…</p>;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <input
            className="input min-w-[200px] flex-1"
            placeholder="New list title — e.g. Pre-launch checklist"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addList();
              }
            }}
          />
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
            <button
              onClick={() => setVis('internal')}
              className={`px-2.5 py-2 ${vis === 'internal' ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-400'}`}
            >
              Internal
            </button>
            <button
              onClick={() => setVis('client')}
              className={`border-l border-gray-200 px-2.5 py-2 ${vis === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400'}`}
            >
              Client
            </button>
          </div>
          <button onClick={addList} disabled={!title.trim() || creating} className="btn-primary">
            Add list
          </button>
        </div>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!lists.length && (
        <p className="py-8 text-center text-sm text-gray-400">
          No lists yet.{canManage ? ' Create one above to start tracking tasks.' : ''}
        </p>
      )}

      <div className="space-y-4">
        {lists.map(l => (
          <ListCard key={l.id} list={l} members={members} canManage={canManage} onDeleteList={() => deleteList(l.id)} />
        ))}
      </div>
    </div>
  );
}

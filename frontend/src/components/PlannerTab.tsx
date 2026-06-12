import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import Avatar from './Avatar';
import type { Member } from '../lib/types';

const PX = 28;
const ROW_H = 44;
const HEAD_H = 40;
const PAD = 14;
const COLORS = ['#7C3AED', '#2563EB', '#0891B2', '#16A34A', '#CA8A04', '#DC2626', '#DB2777', '#64748B'];

interface PTask {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  progress: number;
  color: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_color: string | null;
  visibility: 'internal' | 'client';
  position: number;
  deps: number[];
}

interface DragState {
  taskId: number;
  mode: 'move' | 'resize-l' | 'resize-r';
  startX: number;
  origStart: string;
  origEnd: string;
}

interface FormState {
  title: string;
  start_date: string;
  end_date: string;
  progress: number;
  color: string;
  assignee_id: string;
  visibility: 'internal' | 'client';
  deps: number[];
}

function parseDate(s: string) { return new Date(s + 'T00:00:00'); }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function daysBetween(a: string, b: string) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}
function todayStr() { return fmtDate(new Date()); }

function emptyForm(): FormState {
  const start = todayStr();
  return { title: '', start_date: start, end_date: addDays(start, 6), progress: 0, color: COLORS[0], assignee_id: '', visibility: 'internal', deps: [] };
}

function GanttHeader({ rangeStart, totalDays }: { rangeStart: string; totalDays: number }) {
  const months: { label: string; days: number }[] = [];
  let cur = parseDate(rangeStart);
  let remaining = totalDays;
  while (remaining > 0) {
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const daysLeft = Math.round((new Date(year, month + 1, 1).getTime() - cur.getTime()) / 86400000);
    const take = Math.min(daysLeft, remaining);
    months.push({ label: cur.toLocaleString('default', { month: 'short', year: 'numeric' }), days: take });
    remaining -= take;
    cur = new Date(year, month + 1, 1);
  }
  return (
    <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: HEAD_H }}>
      {months.map((m, i) => (
        <div
          key={i}
          className="flex-shrink-0 border-r border-gray-200 px-2 text-[11px] font-medium text-gray-500 flex items-center"
          style={{ width: m.days * PX }}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}

function DepsLayer({ tasks, rangeStart }: { tasks: PTask[]; rangeStart: string }) {
  const byId = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);
  const arrows: { d: string; key: string }[] = [];
  tasks.forEach(succ => {
    succ.deps.forEach(predId => {
      const pred = byId[predId];
      if (!pred) return;
      const predIdx = tasks.indexOf(pred);
      const succIdx = tasks.indexOf(succ);
      const predRight = (daysBetween(rangeStart, pred.end_date) + 1) * PX;
      const succLeft = daysBetween(rangeStart, succ.start_date) * PX;
      const predMidY = predIdx * ROW_H + ROW_H / 2;
      const succMidY = succIdx * ROW_H + ROW_H / 2;
      const elbow = predRight + Math.max(12, (succLeft - predRight) / 2);
      arrows.push({ key: `${predId}-${succ.id}`, d: `M ${predRight} ${predMidY} H ${elbow} V ${succMidY} H ${succLeft}` });
    });
  });
  if (!arrows.length) return null;
  return (
    <svg className="pointer-events-none absolute inset-0" width="100%" height="100%" style={{ zIndex: 1 }}>
      <defs>
        <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {arrows.map(a => (
        <path key={a.key} d={a.d} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#dep-arrow)" />
      ))}
    </svg>
  );
}

interface Props {
  projectId: number;
  members: Member[];
  canManage: boolean;
}

export default function PlannerTab({ projectId, members, canManage }: Props) {
  const [tasks, setTasks] = useState<PTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [draftDates, setDraftDates] = useState<Record<number, { start: string; end: string }>>({});
  const dragRef = useRef<DragState | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/projects/${projectId}/planner`);
      setTasks(d.tasks);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const { rangeStart, totalDays } = useMemo(() => {
    if (!tasks.length) {
      const s = addDays(todayStr(), -PAD);
      return { rangeStart: s, totalDays: PAD * 3 };
    }
    const minD = tasks.reduce((m, t) => t.start_date < m ? t.start_date : m, tasks[0].start_date);
    const maxD = tasks.reduce((m, t) => t.end_date > m ? t.end_date : m, tasks[0].end_date);
    const s = addDays(minD, -PAD);
    const e = addDays(maxD, PAD);
    return { rangeStart: s, totalDays: daysBetween(s, e) + 1 };
  }, [tasks]);

  const todayOffset = daysBetween(rangeStart, todayStr());

  function startDrag(e: React.MouseEvent, task: PTask & { start_date: string; end_date: string }, mode: DragState['mode']) {
    if (!canManage) return;
    e.preventDefault();
    dragRef.current = { taskId: task.id, mode, startX: e.clientX, origStart: task.start_date, origEnd: task.end_date };

    function onMove(ev: MouseEvent) {
      const dr = dragRef.current;
      if (!dr) return;
      const delta = Math.round((ev.clientX - dr.startX) / PX);
      let ns = dr.origStart, ne = dr.origEnd;
      if (dr.mode === 'move') { ns = addDays(dr.origStart, delta); ne = addDays(dr.origEnd, delta); }
      else if (dr.mode === 'resize-l') { ns = addDays(dr.origStart, delta); if (ns >= ne) ns = addDays(ne, -1); }
      else { ne = addDays(dr.origEnd, delta); if (ne <= ns) ne = addDays(ns, 1); }
      setDraftDates(prev => ({ ...prev, [dr.taskId]: { start: ns, end: ne } }));
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dr = dragRef.current;
      dragRef.current = null;
      if (!dr) return;
      setDraftDates(prev => {
        const d = prev[dr.taskId];
        if (d) api.patch(`/planner/tasks/${dr.taskId}`, { start_date: d.start, end_date: d.end }).then(load);
        const next = { ...prev };
        delete next[dr.taskId];
        return next;
      });
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function openAdd() { setEditingId(null); setForm(emptyForm()); setShowForm(true); }
  function openEdit(task: PTask) {
    setEditingId(task.id);
    setForm({
      title: task.title, start_date: task.start_date, end_date: task.end_date,
      progress: task.progress, color: task.color || COLORS[0],
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      visibility: task.visibility, deps: task.deps,
    });
    setShowForm(true);
  }

  async function saveForm() {
    const title = form.title.trim();
    if (!title) return;
    setSaving(true);
    try {
      const payload = {
        title, start_date: form.start_date, end_date: form.end_date,
        progress: form.progress, color: form.color || null,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        visibility: form.visibility, deps: form.deps,
      };
      if (editingId !== null) await api.patch(`/planner/tasks/${editingId}`, payload);
      else await api.post(`/projects/${projectId}/planner/tasks`, payload);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function deleteTask(id: number) {
    if (!confirm('Delete this task?')) return;
    await api.del(`/planner/tasks/${id}`);
    load();
  }

  function toggleDep(id: number) {
    setForm(f => ({ ...f, deps: f.deps.includes(id) ? f.deps.filter(d => d !== id) : [...f.deps, id] }));
  }

  if (loading) return <p className="py-12 text-center text-sm text-gray-400">Loading…</p>;

  return (
    <div className="mt-2">
      {canManage && (
        <div className="mb-3 flex justify-end">
          <button onClick={openAdd} className="btn-primary text-sm px-3 py-1.5">+ Add Task</button>
        </div>
      )}

      {showForm && (
        <div className="card mb-4 p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editingId ? 'Edit Task' : 'New Task'}</h3>
          <input
            className="input" placeholder="Task title" value={form.title} autoFocus
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Start</label>
              <input type="date" className="input" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="label">End</label>
              <input type="date" className="input" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Progress — {form.progress}%</label>
            <input type="range" min={0} max={100} value={form.progress} className="w-full accent-violet-600"
              onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ background: c }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Assignee</label>
            <select className="input" value={form.assignee_id}
              onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {members.filter(m => m.user_role !== 'client').map(m => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </div>
          {tasks.filter(t => t.id !== editingId).length > 0 && (
            <div>
              <label className="label">Depends on</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tasks.filter(t => t.id !== editingId).map(t => {
                  const active = form.deps.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => toggleDep(t.id)}
                      style={active ? { background: t.color || COLORS[0], color: '#fff', borderColor: 'transparent' } : {}}
                      className={`rounded-full px-2.5 py-0.5 text-xs border transition-all ${active ? '' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                    >
                      {t.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="label">Visibility</label>
            <div className="flex gap-2 mt-1">
              {(['internal', 'client'] as const).map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, visibility: v }))}
                  className={`rounded-full px-3 py-1 text-xs border capitalize transition-colors ${form.visibility === v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveForm} disabled={saving || !form.title.trim()} className="btn-primary text-sm px-4 py-1.5">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {!tasks.length && !showForm && (
        <p className="py-12 text-center text-sm text-gray-400">No tasks yet — add the first one.</p>
      )}

      {tasks.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex">
            {/* Left panel — task labels */}
            <div className="flex-shrink-0 border-r border-gray-200" style={{ width: 220 }}>
              <div className="flex items-center border-b border-gray-200 bg-gray-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                style={{ height: HEAD_H }}>
                Task
              </div>
              {tasks.map(task => {
                const color = task.color || COLORS[0];
                const draft = draftDates[task.id];
                const dur = daysBetween(draft?.start || task.start_date, draft?.end || task.end_date) + 1;
                return (
                  <div key={task.id}
                    className="group flex items-center gap-2 border-b border-gray-100 px-3 hover:bg-gray-50"
                    style={{ height: ROW_H }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium leading-tight">{task.title}</div>
                      <div className="text-[10px] text-gray-400">{task.progress}% · {dur}d</div>
                    </div>
                    {task.assignee_name && (
                      <Avatar name={task.assignee_name} color={task.assignee_color} px={20} />
                    )}
                    {canManage && (
                      <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(task)} className="text-gray-400 hover:text-violet-600 p-0.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right panel — Gantt chart */}
            <div className="flex-1 overflow-x-auto">
              <div className="relative" style={{ width: totalDays * PX, minWidth: '100%' }}>
                <GanttHeader rangeStart={rangeStart} totalDays={totalDays} />
                {/* Background grid */}
                <div className="absolute left-0 right-0 bottom-0" style={{ top: HEAD_H }}>
                  {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: i * 7 * PX }} />
                  ))}
                  {todayOffset >= 0 && todayOffset <= totalDays && (
                    <div className="absolute top-0 bottom-0 border-l-2 border-red-400 opacity-60"
                      style={{ left: todayOffset * PX }} />
                  )}
                  {tasks.map((_, i) => (
                    <div key={i} className={`absolute left-0 right-0 ${i % 2 === 1 ? 'bg-gray-50/60' : ''}`}
                      style={{ top: i * ROW_H, height: ROW_H }} />
                  ))}
                </div>
                {/* Task bars */}
                <div className="relative" style={{ top: HEAD_H, height: tasks.length * ROW_H }}>
                  <DepsLayer tasks={tasks} rangeStart={rangeStart} />
                  {tasks.map((task, i) => {
                    const draft = draftDates[task.id];
                    const start = draft?.start || task.start_date;
                    const end = draft?.end || task.end_date;
                    const left = daysBetween(rangeStart, start) * PX;
                    const width = Math.max((daysBetween(start, end) + 1) * PX, PX);
                    const color = task.color || COLORS[0];
                    return (
                      <div key={task.id}
                        className="absolute flex items-center rounded select-none"
                        style={{
                          left, top: i * ROW_H + 8, width, height: ROW_H - 16,
                          background: color + '33', zIndex: 2,
                          cursor: canManage ? 'grab' : 'default',
                        }}
                        onMouseDown={e => startDrag(e, { ...task, start_date: start, end_date: end }, 'move')}
                      >
                        <div className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${task.progress}%`, background: color + '99' }} />
                        {canManage && (
                          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l" style={{ zIndex: 3 }}
                            onMouseDown={e => { e.stopPropagation(); startDrag(e, { ...task, start_date: start, end_date: end }, 'resize-l'); }} />
                        )}
                        <span className="relative z-10 px-2 text-xs font-semibold truncate" style={{ color }}>
                          {task.title}
                        </span>
                        {canManage && (
                          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r" style={{ zIndex: 3 }}
                            onMouseDown={e => { e.stopPropagation(); startDrag(e, { ...task, start_date: start, end_date: end }, 'resize-r'); }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

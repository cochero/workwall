import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Trash2, Video } from 'lucide-react';
import Avatar from './Avatar';
import { VisibilityPill } from './Badges';
import { api } from '../lib/api';
import { parseDbDate } from '../lib/format';
import type { Member, Visibility } from '../lib/types';

interface Attendee {
  meeting_id: number;
  user_id: number;
  name: string;
  avatar_color: string | null;
}

interface Meeting {
  id: number;
  project_id: number;
  title: string;
  meeting_at: string;
  duration_min: number | null;
  link: string | null;
  location_text: string | null;
  agenda: string | null;
  visibility: Visibility;
  created_by: number;
  created_at: string;
  attendees: Attendee[];
}

interface FormState {
  title: string;
  date: string;
  time: string;
  duration: number | null;
  where: string;
  agenda: string;
  visibility: Visibility;
  attendeeIds: number[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(dateStr: string): string {
  const d = parseDbDate(dateStr);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s.trim());
}

function emptyForm(): FormState {
  const now = new Date();
  const mins = now.getMinutes();
  now.setMinutes(mins < 30 ? 30 : 60, 0, 0);
  return {
    title: '',
    date: toLocalDate(now),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    duration: 60,
    where: '',
    agenda: '',
    visibility: 'internal',
    attendeeIds: [],
  };
}

function meetingToForm(m: Meeting): FormState {
  const d = parseDbDate(m.meeting_at);
  return {
    title: m.title,
    date: toLocalDate(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    duration: m.duration_min,
    where: m.link || m.location_text || '',
    agenda: m.agenda || '',
    visibility: m.visibility,
    attendeeIds: m.attendees.map(a => a.user_id),
  };
}

function formToPayload(f: FormState) {
  const w = f.where.trim();
  return {
    title: f.title.trim(),
    meeting_at: `${f.date} ${f.time}:00`,
    duration_min: f.duration,
    link: w && isUrl(w) ? w : null,
    location_text: w && !isUrl(w) ? w : null,
    agenda: f.agenda.trim() || null,
    visibility: f.visibility,
    attendees: f.attendeeIds,
  };
}

const DURATIONS: { label: string; value: number | null }[] = [
  { label: 'No limit', value: null },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];

// ── MeetingForm ───────────────────────────────────────────────────────────────

function MeetingForm({
  initial,
  members,
  saving,
  onSave,
  onCancel,
}: {
  initial: FormState;
  members: Member[];
  saving: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (patch: Partial<FormState>) => setF(p => ({ ...p, ...patch }));

  function toggleAttendee(uid: number) {
    setF(p => ({
      ...p,
      attendeeIds: p.attendeeIds.includes(uid)
        ? p.attendeeIds.filter(id => id !== uid)
        : [...p.attendeeIds, uid],
    }));
  }

  return (
    <div className="card p-4 space-y-3">
      <input
        className="input text-sm font-medium"
        placeholder="Meeting title *"
        value={f.title}
        onChange={e => set({ title: e.target.value })}
        autoFocus
      />

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          className="input w-auto text-sm"
          value={f.date}
          onChange={e => set({ date: e.target.value })}
        />
        <input
          type="time"
          className="input w-auto text-sm"
          value={f.time}
          onChange={e => set({ time: e.target.value })}
        />
        <select
          className="input w-auto text-sm"
          value={f.duration ?? ''}
          onChange={e => set({ duration: e.target.value ? Number(e.target.value) : null })}
        >
          {DURATIONS.map(d => (
            <option key={String(d.value)} value={d.value ?? ''}>{d.label}</option>
          ))}
        </select>
      </div>

      <input
        className="input text-sm"
        placeholder="Meeting link (https://...) or physical location"
        value={f.where}
        onChange={e => set({ where: e.target.value })}
      />

      {members.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Attendees</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const checked = f.attendeeIds.includes(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggleAttendee(m.user_id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                    checked
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Avatar name={m.name} color={m.avatar_color} px={16} />
                  {m.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea
        className="input resize-none text-sm"
        rows={3}
        placeholder="Agenda / notes (optional)"
        value={f.agenda}
        onChange={e => set({ agenda: e.target.value })}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
          <button
            onClick={() => set({ visibility: 'internal' })}
            className={`px-2.5 py-2 ${f.visibility === 'internal' ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-400'}`}
          >
            Internal
          </button>
          <button
            onClick={() => set({ visibility: 'client' })}
            className={`border-l border-gray-200 px-2.5 py-2 ${f.visibility === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400'}`}
          >
            Client
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
          <button
            onClick={() => onSave(f)}
            disabled={!f.title.trim() || !f.date || saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MeetingCard ───────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  canManage,
  highlight,
  onEdit,
  onDelete,
}: {
  meeting: Meeting;
  canManage: boolean;
  highlight: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const time = fmtTime(meeting.meeting_at);
  const hasLink = !!meeting.link && isUrl(meeting.link);

  return (
    <div className={`card group flex gap-3 p-4 transition-all ${highlight ? 'ring-2 ring-violet-300 shadow-sm' : ''}`}>
      <div className="w-1 shrink-0 self-stretch rounded-full bg-violet-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{meeting.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={11} /> {time}
              </span>
              {meeting.duration_min && <span>{fmtDuration(meeting.duration_min)}</span>}
              {hasLink && (
                <a
                  href={meeting.link!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-600 hover:underline"
                >
                  <Video size={11} /> Join meeting
                </a>
              )}
              {meeting.location_text && !hasLink && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {meeting.location_text}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <VisibilityPill v={meeting.visibility} />
            {canManage && (
              <div className="invisible flex gap-0.5 group-hover:visible">
                <button
                  onClick={onEdit}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Edit meeting"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={onDelete}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  aria-label="Delete meeting"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {meeting.agenda && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-gray-600">{meeting.agenda}</p>
        )}

        {meeting.attendees.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {meeting.attendees.slice(0, 8).map(a => (
              <Avatar key={a.user_id} name={a.name} color={a.avatar_color} px={20} />
            ))}
            {meeting.attendees.length > 8 && (
              <span className="text-[11px] text-gray-400">+{meeting.attendees.length - 8}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MiniCalendar ─────────────────────────────────────────────────────────────

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function MiniCalendar({
  year,
  month,
  meetings,
  selectedDay,
  onSelectDay,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  meetings: Meeting[];
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  const todayStr = toLocalDate(today);

  const meetingDays = new Set(
    meetings
      .filter(m => {
        const d = parseDbDate(m.meeting_at);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(m => toLocalDate(parseDbDate(m.meeting_at)))
  );

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <div className="mb-2 flex items-center">
        <button
          onClick={onPrev}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="flex-1 text-center text-[12px] font-semibold text-gray-700">{monthLabel}</span>
        <button
          onClick={onNext}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mb-0.5 grid grid-cols-7">
        {DAY_HEADERS.map(d => (
          <span key={d} className="py-0.5 text-center text-[10px] font-medium text-gray-400">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const hasMeeting = meetingDays.has(dateStr);
          const isSelected = selectedDay === dateStr;

          return (
            <button
              key={i}
              onClick={() => hasMeeting ? onSelectDay(isSelected ? null : dateStr) : undefined}
              disabled={!hasMeeting}
              title={hasMeeting ? 'View meetings' : undefined}
              className={[
                'relative mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[12px] transition-colors',
                isToday ? 'bg-violet-600 font-bold text-white' : '',
                !isToday && isSelected ? 'bg-violet-100 font-semibold text-violet-700' : '',
                !isToday && !isSelected && hasMeeting ? 'cursor-pointer font-medium text-gray-800 hover:bg-gray-100' : '',
                !isToday && !hasMeeting ? 'cursor-default text-gray-400' : '',
              ].join(' ')}
            >
              {d}
              {hasMeeting && !isToday && (
                <span className="absolute bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-violet-500" />
              )}
              {hasMeeting && isToday && (
                <span className="absolute bottom-[2px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MeetingsTab ───────────────────────────────────────────────────────────────

export default function MeetingsTab({
  projectId,
  members,
  canManage,
}: {
  projectId: number;
  members: Member[];
  canManage: boolean;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    const d = await api.get(`/projects/${projectId}/meetings`);
    setMeetings(d.meetings);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(e => setError(e.message || 'Could not load meetings'))
      .finally(() => setLoading(false));
  }, [load]);

  const monthMeetings = meetings.filter(m => {
    const d = parseDbDate(m.meeting_at);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });

  const grouped: Record<string, Meeting[]> = {};
  for (const m of monthMeetings) {
    const key = toLocalDate(parseDbDate(m.meeting_at));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }
  const sortedDays = Object.keys(grouped).sort();

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  }

  function handleSelectDay(d: string | null) {
    setSelectedDay(d);
    if (d && dayRefs.current[d]) {
      dayRefs.current[d]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleAdd(f: FormState) {
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      await api.post(`/projects/${projectId}/meetings`, formToPayload(f));
      setShowAdd(false);
      // Navigate calendar to the month of the new meeting
      const d = new Date(`${f.date}T00:00:00`);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Could not create meeting');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: number, f: FormState) {
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      await api.patch(`/meetings/${id}`, formToPayload(f));
      setEditId(null);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Could not update meeting');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this meeting?')) return;
    setMeetings(prev => prev.filter(m => m.id !== id));
    await api.del(`/meetings/${id}`).catch(() => load());
  }

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Loading meetings…</p>;

  return (
    <div className="space-y-4">
      {(error || formError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || formError}
        </p>
      )}

      {showAdd && canManage && (
        <MeetingForm
          initial={emptyForm()}
          members={members}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); setFormError(''); }}
        />
      )}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        {/* Calendar panel */}
        <div className="w-full shrink-0 sm:w-48">
          <div className="card p-3">
            <MiniCalendar
              year={calYear}
              month={calMonth}
              meetings={meetings}
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              onPrev={prevMonth}
              onNext={nextMonth}
            />
          </div>
          {canManage && (
            <button
              onClick={() => { setShowAdd(s => !s); setEditId(null); setFormError(''); }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
            >
              <Plus size={13} />
              {showAdd ? 'Cancel' : 'New meeting'}
            </button>
          )}
        </div>

        {/* Meeting list */}
        <div className="min-w-0 flex-1 space-y-5">
          {!monthMeetings.length && (
            <p className="py-10 text-center text-sm text-gray-400">
              No meetings in{' '}
              {new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}.
              {canManage ? ' Click "New meeting" to schedule one.' : ''}
            </p>
          )}

          {sortedDays.map(day => {
            const d = new Date(`${day}T00:00:00`);
            const dayLabel = d.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            return (
              <div key={day} ref={el => { dayRefs.current[day] = el; }}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {dayLabel}
                </p>
                <div className="space-y-2">
                  {grouped[day].map(m =>
                    editId === m.id ? (
                      <MeetingForm
                        key={m.id}
                        initial={meetingToForm(m)}
                        members={members}
                        saving={saving}
                        onSave={f => handleEdit(m.id, f)}
                        onCancel={() => { setEditId(null); setFormError(''); }}
                      />
                    ) : (
                      <MeetingCard
                        key={m.id}
                        meeting={m}
                        canManage={canManage}
                        highlight={selectedDay === toLocalDate(parseDbDate(m.meeting_at))}
                        onEdit={() => { setEditId(m.id); setShowAdd(false); setFormError(''); }}
                        onDelete={() => handleDelete(m.id)}
                      />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Eye, Lock, Paperclip, X } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../lib/api';
import { fmtSize } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import type { Member, Visibility } from '../lib/types';

interface MentionState {
  open: boolean;
  query: string;
  triggerIdx: number;
  caret: number;
}

const CLOSED: MentionState = { open: false, query: '', triggerIdx: -1, caret: 0 };

export default function PostComposer({
  projectId,
  members,
  onPosted
}: {
  projectId: number;
  members: Member[];
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('internal');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [mention, setMention] = useState<MentionState>(CLOSED);
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  const isClient = user.role === 'client';
  const effectiveVisibility: Visibility = isClient ? 'client' : visibility;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([\w]*)$/);
    if (m) {
      setMention({ open: true, query: m[2], triggerIdx: caret - m[2].length - 1, caret });
    } else {
      setMention(CLOSED);
    }
  }

  const candidates = mention.open
    ? members
        .filter(mb => mb.user_id !== user.id)
        .filter(mb => mb.name.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  function pick(mb: Member) {
    const after = body.slice(mention.caret);
    const next = body.slice(0, mention.triggerIdx) + '@' + mb.name + ' ' + after;
    setBody(next);
    setMentionedIds(prev => [...new Set([...prev, mb.user_id])]);
    setMention(CLOSED);
    taRef.current?.focus();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...incoming.filter(f => !seen.has(f.name + f.size))].slice(0, 10);
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    if ((!body.trim() && !files.length) || posting) return;
    setPosting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('body', body);
      fd.append('visibility', effectiveVisibility);
      fd.append('mentioned', JSON.stringify(mentionedIds));
      files.forEach(f => fd.append('files', f));
      await api.upload(`/projects/${projectId}/posts`, fd);
      setBody('');
      setFiles([]);
      setMentionedIds([]);
      onPosted();
    } catch (e: any) {
      setError(e.message || 'Could not post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="card relative p-3.5">
      <div className="flex items-start gap-2.5">
        <Avatar name={user.name} color={user.avatar_color} px={32} />
        <div className="min-w-0 flex-1">
          <textarea
            ref={taRef}
            rows={2}
            className="input resize-none border-0 !p-1.5 text-[14px] focus:!ring-0"
            placeholder="Share an update… use @ to mention someone"
            value={body}
            onChange={handleChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape') setMention(CLOSED);
            }}
          />

          {mention.open && candidates.length > 0 && (
            <div className="absolute z-30 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              {candidates.map(mb => (
                <button
                  key={mb.user_id}
                  onMouseDown={e => {
                    e.preventDefault();
                    pick(mb);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50"
                >
                  <Avatar name={mb.name} color={mb.avatar_color} px={22} />
                  <span className="min-w-0 flex-1 truncate">{mb.name}</span>
                  {mb.user_role === 'client' && <span className="text-[10px] text-emerald-600">client</span>}
                </button>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span
                  key={f.name + i}
                  className="inline-flex max-w-56 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1.5 text-xs"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-gray-400">{fmtSize(f.size)}</span>
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2.5">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost !px-2.5" title="Attach files">
              <Paperclip size={15} />
            </button>

            {isClient ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                <Eye size={11} /> Visible to your team & you
              </span>
            ) : (
              <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
                <button
                  onClick={() => setVisibility('internal')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    visibility === 'internal' ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Lock size={11} /> Internal
                </button>
                <button
                  onClick={() => setVisibility('client')}
                  className={`flex items-center gap-1 border-l border-gray-200 px-2.5 py-1.5 transition-colors ${
                    visibility === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Eye size={11} /> Client visible
                </button>
              </div>
            )}

            <div className="flex-1" />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button onClick={submit} disabled={(!body.trim() && !files.length) || posting} className="btn-primary">
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import Avatar from './Avatar';
import { ClientRolePill } from './Badges';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import type { CommentT } from '../lib/types';

export default function CommentThread({
  parentType,
  parentId,
  initial
}: {
  parentType: 'post' | 'file';
  parentId: number;
  initial: CommentT[];
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentT[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const d = await api.post('/comments', { parent_type: parentType, parent_id: parentId, body });
      setComments(prev => [...prev, d.comment]);
      setText('');
    } catch (e: any) {
      setError(e.message || 'Could not post comment');
    } finally {
      setSending(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.del(`/comments/${id}`);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      setError(e.message || 'Could not delete comment');
    }
  }

  return (
    <div className="space-y-2.5">
      {comments.map(c => (
        <div className="group flex items-start gap-2" key={c.id}>
          <Avatar name={c.author_name} color={c.author_color} px={24} />
          <div className="min-w-0 flex-1 rounded-lg bg-gray-50 px-3 py-1.5">
            <p className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="font-semibold text-gray-800">{c.author_name}</span>
              {c.author_role === 'client' && <ClientRolePill />}
              <span className="text-gray-400">{timeAgo(c.created_at)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-[13px] text-gray-700">{c.body}</p>
          </div>
          {(c.author_id === user.id || user.role === 'super') && (
            <button
              onClick={() => remove(c.id)}
              className="invisible mt-1 rounded p-0.5 text-gray-300 hover:text-red-500 group-hover:visible"
              title="Delete comment"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Avatar name={user.name} color={user.avatar_color} px={24} />
        <input
          className="input flex-1 !py-1.5 text-[13px]"
          placeholder="Write a comment…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button onClick={submit} disabled={!text.trim() || sending} className="btn-ghost !px-2.5 !py-1.5" title="Send">
          <Send size={14} />
        </button>
      </div>
      {error && <p className="pl-8 text-xs text-red-600">{error}</p>}
    </div>
  );
}

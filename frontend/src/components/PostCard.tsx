import { Link } from 'react-router-dom';
import { MessageSquare, Pin, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { ClientRolePill, VisibilityPill } from './Badges';
import CommentThread from './CommentThread';
import FileChip from './FileChip';
import { api, downloadUrl } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../lib/types';

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[\w.]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <span key={i} className="font-medium text-violet-600">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function PostCard({
  post,
  variant = 'wall',
  onOpenFile,
  onChanged
}: {
  post: Post;
  variant?: 'wall' | 'feed';
  onOpenFile?: (id: number) => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const canModerate = user.role !== 'client';
  const canDelete = post.author_id === user.id || user.role === 'super';
  const images = post.files.filter(f => f.category === 'image');
  const others = post.files.filter(f => f.category !== 'image');

  async function togglePin() {
    await api.patch(`/posts/${post.id}`, { pinned: post.pinned ? 0 : 1 });
    onChanged?.();
  }

  async function remove() {
    if (!window.confirm('Delete this post? Attached files stay in the project library.')) return;
    await api.del(`/posts/${post.id}`);
    onChanged?.();
  }

  return (
    <article className={`card p-4 ${post.pinned ? 'border-violet-200 bg-violet-50/30' : ''}`}>
      {variant === 'feed' && (
        <Link
          to={`/p/${post.project_id}`}
          className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-violet-600"
        >
          {post.client_name} · {post.project_name}
        </Link>
      )}

      <div className="flex items-center gap-2.5">
        <Avatar name={post.author_name} color={post.author_color} px={32} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="font-semibold text-gray-900">{post.author_name}</span>
            {post.author_role === 'client' && <ClientRolePill />}
            <span className="text-gray-400">{timeAgo(post.created_at)}</span>
            {post.pinned === 1 && <Pin size={12} className="text-violet-500" />}
          </p>
        </div>
        <VisibilityPill v={post.visibility} />
        {variant === 'wall' && canModerate && (
          <button
            onClick={togglePin}
            className={`rounded-lg p-1.5 hover:bg-gray-100 ${post.pinned ? 'text-violet-600' : 'text-gray-300 hover:text-gray-500'}`}
            title={post.pinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin size={15} />
          </button>
        )}
        {variant === 'wall' && canDelete && (
          <button onClick={remove} className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-red-500" title="Delete post">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {post.body && (
        <p className="mt-2.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-gray-800">
          <MentionText text={post.body} />
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map(f => (
            <img
              key={f.id}
              src={downloadUrl(f.id, true)}
              alt={f.original_name}
              loading="lazy"
              onClick={() => onOpenFile?.(f.id)}
              className="h-32 w-44 cursor-pointer rounded-lg border border-gray-200 object-cover transition-opacity hover:opacity-90"
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {others.map(f => (
            <FileChip key={f.id} file={f} onOpen={id => onOpenFile?.(id)} />
          ))}
        </div>
      )}

      {variant === 'feed' ? (
        <Link
          to={`/p/${post.project_id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-violet-600"
        >
          <MessageSquare size={13} />
          {post.comment_count || 0} comment{(post.comment_count || 0) === 1 ? '' : 's'} — open project
        </Link>
      ) : (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <CommentThread parentType="post" parentId={post.id} initial={post.comments || []} />
        </div>
      )}
    </article>
  );
}

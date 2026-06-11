import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import { TypeBadge } from '../components/Badges';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import FilesTab from '../components/FilesTab';
import FileDetailDrawer from '../components/FileDetailDrawer';
import ListsTab from '../components/ListsTab';
import type { Post, ProjectDetail } from '../lib/types';
import type { ShellContext } from './Shell';

export default function ProjectPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { refreshPoll } = useOutletContext<ShellContext>();

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<'wall' | 'files' | 'lists'>('wall');
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [filesKey, setFilesKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    const d = await api.get(`/projects/${pid}/posts`);
    setPosts(d.posts);
  }, [pid]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setTab('wall');
    setDrawerId(null);
    (async () => {
      try {
        const d = await api.get(`/projects/${pid}`);
        if (!alive) return;
        setDetail(d);
        await loadPosts();
        await api.post(`/projects/${pid}/read`);
        refreshPoll();
      } catch (e: any) {
        if (alive) setError(e.message || 'Could not load project');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  function onDrawerChanged() {
    loadPosts();
    setFilesKey(k => k + 1);
  }

  if (loading) return <p className="py-16 text-center text-sm text-gray-400">Loading project…</p>;
  if (error || !detail) {
    return (
      <div className="mx-auto max-w-md p-10">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Not found'}</p>
      </div>
    );
  }

  const { project, members } = detail;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        <TypeBadge t={project.type} />
        <span className="text-sm text-gray-400">{project.client_name}</span>
        <div className="flex-1" />
        <div className="flex items-center pl-2">
          {members.slice(0, 6).map((m, i) => (
            <div key={m.user_id} className={i ? '-ml-2' : ''} title={`${m.name}${m.user_role === 'client' ? ' (client)' : ''}`}>
              <Avatar name={m.name} color={m.avatar_color} px={26} />
            </div>
          ))}
          {members.length > 6 && (
            <span className="-ml-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
              +{members.length - 6}
            </span>
          )}
        </div>
      </div>
      {project.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}

      <div className="mt-4 flex gap-5 border-b border-gray-200 text-sm">
        <button
          onClick={() => setTab('wall')}
          className={`-mb-px border-b-2 px-1 pb-2 font-medium transition-colors ${
            tab === 'wall' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Wall
        </button>
        <button
          onClick={() => setTab('files')}
          className={`-mb-px border-b-2 px-1 pb-2 font-medium transition-colors ${
            tab === 'files' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setTab('lists')}
          className={`-mb-px border-b-2 px-1 pb-2 font-medium transition-colors ${
            tab === 'lists' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Lists
        </button>
      </div>

      {tab === 'wall' && (
        <div className="mt-5 space-y-4">
          <PostComposer projectId={pid} members={members} onPosted={loadPosts} />
          {!posts.length && <p className="py-8 text-center text-sm text-gray-400">No posts yet — share the first update.</p>}
          {posts.map(p => (
            <PostCard key={p.id} post={p} onOpenFile={setDrawerId} onChanged={loadPosts} />
          ))}
        </div>
      )}

      {tab === 'files' && (
        <div className="mt-5">
          <FilesTab key={filesKey} projectId={pid} onOpenFile={setDrawerId} />
        </div>
      )}

      {tab === 'lists' && (
        <div className="mt-5">
          <ListsTab projectId={pid} members={members} canManage={detail.my_user_role !== 'client'} />
        </div>
      )}

      {drawerId !== null && (
        <FileDetailDrawer fileId={drawerId} onClose={() => setDrawerId(null)} onChanged={onDrawerChanged} />
      )}
    </div>
  );
}

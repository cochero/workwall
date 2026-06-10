import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import PostCard from '../components/PostCard';
import type { Post } from '../lib/types';

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/feed')
      .then(d => setPosts(d.posts))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-lg font-semibold tracking-tight">My feed</h1>
      <p className="mb-5 text-sm text-gray-400">The latest updates across all your projects</p>

      {loading && <p className="py-10 text-center text-sm text-gray-400">Loading…</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!loading && !error && !posts.length && (
        <p className="py-10 text-center text-sm text-gray-400">No updates yet. Open a project and post the first one.</p>
      )}

      <div className="space-y-4">
        {posts.map(p => (
          <PostCard key={p.id} post={p} variant="feed" />
        ))}
      </div>
    </div>
  );
}

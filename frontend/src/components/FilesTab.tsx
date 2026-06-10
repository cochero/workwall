import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Search, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { fmtSize, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon } from './FileChip';
import { StatusPill } from './Badges';
import type { Visibility, WFile } from '../lib/types';

export default function FilesTab({ projectId, onOpenFile }: { projectId: number; onOpenFile: (id: number) => void }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<WFile[]>([]);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('internal');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const d = await api.get(`/projects/${projectId}/files?${params.toString()}`);
      setFiles(d.files);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, category, status, search]);

  async function handleUpload(list: FileList | null) {
    if (!list || !list.length) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('visibility', visibility);
      Array.from(list).forEach(f => fd.append('files', f));
      await api.upload(`/projects/${projectId}/files`, fd);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!user) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input !w-36 !py-1.5 text-[13px]" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="pdf">PDFs</option>
          <option value="doc">Documents</option>
          <option value="sheet">Sheets</option>
          <option value="other">Other</option>
        </select>
        <select className="input !w-36 !py-1.5 text-[13px]" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In review</option>
          <option value="approved">Approved</option>
          <option value="final">Final</option>
        </select>
        <div className="relative min-w-40 flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input !py-1.5 !pl-8 text-[13px]"
            placeholder="Search files…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {user.role !== 'client' && (
          <select className="input !w-36 !py-1.5 text-[13px]" value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}>
            <option value="internal">Internal</option>
            <option value="client">Client visible</option>
          </select>
        )}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-primary">
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-gray-400">Loading files…</p>}
      {!loading && !files.length && (
        <p className="py-8 text-center text-sm text-gray-400">No files match. Upload the first one.</p>
      )}

      <div className="space-y-1.5">
        {files.map(f => (
          <button
            key={f.id}
            onClick={() => onOpenFile(f.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/30"
          >
            <CategoryIcon category={f.category} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-gray-800">{f.original_name}</span>
              <span className="block text-[11px] text-gray-400">
                {f.uploader_name} · {timeAgo(f.created_at)} · {fmtSize(f.size_bytes)}
              </span>
            </span>
            {(f.version_count || 1) > 1 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">v{f.version_no}</span>
            )}
            <StatusPill s={f.status} />
            {(f.comment_count || 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <MessageSquare size={12} /> {f.comment_count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

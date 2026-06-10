import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, History, Upload, X } from 'lucide-react';
import { api, downloadUrl } from '../lib/api';
import { fmtSize, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon } from './FileChip';
import { StatusPill, VisibilityPill } from './Badges';
import CommentThread from './CommentThread';
import type { CommentT, FileStatus, FileVersion, WFile } from '../lib/types';

interface Detail {
  file: WFile;
  versions: FileVersion[];
  comments: CommentT[];
}

export default function FileDetailDrawer({
  fileId,
  onClose,
  onChanged
}: {
  fileId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const versionRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const d = await api.get(`/files/${fileId}`);
      setData(d);
    } catch (e: any) {
      setError(e.message || 'Could not load file');
    }
  }

  useEffect(() => {
    setData(null);
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  async function changeStatus(s: FileStatus) {
    if (!data) return;
    setBusy(true);
    try {
      await api.patch(`/files/${data.file.id}`, { status: s });
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadVersion(list: FileList | null) {
    if (!data || !list || !list.length) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', list[0]);
      await api.upload(`/files/${data.file.id}/version`, fd);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (versionRef.current) versionRef.current.value = '';
    }
  }

  const canModerate = !!user && user.role !== 'client';

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-[26rem] max-w-full flex-col bg-white shadow-2xl">
        {!data ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-400">{error || 'Loading…'}</div>
        ) : (
          <>
            <div className="flex items-start gap-3 border-b border-gray-200 p-4">
              <CategoryIcon category={data.file.category} size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-gray-900" title={data.file.original_name}>
                  {data.file.original_name}
                </p>
                <p className="text-[11px] text-gray-400">
                  v{data.file.version_no} · {fmtSize(data.file.size_bytes)} · {data.file.uploader_name} · {timeAgo(data.file.created_at)}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <StatusPill s={data.file.status} />
                  <VisibilityPill v={data.file.visibility} />
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {data.file.category === 'image' && (
                <img
                  src={downloadUrl(data.file.id, true)}
                  alt={data.file.original_name}
                  className="mb-4 max-h-64 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain"
                />
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <a href={downloadUrl(data.file.id)} className="btn-ghost" download>
                  <Download size={14} /> Download
                </a>
                {data.file.category === 'pdf' && (
                  <button onClick={() => window.open(downloadUrl(data.file.id, true), '_blank')} className="btn-ghost">
                    <ExternalLink size={14} /> Preview
                  </button>
                )}
                {canModerate && (
                  <select
                    className="input !w-32 !py-1.5 text-[13px]"
                    value={data.file.status}
                    disabled={busy}
                    onChange={e => changeStatus(e.target.value as FileStatus)}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">In review</option>
                    <option value="approved">Approved</option>
                    <option value="final">Final</option>
                  </select>
                )}
                <input ref={versionRef} type="file" className="hidden" onChange={e => uploadVersion(e.target.files)} />
                <button onClick={() => versionRef.current?.click()} disabled={busy} className="btn-ghost">
                  <Upload size={14} /> New version
                </button>
              </div>

              {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

              {data.versions.length > 1 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Versions</p>
                  <div className="space-y-1">
                    {data.versions.map(v => (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                          v.id === data.file.id ? 'border-violet-200 bg-violet-50/50' : 'border-gray-100'
                        }`}
                      >
                        <History size={13} className="text-gray-400" />
                        <span className="font-medium">v{v.version_no}</span>
                        <span className="min-w-0 flex-1 truncate text-gray-500">
                          {v.uploader_name} · {timeAgo(v.created_at)} · {fmtSize(v.size_bytes)}
                        </span>
                        <a href={downloadUrl(v.id)} className="text-violet-600 hover:underline" download>
                          get
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">File discussion</p>
              <CommentThread
                key={`${data.file.id}-${data.comments.length}`}
                parentType="file"
                parentId={data.file.id}
                initial={data.comments}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

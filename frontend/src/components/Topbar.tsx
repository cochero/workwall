import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Bell, FileText, History, MessageSquare, Paperclip, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { Notification } from '../lib/types';

function iconFor(type: string) {
  switch (type) {
    case 'mention':
      return <AtSign size={14} className="text-violet-500" />;
    case 'comment':
      return <MessageSquare size={14} className="text-blue-500" />;
    case 'file':
      return <Paperclip size={14} className="text-teal-500" />;
    case 'file_version':
      return <History size={14} className="text-teal-500" />;
    case 'member_added':
      return <UserPlus size={14} className="text-emerald-500" />;
    default:
      return <FileText size={14} className="text-gray-400" />;
  }
}

export default function Topbar({ bellCount, onSeen }: { bellCount: number; onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const d = await api.get('/notifications');
        setItems(d.notifications);
        await api.post('/notifications/read-all');
        onSeen();
      } finally {
        setLoading(false);
      }
    }
  }

  function go(n: Notification) {
    setOpen(false);
    if (n.project_id) navigate(`/p/${n.project_id}`);
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-end border-b border-gray-200 bg-white px-4">
      <div className="relative" ref={ref}>
        <button
          onClick={toggle}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Notifications"
        >
          <Bell size={17} />
          {bellCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {bellCount > 99 ? '99+' : bellCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-40 max-h-[28rem] w-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notifications
            </p>
            {loading && <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>}
            {!loading && !items.length && <p className="px-4 py-6 text-center text-sm text-gray-400">Nothing yet.</p>}
            {!loading &&
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-gray-50 px-4 py-2.5 text-left hover:bg-gray-50 ${
                    n.is_read ? '' : 'bg-violet-50/50'
                  }`}
                >
                  <span className="mt-0.5">{iconFor(n.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-gray-800">
                      <span className="font-medium">{n.actor_name || 'Someone'}</span>
                      {n.type === 'mention' && ' mentioned you'}
                      {n.type === 'comment' && ' commented'}
                      {n.type === 'post' && ' posted an update'}
                      {n.type === 'file' && ' uploaded files'}
                      {n.type === 'file_version' && ' uploaded a new version'}
                      {n.type === 'member_added' && ' added you to a project'}
                    </span>
                    {n.preview && <span className="block truncate text-xs text-gray-500">{n.preview}</span>}
                    <span className="block text-[11px] text-gray-400">
                      {n.project_name ? `${n.project_name} · ` : ''}
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </header>
  );
}

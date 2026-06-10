import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ProjectLite } from '../lib/types';

export interface ShellContext {
  refreshPoll: () => void;
  reloadProjects: () => void;
}

export default function Shell() {
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [bellCount, setBellCount] = useState(0);

  const reloadProjects = useCallback(async () => {
    try {
      const d = await api.get('/projects/mine');
      setProjects(d.projects);
      const m: Record<number, number> = {};
      d.projects.forEach((p: ProjectLite) => {
        m[p.id] = p.unread || 0;
      });
      setUnread(m);
    } catch {
      /* session may have expired; ignore */
    }
  }, []);

  const refreshPoll = useCallback(async () => {
    try {
      const d = await api.get('/poll');
      setBellCount(d.unread_notifications);
      const m: Record<number, number> = {};
      d.projects.forEach((r: { id: number; unread: number }) => {
        m[r.id] = r.unread;
      });
      setUnread(m);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    reloadProjects();
    refreshPoll();
    const t = setInterval(refreshPoll, 30000);
    return () => clearInterval(t);
  }, [user, reloadProjects, refreshPoll]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar projects={projects} unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar bellCount={bellCount} onSeen={() => setBellCount(0)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ refreshPoll, reloadProjects } as ShellContext} />
        </main>
      </div>
    </div>
  );
}

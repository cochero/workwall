import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, FolderKanban, LogOut, Rss, Users } from 'lucide-react';
import Avatar from './Avatar';
import { TYPE_DOT } from './Badges';
import { useAuth } from '../context/AuthContext';
import type { ProjectLite } from '../lib/types';

export default function Sidebar({
  projects,
  unread
}: {
  projects: ProjectLite[];
  unread: Record<number, number>;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const grouped = projects.reduce<Record<string, ProjectLite[]>>((acc, p) => {
    (acc[p.client_name] = acc[p.client_name] || []).push(p);
    return acc;
  }, {});

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-violet-50 font-medium text-violet-700' : 'text-gray-600 hover:bg-gray-100'
    }`;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">W</div>
        <span className="text-[15px] font-semibold tracking-tight">Workwall</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        <NavLink to="/feed" className={itemClass}>
          <Rss size={15} /> My feed
        </NavLink>

        {user.role === 'super' && (
          <div className="mt-4">
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Admin</p>
            <NavLink to="/admin/clients" className={itemClass}>
              <Building2 size={15} /> Clients
            </NavLink>
            <NavLink to="/admin/users" className={itemClass}>
              <Users size={15} /> Users
            </NavLink>
            <NavLink to="/admin/projects" className={itemClass}>
              <FolderKanban size={15} /> Projects
            </NavLink>
          </div>
        )}

        {Object.entries(grouped).map(([client, list]) => (
          <div className="mt-4" key={client}>
            <p className="truncate px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400" title={client}>
              {client}
            </p>
            {list.map(p => {
              const n = unread[p.id] ?? p.unread ?? 0;
              return (
                <NavLink to={`/p/${p.id}`} className={itemClass} key={p.id}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[p.type]}`} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {n > 0 && (
                    <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {!projects.length && (
          <p className="mt-6 px-2.5 text-xs text-gray-400">
            No projects yet.{user.role === 'super' ? ' Create one under Admin → Projects.' : ''}
          </p>
        )}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-gray-200 px-3.5 py-3">
        <Avatar name={user.name} color={user.avatar_color} px={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
          <p className="truncate text-[11px] text-gray-400">
            {user.role === 'super' ? 'Administrator' : user.role === 'team' ? 'Team' : 'Client'}
          </p>
        </div>
        <button onClick={handleLogout} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

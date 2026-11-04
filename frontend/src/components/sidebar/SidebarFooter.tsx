import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarFooterProps {
  isCollapsed?: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ isCollapsed = false }) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const slug = companySlug || 'default';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SA';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isCollapsed) {
    return (
      <div className="p-2 border-t border-slate-100/90 flex flex-col items-center space-y-2 shrink-0 select-none">
        <NavLink
          to={`/app/${slug}/settings`}
          title="Settings"
          className={({ isActive }) =>
            `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-[#fff4ed] text-[#f95716]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          title="Sign Out"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
        </button>

        <div
          title={`${user?.name || 'User'} (${user?.email || ''})`}
          className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer"
        >
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 border-t border-slate-100/90 space-y-2 shrink-0 select-none">
      {/* Settings Link */}
      <NavLink
        to={`/app/${slug}/settings`}
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            isActive
              ? 'bg-[#fff4ed] text-[#f95716] font-bold'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
          }`
        }
      >
        <Settings className="w-4 h-4 shrink-0 text-slate-400" />
        <span>Settings</span>
      </NavLink>

      {/* User Profile Block */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/50 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              {user?.name || 'System SuperAdmin'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {user?.email || 'superadmin@finovo.com'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Sign Out"
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

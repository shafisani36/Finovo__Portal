import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  MessageSquare,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Settings,
  Building2,
  UserCheck,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface DashboardTopHeaderProps {
  currentPageTitle?: string;
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export const DashboardTopHeader: React.FC<DashboardTopHeaderProps> = ({
  currentPageTitle = 'Workspace Dashboard',
  onMobileMenuToggle,
  isMobileMenuOpen = false,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, companies, activeCompany, logout } = useAuth();
  const navigate = useNavigate();
  const slug = companySlug || 'default';

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const currentMembership =
    companies.find((c) => c.company.slug === companySlug) || activeCompany;
  const currentRole = currentMembership?.roles?.[0]?.name || 'Executive Admin';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SA';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-[56px] bg-white border-b border-slate-100/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none shadow-[0_1px_3px_rgba(0,0,0,0.01)] font-['Inter',sans-serif]">
      {/* Left: Mobile Toggle & Breadcrumb Navigation */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        {/* Breadcrumb matching exact Figma design */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs truncate">
          <Link
            to={`/app/${slug}/overview`}
            className="text-slate-400 hover:text-slate-700 font-medium transition-colors truncate"
          >
            Finovo Global
          </Link>
          <span className="text-slate-300 font-normal select-none">
            &gt;
          </span>
          <span className="font-semibold text-slate-900 tracking-tight truncate">
            {currentPageTitle}
          </span>
        </div>
      </div>

      {/* Right: Actions, Live Badge, and User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Workspace Live Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/60 text-emerald-700 text-[11.5px] font-semibold transition-all">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Workspace live</span>
        </div>

        {/* Divider on desktop */}
        <div className="hidden sm:block w-[1px] h-4 bg-slate-200/70 mx-0.5" />

        {/* Help & Support Icon Button */}
        <Link
          to={`/app/${slug}/settings`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors cursor-pointer"
          title="Help & Documentation"
        >
          <HelpCircle className="w-[18px] h-[18px] stroke-[1.8]" />
        </Link>

        {/* Direct Messages & Chat */}
        <Link
          to={`/app/${slug}/collaboration`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors cursor-pointer"
          title="Collaboration & Messages"
        >
          <MessageSquare className="w-[18px] h-[18px] stroke-[1.8]" />
        </Link>

        {/* Notifications Popover Button */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px] stroke-[1.8]" />
            <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#f95716] text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
              21
            </span>
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-1">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                <span className="text-[10.5px] text-[#f95716] font-semibold cursor-pointer hover:underline">
                  Mark all as read
                </span>
              </div>
              <div className="py-2 space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                <div className="p-2 rounded-xl bg-orange-50/60 border border-orange-100/80 text-xs">
                  <p className="font-semibold text-slate-900">Project Milestone Reached</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">PRJ-0816 reached Stage 2 delivery</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">10 mins ago</span>
                </div>
                <div className="p-2 rounded-xl hover:bg-slate-50 text-xs transition-colors">
                  <p className="font-semibold text-slate-800">New Personnel Onboarded</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Hafiz Obaidullah joined QA Squad 682</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">1 hour ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar with Interactive Dropdown Menu */}
        <div className="relative pl-0.5" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-1.5 p-1 -m-1 rounded-full hover:bg-slate-100/70 transition-colors cursor-pointer group"
          >
            {/* Dark Circle Avatar matching Figma */}
            <div className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                isProfileOpen ? 'rotate-180 text-slate-900' : ''
              }`}
            />
          </button>

          {/* User Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* User Header */}
              <div className="p-2.5 pb-3 border-b border-slate-100 mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user?.name || 'System SuperAdmin'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {user?.email || 'superadmin@finovo.com'}
                    </p>
                    <span className="inline-block px-1.5 py-0.2 mt-1 rounded text-[9.5px] font-bold bg-orange-500/10 text-[#f95716]">
                      {currentRole}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Links */}
              <div className="space-y-0.5 text-xs font-medium text-slate-700">
                <Link
                  to={`/app/${slug}/settings`}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Account Settings</span>
                </Link>

                <Link
                  to="/select-workspace"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Switch Workspace</span>
                </Link>

                <Link
                  to={`/app/${slug}/roles`}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Roles & RBAC Access</span>
                </Link>
              </div>

              {/* Divider & Sign out */}
              <div className="mt-1 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { SidebarHeader } from '../sidebar/SidebarHeader';
import { SidebarNav } from '../sidebar/SidebarNav';
import { SidebarStorageWidget } from '../sidebar/SidebarStorageWidget';
import { SidebarFooter } from '../sidebar/SidebarFooter';
import { DashboardTopHeader } from '../header/DashboardTopHeader';
import { CommandPalette } from '../ui/CommandPalette';
import { EmployeeScreenMonitor } from '../attendance/EmployeeScreenMonitor';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  hidePageHeader?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  subtitle,
  actions,
  hidePageHeader = false,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('finovo_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('finovo_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Global Keyboard Shortcuts: ⌘K / Ctrl+K for Search, ⌘B / Ctrl+B for Sidebar toggle
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Cmd+B or Ctrl+B -> Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex text-slate-800 antialiased font-['Inter',sans-serif] relative overflow-x-hidden bg-[#f8fafc]">
      {/* Pure Radiant Sun Aura Radial Gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(249,87,22,0.14)_0%,rgba(254,215,170,0.08)_28%,rgba(254,243,199,0.03)_55%,transparent_80%)] z-0" />

      {/* Desktop Fixed Sidebar - Permanently pinned to the left edge */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 fixed top-0 bottom-0 left-0 h-screen z-30 select-none bg-white border-r border-slate-200/80 shadow-[1px_0_4px_rgba(0,0,0,0.01)] transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-[70px]' : 'w-[260px]'
        }`}
      >
        <SidebarHeader
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSearchClick={() => setIsCommandPaletteOpen(true)}
        />
        <SidebarNav isCollapsed={isSidebarCollapsed} />
        <SidebarStorageWidget isCollapsed={isSidebarCollapsed} />
        <SidebarFooter isCollapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Sliding Sidebar Drawer */}
          <aside className="relative flex w-[280px] max-w-[85%] h-full bg-white flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarHeader
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
              onSearchClick={() => {
                setIsMobileMenuOpen(false);
                setIsCommandPaletteOpen(true);
              }}
            />
            <SidebarNav />
            <SidebarStorageWidget />
            <SidebarFooter />
          </aside>
        </div>
      )}

      {/* Main Content Area - Transitions padding when fixed sidebar expands/collapses */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen relative z-10 transition-[padding] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-[70px]' : 'lg:pl-[260px]'
        }`}
      >
        {/* Sticky Top Navbar */}
        <DashboardTopHeader
          currentPageTitle={title || 'Workspace Dashboard'}
          onMobileMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Page Header (if title or actions are explicitly supplied by sub-pages) */}
        {!hidePageHeader && ((title && title !== 'Overview' && title !== 'Workspace Dashboard') || actions) && (
          <div className="px-6 lg:px-8 pt-6 pb-4 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2.5">{actions}</div>}
          </div>
        )}

        {/* Main Content Body */}
        <main className="p-4 sm:p-6 lg:p-7 flex-1 w-full max-w-[1600px] mx-auto space-y-6 flex flex-col">
          {children}
        </main>
      </div>

      {/* Silent remote screen monitoring receiver for active employee sessions */}
      <EmployeeScreenMonitor />

      {/* Command Palette Modal (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};

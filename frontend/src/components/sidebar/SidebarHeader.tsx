import React from 'react';
import { Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import finovoIcon from '../../assets/finovo-icon.png';

interface SidebarHeaderProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSearchClick?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  onSearchClick,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const slug = companySlug || 'default';

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center shrink-0 border-b border-slate-100">
        {/* Top Header aligned with topbar h-[56px] */}
        <div className="h-[56px] w-full flex items-center justify-center">
          <Link
            to={`/app/${slug}/overview`}
            className="w-8 h-8 rounded-xl overflow-hidden hover:scale-105 transition-transform"
            title="Finovo Global"
          >
            <img
              src={finovoIcon}
              alt="Finovo"
              className="w-full h-full object-contain"
            />
          </Link>
        </div>

        {/* Action Buttons in Collapsed Mode */}
        <div className="py-2 flex flex-col items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Expand Sidebar (Ctrl+B)"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-[#f95716] hover:bg-orange-50/80 flex items-center justify-center transition-colors cursor-pointer"
              title="Quick Search (⌘K / Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-slate-100 select-none">
      {/* Brand Header Row - Height exactly h-[56px] matching the Topbar */}
      <div className="h-[56px] px-3.5 flex items-center justify-between">
        <Link
          to={`/app/${slug}/overview`}
          className="flex items-center gap-2.5 min-w-0 group cursor-pointer"
        >
          {/* Exact Finovo Logo Icon */}
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs shrink-0 group-hover:scale-105 transition-transform">
            <img
              src={finovoIcon}
              alt="Finovo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <span className="text-[14px] font-black text-slate-900 tracking-tight truncate block font-['Plus_Jakarta_Sans',sans-serif] leading-tight">
              Finovo
            </span>
            <p className="text-[10.5px] text-slate-400 font-medium tracking-tight leading-tight">
              Global &bull; Enterprise
            </p>
          </div>
        </Link>

        {/* Sidebar Collapse Toggle Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="Collapse Sidebar (Ctrl+B)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Search Jump Bar with Equal Spacing */}
      <div className="px-3.5 pb-3">
        <div
          onClick={onSearchClick}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600 min-w-0">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs text-slate-400 group-hover:text-slate-600 font-normal truncate">
              Search or jump to...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-white border border-slate-200/80 text-slate-400 shadow-2xs group-hover:border-orange-200 group-hover:text-[#f95716] transition-colors">
            ⌘K
          </kbd>
        </div>
      </div>
    </div>
  );
};

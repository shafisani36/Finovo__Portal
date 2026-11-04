import React from 'react';
import { Download, Plus } from 'lucide-react';

export interface PortfolioPageHeaderProps {
  category?: string;
  title: string;
  subtitle: string;
  onExport: () => void;
  exportLabel?: string;
  onAdd: () => void;
  addLabel: string;
  addShortcut?: string;
}

export const PortfolioPageHeader: React.FC<PortfolioPageHeaderProps> = ({
  category = 'PORTFOLIO',
  title,
  subtitle,
  onExport,
  exportLabel = 'Export',
  onAdd,
  addLabel,
  addShortcut = 'N',
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span className="text-[11px] font-bold tracking-wider text-[#F95716] uppercase block">
          {category}
        </span>
        <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mt-0.5">
          {title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>{exportLabel}</span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{addLabel}</span>
          {addShortcut && (
            <span className="bg-white/20 text-white rounded px-1.5 py-0.5 text-[10px] font-mono leading-none">
              {addShortcut}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Table as TableIcon, LayoutGrid } from 'lucide-react';

export interface PortfolioTabItem {
  id: string;
  label: string;
  count: number;
  dotColor?: string;
}

export interface PortfolioFilterTabsProps {
  tabs: PortfolioTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
}

export const PortfolioFilterTabs: React.FC<PortfolioFilterTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/70 pb-0 gap-3">
      <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                isActive ? 'text-[#F95716] font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.dotColor && (
                <span className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />
              )}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
                  isActive ? 'bg-[#FFF2EB] text-[#F95716]' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F95716] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* View Mode Toggle (Table / Grid) */}
      <div className="flex items-center gap-1 pb-2">
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Table View"
        >
          <TableIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

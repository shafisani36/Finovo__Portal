import React from 'react';
import { Database } from 'lucide-react';

interface SidebarStorageWidgetProps {
  usedGb?: number;
  totalGb?: number;
  isCollapsed?: boolean;
}

export const SidebarStorageWidget: React.FC<SidebarStorageWidgetProps> = ({
  usedGb = 31,
  totalGb = 50,
  isCollapsed = false,
}) => {
  const percentage = Math.round((usedGb / totalGb) * 100);

  if (isCollapsed) {
    return (
      <div className="mx-2 my-2 p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center justify-center space-y-1">
        <Database className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[9px] font-bold text-slate-700">{percentage}%</span>
      </div>
    );
  }

  return (
    <div className="mx-3.5 my-2 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 space-y-2.5 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-800">Storage</span>
        </div>
        <span className="text-xs font-bold text-slate-900">{percentage}%</span>
      </div>

      {/* Progress Bar with Gradient */}
      <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-[#f95716] rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-[10.5px] text-slate-400 font-medium">
        {usedGb} GB of {totalGb} GB used
      </p>
    </div>
  );
};

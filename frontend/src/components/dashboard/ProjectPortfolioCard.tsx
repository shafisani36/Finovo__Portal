import React, { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';

interface ProjectPortfolioCardProps {
  activeCount?: number;
  planningCount?: number;
  onHoldCount?: number;
  completedCount?: number;
}

export const ProjectPortfolioCard: React.FC<ProjectPortfolioCardProps> = ({
  activeCount = 127,
  planningCount = 57,
  onHoldCount = 0,
  completedCount = 0,
}) => {
  const [period, setPeriod] = useState('This Quarter');
  const total = activeCount + planningCount + onHoldCount + completedCount || 184;

  const activePercent = Math.round((activeCount / total) * 100);
  const planningPercent = Math.round((planningCount / total) * 100);
  const onHoldPercent = Math.round((onHoldCount / total) * 100);
  const completedPercent = Math.round((completedCount / total) * 100);

  // SVG Donut calculation: circumference = 2 * PI * r = 2 * 3.14159 * 42 ≈ 263.89
  const circumference = 263.89;
  const activeStroke = (activePercent / 100) * circumference;
  const planningStroke = (planningPercent / 100) * circumference;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4">
      {/* Card Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Project Portfolio Status
            </h3>
            <p className="text-[10.5px] text-slate-400">
              Real-time allocation across active delivery stages
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span>{period}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Donut & Legend Row */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        {/* Donut Chart */}
        <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="9"
            />
            {/* Active (Green) Segment */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="#10B981"
              strokeWidth="9"
              strokeDasharray={`${activeStroke} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            {/* Planning (Blue) Segment */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="#3B82F6"
              strokeWidth="9"
              strokeDasharray={`${planningStroke} ${circumference}`}
              strokeDashoffset={`-${activeStroke}`}
              strokeLinecap="round"
            />
          </svg>

          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
              {total}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              PROJECTS
            </span>
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="w-full sm:w-auto space-y-2.5 text-xs font-medium min-w-[140px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{activeCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">{activePercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600">Planning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{planningCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">{planningPercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600">On Hold</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{onHoldCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">{onHoldPercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-slate-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{completedCount}</span>
              <span className="text-[10px] text-slate-400 font-normal">{completedPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Pill Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
          <span className="w-5 h-5 rounded-md bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center">
            A
          </span>
          <div>
            <div className="text-xs font-bold text-emerald-900">{activeCount}</div>
            <div className="text-[9.5px] text-emerald-700">Active</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/70 border border-blue-100">
          <span className="w-5 h-5 rounded-md bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center">
            P
          </span>
          <div>
            <div className="text-xs font-bold text-blue-900">{planningCount}</div>
            <div className="text-[9.5px] text-blue-700">Planning</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/70 border border-amber-100">
          <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center">
            O
          </span>
          <div>
            <div className="text-xs font-bold text-amber-900">{onHoldCount}</div>
            <div className="text-[9.5px] text-amber-700">On Hold</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/70 border border-slate-200">
          <span className="w-5 h-5 rounded-md bg-slate-400 text-white font-bold text-[10px] flex items-center justify-center">
            C
          </span>
          <div>
            <div className="text-xs font-bold text-slate-900">{completedCount}</div>
            <div className="text-[9.5px] text-slate-600">Completed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

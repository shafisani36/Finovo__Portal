import React, { useState } from 'react';
import { Layers, Laptop, Code2, Palette, MessageSquare, FileText } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface AppCategoryDistributionCardProps {
  range: TimeRange;
}

export const AppCategoryDistributionCard: React.FC<AppCategoryDistributionCardProps> = ({ range }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const categories = [
    {
      id: 'ide',
      label: 'IDEs & Development',
      apps: 'VS Code, IntelliJ IDEA, Cursor',
      percentage: 44.5,
      hours: 635.8,
      color: '#f95716', // Core brand orange
      icon: Code2,
    },
    {
      id: 'git',
      label: 'Version Control & CLI',
      apps: 'GitHub Desktop, Git CLI, Terminal',
      percentage: 21.2,
      hours: 302.8,
      color: '#fb923c', // Warm orange
      icon: Laptop,
    },
    {
      id: 'design',
      label: 'Design & Prototyping',
      apps: 'Figma, Adobe CC, FigJam',
      percentage: 15.6,
      hours: 222.8,
      color: '#ea580c', // Dark orange
      icon: Palette,
    },
    {
      id: 'comms',
      label: 'Communication & Sync',
      apps: 'Slack, Google Meet, Zoom',
      percentage: 12.3,
      hours: 175.7,
      color: '#fdba74', // Soft peach
      icon: MessageSquare,
    },
    {
      id: 'docs',
      label: 'Documentation & Sprint',
      apps: 'Notion, Jira, Linear',
      percentage: 6.4,
      hours: 91.4,
      color: '#cbd5e1', // Slate light
      icon: FileText,
    },
  ];

  const totalHours = categories.reduce((sum, c) => sum + c.hours, 0).toFixed(1);

  // SVG Donut Calculations
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 flex flex-col justify-between space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              App &amp; Tool Distribution
            </h3>
            <p className="text-xs text-slate-400">Time spent per active software class</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600">
          5 Classes
        </span>
      </div>

      {/* Main Layout: Donut Chart + Breakdown List */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Donut Chart */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90 select-none">
            {categories.map((cat, idx) => {
              const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((cumulativePercent / 100) * circumference);
              cumulativePercent += cat.percentage;
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={cat.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={cat.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredIdx !== null ? (
              <>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {categories[hoveredIdx].percentage}%
                </span>
                <span className="text-sm font-black text-slate-900 leading-tight">
                  {categories[hoveredIdx].hours}h
                </span>
                <span className="text-[9.5px] font-semibold text-[#f95716] max-w-[80px] truncate">
                  {categories[hoveredIdx].label.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                <span className="text-lg font-black text-slate-900 leading-tight">
                  {Math.round(Number(totalHours))}h
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">Tracked</span>
              </>
            )}
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 w-full space-y-2">
          {categories.map((cat, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={cat.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isHovered ? 'bg-orange-50/70 border border-orange-200/50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{cat.label}</p>
                    <p className="text-[10.5px] text-slate-400 truncate">{cat.apps}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-slate-900">{cat.percentage}%</span>
                  <span className="text-[10.5px] text-slate-400 block font-medium">{cat.hours}h</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="text-slate-500">Productive software ratio:</span>
        <span className="text-[#f95716] font-bold">94.8% Productive Apps</span>
      </div>
    </div>
  );
};

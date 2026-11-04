import React from 'react';
import { Flag } from 'lucide-react';

export interface DistributionSegment {
  key: string;
  label: string;
  count: number;
  colorClass: string;
  dotClass?: string;
  showPercent?: boolean;
}

export interface PriorityMixStats {
  high: number;
  medium: number;
  low: number;
  total?: number;
}

export interface PortfolioHeroStatsProps {
  icon: React.ReactNode;
  totalCount: number;
  totalLabel: string;
  scopeLabel: string;
  distribution: DistributionSegment[];
  priorityMix: PriorityMixStats;
}

export const PortfolioHeroStats: React.FC<PortfolioHeroStatsProps> = ({
  icon,
  totalCount,
  totalLabel,
  scopeLabel,
  distribution,
  priorityMix,
}) => {
  const priorityTotal =
    priorityMix.total ??
    (priorityMix.high + priorityMix.medium + priorityMix.low || totalCount || 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT SECTION (Col 1-8): Total & Segmented Distribution Bar */}
      <div className="lg:col-span-8 flex flex-col justify-between space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-500 shrink-0">
            {icon}
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">{totalLabel}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400 font-normal">
                {scopeLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Segmented Multi-Color Progress Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
          {totalCount > 0 ? (
            distribution.map((segment) => {
              const pct = totalCount > 0 ? (segment.count / totalCount) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={segment.key}
                  style={{ width: `${pct}%` }}
                  className={`${segment.colorClass} h-full transition-all`}
                  title={`${segment.label}: ${segment.count}`}
                />
              );
            })
          ) : (
            <div className="w-full h-full bg-slate-100" />
          )}
        </div>

        {/* Legend row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-slate-600">
          {distribution.map((segment) => {
            const pct = totalCount > 0 ? Math.round((segment.count / totalCount) * 100) : 0;
            return (
              <div key={segment.key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-xs ${segment.dotClass || segment.colorClass}`} />
                <span>{segment.label}</span>
                <span className="font-mono text-slate-900 font-semibold">{segment.count}</span>
                {segment.showPercent !== false && totalCount > 0 && (
                  <span className="text-[11px] text-slate-400 font-mono">{pct}%</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT SECTION (Col 9-12): Priority Mix */}
      <div className="lg:col-span-4 lg:border-l lg:border-slate-100 lg:pl-6 flex flex-col justify-between space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400">⚑</span>
            Priority mix
          </span>
          <span className="text-slate-400 font-mono font-medium">
            {priorityTotal} total
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* High */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Flag className="w-3 h-3 text-rose-500 fill-rose-500" />
                High
              </span>
              <span className="font-mono font-bold text-slate-900">
                {priorityMix.high}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{
                  width: `${
                    priorityTotal > 0
                      ? Math.min(100, Math.round((priorityMix.high / priorityTotal) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Medium */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Flag className="w-3 h-3 text-amber-500 fill-amber-500" />
                Medium
              </span>
              <span className="font-mono font-bold text-slate-900">
                {priorityMix.medium}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{
                  width: `${
                    priorityTotal > 0
                      ? Math.min(100, Math.round((priorityMix.medium / priorityTotal) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Low */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Flag className="w-3 h-3 text-teal-500 fill-teal-500" />
                Low
              </span>
              <span className="font-mono font-bold text-slate-900">
                {priorityMix.low}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all"
                style={{
                  width: `${
                    priorityTotal > 0
                      ? Math.min(100, Math.round((priorityMix.low / priorityTotal) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

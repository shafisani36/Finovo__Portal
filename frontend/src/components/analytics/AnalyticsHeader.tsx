import React, { useState } from 'react';
import { Download, RefreshCw, Calendar, Sparkles, Filter, ChevronDown, Check } from 'lucide-react';

export type TimeRange = 'today' | '7d' | '30d' | 'quarter' | 'ytd';
export type AnalyticsViewTab =
  | 'analytics'
  | 'anomalies'
  | 'forecasting'
  | 'catalog'
  | 'finobo'
  | 'fleet'
  | 'disputes';

interface AnalyticsHeaderProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  activeTab?: AnalyticsViewTab;
  onTabChange?: (tab: AnalyticsViewTab) => void;
  pendingDisputesCount?: number;
  pendingAnomaliesCount?: number;
  kpiCatalogCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  selectedRange,
  onRangeChange,
  activeTab = 'analytics',
  onTabChange,
  pendingDisputesCount = 0,
  pendingAnomaliesCount = 0,
  kpiCatalogCount = 0,
  onRefresh,
  isRefreshing = false,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);

  const ranges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'This Month' },
    { key: 'quarter', label: 'This Quarter' },
    { key: 'ytd', label: 'YTD' },
  ];

  const viewTabs: { key: AnalyticsViewTab; label: string; badge?: number }[] = [
    { key: 'analytics', label: 'Company Overview' },
    { key: 'anomalies', label: 'Anomaly Center', badge: pendingAnomaliesCount },
    { key: 'forecasting', label: '30-Day Forecasting' },
    { key: 'catalog', label: kpiCatalogCount > 0 ? `KPI Catalog (${kpiCatalogCount})` : 'KPI Catalog' },
    { key: 'finobo', label: 'Finobo Agentic AI' },
    { key: 'fleet', label: 'Agent Fleet & Policy' },
    { key: 'disputes', label: 'Disputes & Inquiries', badge: pendingDisputesCount },
  ];

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 lg:p-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Title and Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-500/10 text-[#f95716] border border-orange-500/15">
              Workforce Intelligence
            </span>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Engine Connected</span>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Company Activity &amp; Workforce Analytics
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Real-time telemetry and deep work intelligence across departments, time allocation, focus intensity, and zero-trust compliance.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/70 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            title="Refresh Telemetry Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-[#f95716]' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:opacity-95 text-white text-xs font-bold shadow-[0_4px_14px_rgba(249,87,22,0.22)] transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Export Report</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-[0_16px_36px_rgba(0,0,0,0.12)] p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
                >
                  <span>Download Executive PDF</span>
                  <span className="text-[10px] text-slate-400">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
                >
                  <span>Download CSV Raw Data</span>
                  <span className="text-[10px] text-slate-400">CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Tabs & Date Range Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-t border-slate-100 pt-3 gap-3">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-2xl overflow-x-auto no-scrollbar self-start lg:self-auto max-w-full">
          {viewTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange?.(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Date Ranges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRangeChange(r.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedRange === r.key
                  ? 'bg-[#f95716] text-white shadow-xs font-bold'
                  : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Activity,
  ArrowUp,
  Lock,
  Server,
  ShieldCheck,
} from 'lucide-react';

export interface PortfolioFooterProps {
  companySlug?: string;
  systemStatus?: string;
  sla?: string;
  latency?: string;
  activeLink?: 'dashboard' | 'analytics' | 'projects' | 'tasks' | 'files' | 'messages' | 'employees';
  className?: string;
}

export const PortfolioFooter: React.FC<PortfolioFooterProps> = ({
  companySlug = '',
  systemStatus = 'All Systems Operational',
  sla = '99.99% SLA',
  latency = '12ms',
  className = '',
}) => {
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className={`w-full mt-auto pt-8 pb-3 transition-all ${className}`}
      aria-label="Enterprise System Footer"
    >
      <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Operational status and performance telemetry */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-2.5">
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 font-medium shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-tight">{systemStatus}</span>
          </div>

          {/* SLA Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{sla}</span>
          </div>

          {/* Latency Metric */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 font-mono text-[11px] font-medium">
            <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>{latency}</span>
          </div>

          {/* Infrastructure Node Badge */}
          <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>{companySlug ? `${companySlug} · node-01` : 'finovo-core-node'}</span>
          </div>
        </div>

        {/* Right: Enterprise Copyright, Compliance & Back to top */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Finovo Global Cloud Enterprise
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-mono text-[10px] text-slate-400">v2.4.0</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>&copy; {new Date().getFullYear()} Finovo Global Inc. All rights reserved.</span>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <span className="text-slate-200 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>SOC-2 Type II</span>
            </span>
            <span className="text-slate-200 dark:text-slate-700">•</span>
            <span>256-Bit TLS</span>
          </div>

          <button
            type="button"
            onClick={handleScrollToTop}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer group shadow-2xs ml-1"
            title="Back to top"
          >
            <span>Top</span>
            <ArrowUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};

import React from 'react';
import { ShieldCheck, Lock, Laptop, CheckCircle2, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';

export const ComplianceGovernanceCard: React.FC = () => {
  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Zero-Trust &amp; Compliance Telemetry
            </h3>
            <p className="text-xs text-slate-400">Desktop agent integrity, privacy safeguards, and fleet telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            SOC2 Certified
          </span>
        </div>
      </div>

      {/* Grid of 3 Telemetry Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Pillar 1: Desktop Agent Fleet */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-[#f95716]" />
              Agent Fleet Health
            </span>
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              48/48 Online
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Client Version:</span>
              <span className="font-bold text-slate-800">v2.4.1 (Stable)</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Heartbeat Interval:</span>
              <span className="font-bold text-slate-800">10s Pulse</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Offline Cache Sync:</span>
              <span className="font-bold text-emerald-600">0 Pending</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Privacy Safeguards */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#f95716]" />
              Privacy Masking
            </span>
            <span className="text-[10px] font-extrabold text-[#f95716] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
              Enforced
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Keystroke Logging:</span>
              <span className="font-bold text-slate-800">Entropy Only</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>PII Sanitization:</span>
              <span className="font-bold text-emerald-600">Active Regex</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Disputes Pending:</span>
              <span className="font-bold text-slate-800">0 Disputes</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Telemetry Ingestion Pipeline */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-[#f95716]" />
              Ingestion Stream
            </span>
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              99.99% SLA
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Throughput:</span>
              <span className="font-bold text-slate-800">14.2k events/hr</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Avg Latency:</span>
              <span className="font-bold text-emerald-600">42ms</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>End-to-End Encryption:</span>
              <span className="font-bold text-slate-800">AES-256 GCM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

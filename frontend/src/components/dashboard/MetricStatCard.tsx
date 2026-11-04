import React from 'react';
import { Layers, Users, Flag, Shield, ChevronRight } from 'lucide-react';

export interface MetricsRowProps {
  activeProjects?: number;
  totalWorkforce?: number;
  departmentCount?: number;
  milestonesReached?: number;
  roleCount?: number;
}

export const MetricsRow: React.FC<MetricsRowProps> = ({
  activeProjects = 127,
  totalWorkforce = 3,
  departmentCount = 23,
  milestonesReached = 19,
  roleCount = 10,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Projects Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-between group hover:border-emerald-200 transition-all">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs mb-3">
              <Layers className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Active Projects</p>
          </div>
          <span className="text-3xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            {activeProjects}
          </span>
        </div>

        <div className="pt-4 z-10">
          <p className="text-[11px] text-slate-400">
            <span className="text-emerald-600 font-bold">+ 69%</span> from last month
          </p>
        </div>

        {/* Decorative Green Wave */}
        <div className="absolute -bottom-1 left-0 right-0 h-10 pointer-events-none opacity-40">
          <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
            <path
              d="M0 20 Q25 5 50 16 T100 8 L100 25 L0 25 Z"
              className="fill-emerald-100"
            />
            <path
              d="M0 20 Q25 5 50 16 T100 8"
              className="stroke-emerald-400 stroke-2 fill-none"
            />
          </svg>
        </div>
      </div>

      {/* 2. Total Workforce Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-between group hover:border-indigo-200 transition-all">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs mb-3">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Total Workforce</p>
          </div>
          <span className="text-3xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            {totalWorkforce}
          </span>
        </div>

        <div className="pt-4 z-10">
          <p className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-600">{totalWorkforce} Active Headcount</span> across {departmentCount} Depts
          </p>
        </div>

        {/* Decorative Indigo/Purple Wave */}
        <div className="absolute -bottom-1 left-0 right-0 h-10 pointer-events-none opacity-40">
          <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
            <path
              d="M0 22 Q20 18 45 10 T100 15 L100 25 L0 25 Z"
              className="fill-indigo-100"
            />
            <path
              d="M0 22 Q20 18 45 10 T100 15"
              className="stroke-indigo-400 stroke-2 fill-none"
            />
          </svg>
        </div>
      </div>

      {/* 3. Milestones Reached Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-between group hover:border-orange-200 transition-all">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f95716] flex items-center justify-center font-bold text-xs mb-3">
              <Flag className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Milestones Reached</p>
          </div>
          <span className="text-3xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            {milestonesReached}
          </span>
        </div>

        <div className="pt-4 z-10">
          <p className="text-[11px] text-slate-400">
            <span className="text-[#f95716] font-bold">+ 63%</span> Velocity
          </p>
        </div>

        {/* Decorative Orange Wave */}
        <div className="absolute -bottom-1 left-0 right-0 h-10 pointer-events-none opacity-40">
          <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
            <path
              d="M0 16 Q30 22 55 12 T100 18 L100 25 L0 25 Z"
              className="fill-orange-100"
            />
            <path
              d="M0 16 Q30 22 55 12 T100 18"
              className="stroke-orange-400 stroke-2 fill-none"
            />
          </svg>
        </div>
      </div>

      {/* 4. Access Governance Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-between group hover:border-purple-200 transition-all">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs mb-3">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Access Governance</p>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            {roleCount} <span className="text-xs font-bold text-slate-400">Roles</span>
          </span>
        </div>

        <div className="pt-4 z-10">
          <p className="text-[11px] text-slate-400">
            RBAC & Policies Active &bull; <span className="font-semibold text-purple-600">100% Protected</span>
          </p>
        </div>

        {/* Decorative Shield Watermark */}
        <div className="absolute -right-2 -bottom-2 text-purple-500/10 pointer-events-none">
          <Shield className="w-20 h-20" />
        </div>
      </div>
    </div>
  );
};

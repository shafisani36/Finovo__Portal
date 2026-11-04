import React from 'react';
import { Network, Users, UserCheck, FolderTree } from 'lucide-react';
import { Department } from './types';

interface DepartmentStatsHeaderProps {
  departments: Department[];
}

export const DepartmentStatsHeader: React.FC<DepartmentStatsHeaderProps> = ({ departments }) => {
  const totalCount = departments.length;
  const activeCount = departments.filter((d) => d.status !== 'archived').length;
  const archivedCount = totalCount - activeCount;

  const totalHeadcount = departments.reduce(
    (sum, d) => sum + (d.employee_profiles_count || d.members_count || 0),
    0
  );

  const withLeadCount = departments.filter((d) => d.manager_membership_id != null).length;
  const leadCoveragePct = totalCount > 0 ? Math.round((withLeadCount / totalCount) * 100) : 0;

  const topLevelCount = departments.filter((d) => !d.parent_department_id && !d.parent_department).length;
  const subUnitsCount = totalCount - topLevelCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Departments */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs relative overflow-hidden transition-all hover:shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Departments
          </span>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100">
            <Network className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            {totalCount}
          </span>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
            {activeCount} Active
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {archivedCount > 0 ? `${archivedCount} archived units` : 'All operating units active'}
        </p>
      </div>

      {/* 2. Total Workforce Assigned */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs relative overflow-hidden transition-all hover:shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Assigned Workforce
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Users className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            {totalHeadcount}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            team members
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Avg. {totalCount > 0 ? (totalHeadcount / totalCount).toFixed(1) : 0} members per department
        </p>
      </div>

      {/* 3. Leadership Coverage */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs relative overflow-hidden transition-all hover:shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Leadership Assigned
          </span>
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
            <UserCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            {leadCoveragePct}%
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            ({withLeadCount}/{totalCount})
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, leadCoveragePct)}%` }}
          />
        </div>
      </div>

      {/* 4. Hierarchy Structure */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-2xs relative overflow-hidden transition-all hover:shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Structure Hierarchy
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <FolderTree className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            {topLevelCount}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Top Divisions
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {subUnitsCount} nested sub-teams &amp; specialized units
        </p>
      </div>
    </div>
  );
};


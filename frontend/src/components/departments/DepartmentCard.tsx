import React from 'react';
import {
  Users,
  Edit2,
  Trash2,
  FolderTree,
  Eye,
} from 'lucide-react';
import { Department, getDepartmentInitials } from './types';

interface DepartmentCardProps {
  department: Department;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onViewDetails: (dept: Department) => void;
}

export const DepartmentCard: React.FC<DepartmentCardProps> = ({
  department,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const isArchived = department.status === 'archived';
  const headcount = department.employee_profiles_count || department.members_count || 0;
  const manager = department.manager?.user;

  // Generate department badge colors based on ID
  const colorThemes = [
    { bg: 'bg-orange-500/10', text: 'text-[#F95716]', border: 'border-orange-200/70' },
    { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200/70' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200/70' },
    { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-200/70' },
    { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200/70' },
    { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-200/70' },
  ];
  const theme = colorThemes[department.id % colorThemes.length];

  const getInitials = (fullName: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className={`group relative bg-white rounded-3xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between hover:shadow-md min-w-0 ${
        isArchived
          ? 'border-slate-200/60 bg-slate-50/40 opacity-80'
          : 'border-slate-200/80 hover:border-orange-300/80 shadow-2xs'
      }`}
    >
      <div className="min-w-0 space-y-2.5">
        {/* Top Header: Badge, Department Name, Badges & Actions */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm font-mono shrink-0 border shadow-2xs mt-0.5 ${theme.bg} ${theme.text} ${theme.border}`}
            >
              {getDepartmentInitials(department.name, department.code)}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-[#F95716] transition-colors break-words line-clamp-2"
                title={department.name}
              >
                {department.name}
              </h3>

              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {department.code && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                    {department.code}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-semibold ${
                    isArchived
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  }`}
                >
                  {isArchived ? 'Archived' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onViewDetails(department)}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(department)}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              title="Edit Department"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(department)}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              title="Delete Department"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Parent Division Tag (Responsive Breadcrumb) */}
        {department.parent_department && (
          <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-slate-500 bg-slate-50/80 p-2 rounded-xl border border-slate-100 min-w-0">
            <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-medium shrink-0">Sub-unit of:</span>
            <span className="font-semibold text-slate-700 truncate min-w-0">
              {department.parent_department.name}
            </span>
          </div>
        )}

        {/* Description / Charter */}
        <p className="text-[11.5px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px] break-words">
          {department.description || (
            <span className="text-slate-300 italic">No formal charter or scope configured.</span>
          )}
        </p>
      </div>

      {/* Footer Metrics & Head of Department */}
      <div className="mt-3.5 sm:mt-4 pt-3 sm:pt-3.5 border-t border-slate-100/80 space-y-2">
        {/* Head of Department */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs min-w-0">
          <span className="text-slate-400 font-medium shrink-0">Department Lead:</span>
          {manager ? (
            <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[9.5px] font-bold flex items-center justify-center font-mono shrink-0">
                {getInitials(manager.name)}
              </div>
              <span className="font-semibold text-slate-800 text-xs truncate" title={manager.name}>
                {manager.name}
              </span>
            </div>
          ) : (
            <span className="text-[10.5px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
              Unassigned
            </span>
          )}
        </div>

        {/* Workforce Assigned */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs min-w-0">
          <span className="text-slate-400 font-medium shrink-0">Workforce:</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100/70 px-2.5 py-0.5 rounded-lg shrink-0">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{headcount} members</span>
          </span>
        </div>
      </div>
    </div>
  );
};

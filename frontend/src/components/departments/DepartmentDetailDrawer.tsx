import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FolderTree,
  Mail,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import { Department, getDepartmentInitials } from './types';

interface DepartmentDetailDrawerProps {
  department: Department | null;
  onClose: () => void;
  onEdit: (dept: Department) => void;
  subDepartments: Department[];
}

export const DepartmentDetailDrawer: React.FC<DepartmentDetailDrawerProps> = ({
  department,
  onClose,
  onEdit,
  subDepartments,
}) => {
  useEffect(() => {
    if (!department) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [department, onClose]);

  if (!department) return null;

  const isArchived = department.status === 'archived';
  const headcount = department.employee_profiles_count || department.members_count || 0;
  const manager = department.manager?.user;

  const getInitials = (fullName: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const drawerContent = (
    <div className="fixed inset-0 z-[99999] flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#F95716] flex items-center justify-center font-bold font-mono text-sm border border-orange-200/60 shrink-0">
              {getDepartmentInitials(department.name, department.code)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">
                {department.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    isArchived
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  }`}
                >
                  {isArchived ? 'Archived' : 'Active'}
                </span>
                {department.code && (
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    • {department.code}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
          {/* Charter / Description Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Organizational Charter &amp; Scope
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">
              {department.description || 'No detailed scope configured for this unit.'}
            </p>
          </div>

          {/* Department Head Section */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Department Leadership
            </span>
            {manager ? (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-orange-500/20 shrink-0">
                  {getInitials(manager.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-xs truncate">
                    {manager.name}
                  </h4>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono truncate mt-0.5">
                    <Mail className="w-3 h-3 text-slate-300" />
                    <span>{manager.email}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-800 text-xs">
                No Head of Department assigned yet. Click edit to assign leadership.
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Workforce Members
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  {headcount}
                </span>
                <span className="text-[11px] text-slate-400">assigned</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Sub-Teams
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  {subDepartments.length}
                </span>
                <span className="text-[11px] text-slate-400">units</span>
              </div>
            </div>
          </div>

          {/* Parent Division */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Organizational Hierarchy
            </span>
            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              {department.parent_department ? (
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-[#F95716]" />
                  <span className="text-slate-500">Reports under:</span>
                  <span className="font-bold text-slate-800">
                    {department.parent_department.name}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Primary / Top-Level Division
                </span>
              )}
            </div>
          </div>

          {/* Sub-departments List */}
          {subDepartments.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Nested Sub-Units ({subDepartments.length})
              </span>
              <div className="space-y-1.5">
                {subDepartments.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-800">{sub.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {sub.code || `UNIT-${sub.id}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(department);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#F95716] hover:bg-[#ea4d10] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Department</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

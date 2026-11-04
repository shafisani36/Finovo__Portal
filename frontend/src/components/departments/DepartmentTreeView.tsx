import React from 'react';
import {
  FolderTree,
  Edit2,
  Trash2,
  Eye,
  CornerDownRight,
} from 'lucide-react';
import { Department, getDepartmentInitials } from './types';

interface DepartmentTreeViewProps {
  departments: Department[];
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onViewDetails: (dept: Department) => void;
}

export const DepartmentTreeView: React.FC<DepartmentTreeViewProps> = ({
  departments,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  // Find top-level departments (no parent)
  const rootDepartments = departments.filter(
    (d) => !d.parent_department_id && !d.parent_department
  );

  // Helper to find direct children of a department
  const getChildren = (parentId: number) => {
    return departments.filter(
      (d) =>
        d.parent_department_id === parentId ||
        (d.parent_department && d.parent_department.id === parentId)
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-orange-800">
          <FolderTree className="w-4 h-4 text-[#F95716]" />
          <span className="font-semibold">
            Organizational Structure Tree View
          </span>
        </div>
        <span className="text-[11px] text-orange-600 font-mono">
          {rootDepartments.length} Primary Divisions • {departments.length - rootDepartments.length} Nested Sub-Units
        </span>
      </div>

      <div className="space-y-4">
        {rootDepartments.map((root) => {
          const children = getChildren(root.id);
          const rootHeadcount = root.employee_profiles_count || root.members_count || 0;

          return (
            <div
              key={root.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4"
            >
              {/* Root Card Node */}
              <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#F95716] flex items-center justify-center font-bold font-mono text-xs border border-orange-200/60 shadow-2xs shrink-0">
                    {getDepartmentInitials(root.name, root.code)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {root.name}
                      </h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                        Top Division
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>
                        Lead:{' '}
                        <strong className="text-slate-700">
                          {root.manager?.user.name || 'Unassigned'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Workforce:{' '}
                        <strong className="text-slate-700">{rootHeadcount} members</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onViewDetails(root)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(root)}
                    className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                    title="Edit Department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(root)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                    title="Delete Department"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Children Branches */}
              {children.length > 0 ? (
                <div className="pl-4 sm:pl-8 space-y-2.5 border-l-2 border-dashed border-orange-200/80 ml-5 sm:ml-6 pt-1">
                  {children.map((child) => {
                    const childHeadcount =
                      child.employee_profiles_count || child.members_count || 0;

                    return (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-orange-200 transition-all shadow-2xs group flex-wrap gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <CornerDownRight className="w-4 h-4 text-orange-400 shrink-0" />
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                            {getDepartmentInitials(child.name, child.code)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs group-hover:text-[#F95716] transition-colors block">
                              {child.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Lead: {child.manager?.user.name || 'Unassigned'} • {childHeadcount} members
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewDetails(child)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(child)}
                            className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(child)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11.5px] text-slate-400 italic pl-4">
                  No nested sub-units configured under this division.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

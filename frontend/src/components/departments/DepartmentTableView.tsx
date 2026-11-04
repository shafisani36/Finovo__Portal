import React from 'react';
import {
  Users,
  Edit2,
  Trash2,
  Eye,
  FolderTree,
} from 'lucide-react';
import { Department, getDepartmentInitials } from './types';

interface DepartmentTableViewProps {
  departments: Department[];
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onViewDetails: (dept: Department) => void;
}

export const DepartmentTableView: React.FC<DepartmentTableViewProps> = ({
  departments,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const getInitials = (fullName: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 pl-6 pr-3">Department</th>
              <th className="py-3.5 px-3">Hierarchy / Parent</th>
              <th className="py-3.5 px-3">Department Head</th>
              <th className="py-3.5 px-3 text-center">Workforce</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {departments.map((dept) => {
              const headcount = dept.employee_profiles_count || dept.members_count || 0;
              const isArchived = dept.status === 'archived';
              const manager = dept.manager?.user;

              return (
                <tr
                  key={dept.id}
                  className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                  onClick={() => onViewDetails(dept)}
                >
                  {/* Department Name & Code */}
                  <td className="py-4 pl-6 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#F95716] flex items-center justify-center font-bold font-mono text-xs shrink-0 border border-orange-200/60">
                        {getDepartmentInitials(dept.name, dept.code)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors block leading-tight">
                          {dept.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {dept.code && (
                            <span className="font-mono text-[10px] text-slate-500 font-semibold">
                              {dept.code}
                            </span>
                          )}
                          {dept.description && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[200px] hidden sm:inline">
                              • {dept.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Hierarchy Parent */}
                  <td className="py-4 px-3">
                    {dept.parent_department ? (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium truncate max-w-[150px]">
                          {dept.parent_department.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        Top Division
                      </span>
                    )}
                  </td>

                  {/* Department Head */}
                  <td className="py-4 px-3">
                    {manager ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                          {getInitials(manager.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 block truncate leading-tight">
                            {manager.name}
                          </span>
                          <span className="text-[10.5px] text-slate-400 font-mono truncate block">
                            {manager.email}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-medium">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Workforce */}
                  <td className="py-4 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-800">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{headcount}</span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        isArchived
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}
                    >
                      {isArchived ? 'Archived' : 'Active'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="py-4 pl-3 pr-6 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onViewDetails(dept)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(dept)}
                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(dept)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

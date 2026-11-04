import React from 'react';
import {
  Users,
  ChevronDown,
  ChevronUp,
  Edit2,
} from 'lucide-react';
import { HierarchyNode } from './types';
import { Department, getDepartmentInitials } from '../types';

interface OrgChartNodeProps {
  node: HierarchyNode;
  isSelected?: boolean;
  onSelect: (dept: Department) => void;
  onToggleCollapse: (deptId: number) => void;
  onEdit: (dept: Department) => void;
}

export const OrgChartNode: React.FC<OrgChartNodeProps> = ({
  node,
  isSelected = false,
  onSelect,
  onToggleCollapse,
  onEdit,
}) => {
  const { department, depth, children, isCollapsed } = node;
  const isRoot = depth === 0;
  const hasChildren = children.length > 0;
  const headcount = department.employee_profiles_count || department.members_count || 0;
  const manager = department.manager?.user;

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
      }}
      className="group select-none"
    >
      {/* Top Connection Input Anchor (Docking Port) */}
      {!isRoot && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-500 shadow-xs z-20 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        </div>
      )}

      {/* Main Node Card */}
      <div
        onClick={() => onSelect(department)}
        className={`w-full h-full rounded-2xl p-3.5 bg-white border transition-all duration-200 flex flex-col justify-between cursor-pointer relative shadow-sm hover:shadow-md ${
          isSelected
            ? 'border-[#F95716] ring-3 ring-orange-500/20 shadow-md'
            : isRoot
            ? 'border-orange-200/90 hover:border-orange-400'
            : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold font-mono text-[10.5px] shrink-0 ${
                isRoot
                  ? 'bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white shadow-2xs'
                  : 'bg-orange-50 text-[#F95716] border border-orange-100'
              }`}
            >
              {getDepartmentInitials(department.name, department.code)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                  {isRoot ? 'Tier 1 Division' : `Tier ${depth + 1} Unit`}
                </span>
                {department.code && (
                  <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60 leading-none">
                    {department.code}
                  </span>
                )}
              </div>
              <h4
                className="font-bold text-slate-900 text-xs truncate leading-snug group-hover:text-[#F95716] transition-colors mt-0.5"
                title={department.name}
              >
                {department.name}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(department);
              }}
              className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
              title="Edit Department"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Middle: Department Head */}
        <div className="py-1 px-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center font-mono shrink-0">
              {getInitials(manager?.name)}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-slate-800 block truncate leading-tight">
                {manager?.name || 'Unassigned Lead'}
              </span>
            </div>
          </div>

          <span
            className={`px-1.5 py-0.2 rounded text-[9.5px] font-medium shrink-0 ${
              department.status === 'archived'
                ? 'bg-slate-200 text-slate-600'
                : 'bg-emerald-100/70 text-emerald-800'
            }`}
          >
            {department.status === 'archived' ? 'Archived' : 'Active'}
          </span>
        </div>

        {/* Footer: Workforce Headcount & Subtree count */}
        <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-0.5 border-t border-slate-100/80">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{headcount} members</span>
          </span>

          {hasChildren && (
            <span className="text-[10px] text-slate-400 font-mono">
              Σ {node.totalSubtreeHeadcount} total
            </span>
          )}
        </div>
      </div>

      {/* Bottom Connection Output Port & Branch Toggle Badge */}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(department.id);
          }}
          className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono transition-all z-20 flex items-center gap-1 cursor-pointer shadow-xs ${
            isCollapsed
              ? 'bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/25 scale-105'
              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'
          }`}
          title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />
              <span>+{children.length}</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-2.5 h-2.5 stroke-[3]" />
              <span>{children.length}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

import React from 'react';
import {
  FileCode2,
  ArrowRight,
  MoreVertical,
  ChevronDown,
  ArrowUpDown,
  Plus,
  FolderKanban,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { dataPipeline } from '../../lib/dataPipeline';

export interface PriorityProjectItem {
  id: string;
  code: string;
  name: string;
  category: string;
  managerName: string;
  managerAvatarLetter: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  progress: number;
  milestonesCount: number;
}

interface PriorityProjectsTableProps {
  projects?: PriorityProjectItem[];
}

export const PriorityProjectsTable: React.FC<PriorityProjectsTableProps> = ({
  projects,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const slug = companySlug || 'default';

  // Read real projects from dataPipeline if not passed as prop
  const cached = dataPipeline.get<any>(`projects_${slug}_default`);
  const rawList: any[] = cached?.projects || [];

  const displayProjects: PriorityProjectItem[] = projects !== undefined
    ? projects
    : rawList.map((p: any) => ({
        id: String(p.id),
        code: p.project_code || `PRJ-${p.id}`,
        name: p.name,
        category: (p.project_type || 'Custom').replace('_', ' '),
        managerName: p.manager?.user?.name || 'Unassigned',
        managerAvatarLetter: (p.manager?.user?.name || 'U')[0].toUpperCase(),
        priority: ((p.priority || 'medium')[0].toUpperCase() + (p.priority || 'medium').slice(1)) as any,
        progress: Math.round(p.progress_percent || 0),
        milestonesCount: p.milestones_count || p.milestones?.length || 0,
      }));

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
      {/* Table Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f95716] flex items-center justify-center shrink-0">
            <FileCode2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Priority Projects in Flight
            </h3>
            <p className="text-[10.5px] text-slate-400">
              Active high & critical priority deliveries requiring executive oversight
            </p>
          </div>
        </div>

        <Link
          to={`/app/${slug}/projects`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#f95716] transition-colors"
        >
          <span>All Projects</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 px-3">
                <span className="flex items-center gap-1">
                  PROJECT <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="pb-3 px-3">
                <span className="flex items-center gap-1">
                  PROJECT MANAGER <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="pb-3 px-3">
                <span className="flex items-center gap-1">
                  PRIORITY <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="pb-3 px-3">
                <span className="flex items-center gap-1">
                  PROGRESS <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="pb-3 px-3">
                <span className="flex items-center gap-1">
                  MILESTONES <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="pb-3 px-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayProjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <FolderKanban className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No active priority projects in flight</p>
                    <p className="text-[11px] text-slate-400">Create a project to begin tracking milestones and progress.</p>
                    <Link
                      to={`/app/${slug}/projects/create`}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F95716] text-white text-xs font-bold hover:bg-[#e0480c] transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Project
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              displayProjects.map((proj) => (
              <tr
                key={proj.id}
                className="hover:bg-slate-50/60 transition-colors group"
              >
                {/* Project Name & Code */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-200/50 text-[#f95716] flex items-center justify-center shrink-0">
                      <FileCode2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-[#f95716] transition-colors">
                        {proj.name}
                      </h4>
                      <p className="text-[10.5px] text-slate-400 font-mono">
                        {proj.code} &bull; {proj.category}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Manager */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#e85a1a] to-[#fa8136] text-white text-[10px] font-bold flex items-center justify-center shadow-2xs">
                      {proj.managerAvatarLetter}
                    </span>
                    <span className="text-slate-700 font-medium">{proj.managerName}</span>
                  </div>
                </td>

                {/* Priority */}
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 border border-rose-100 text-rose-600">
                    {proj.priority}
                  </span>
                </td>

                {/* Progress Bar */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5 min-w-[120px]">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">
                      {proj.progress}%
                    </span>
                  </div>
                </td>

                {/* Milestones */}
                <td className="py-3 px-3">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {proj.milestonesCount} {proj.milestonesCount === 1 ? 'milestone' : 'milestones'}
                  </span>
                </td>

                {/* Action Button */}
                <td className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Workspace</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

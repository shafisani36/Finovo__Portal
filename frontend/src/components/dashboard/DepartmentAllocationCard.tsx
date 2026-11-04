import React from 'react';
import { Network, ChevronRight, ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

interface DepartmentAllocationItem {
  id: string;
  name: string;
  members: number;
  percentage: number;
  color?: string;
}

interface DepartmentAllocationCardProps {
  departments?: DepartmentAllocationItem[];
}

export const DepartmentAllocationCard: React.FC<DepartmentAllocationCardProps> = ({
  departments = [
    { id: '1', name: 'Core Platform & Engineering', members: 42, percentage: 48, color: 'bg-gradient-to-r from-[#e85a1a] to-[#fa8136]' },
    { id: '2', name: 'Product Design & Experience', members: 18, percentage: 21, color: 'bg-blue-500' },
    { id: '3', name: 'DevSecOps & Cloud Operations', members: 14, percentage: 16, color: 'bg-purple-500' },
    { id: '4', name: 'Client Solutions & Success', members: 8, percentage: 9, color: 'bg-emerald-500' },
    { id: '5', name: 'Quality Assurance & Reliability', members: 5, percentage: 6, color: 'bg-amber-500' },
  ],
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Workforce Allocation by Department
            </h3>
            <p className="text-[10.5px] text-slate-400">
              Headcount capacity deployed across business units
            </p>
          </div>
        </div>

        <Link
          to={`/app/${companySlug || 'default'}/departments`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#f95716] transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Progress Bars List */}
      <div className="space-y-3.5 py-1">
        {departments.map((dept) => (
          <div key={dept.id} className="space-y-1.5 group cursor-pointer">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 group-hover:text-[#f95716] transition-colors truncate max-w-[240px]">
                {dept.name}
              </span>
              <div className="flex items-center gap-2 text-slate-400 text-[11px] shrink-0">
                <span className="font-medium">
                  {dept.members} members &bull; {dept.percentage}%
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#f95716] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            {/* Progress Track */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dept.color || 'bg-slate-300'
                }`}
                style={{ width: `${Math.max(dept.percentage, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

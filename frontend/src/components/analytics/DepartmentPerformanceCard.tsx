import React, { useState } from 'react';
import { Building2, Users, ArrowUpRight, CheckCircle2, ChevronRight, BarChart2 } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface DepartmentPerformanceCardProps {
  range: TimeRange;
}

export const DepartmentPerformanceCard: React.FC<DepartmentPerformanceCardProps> = ({ range }) => {
  const [sortBy, setSortBy] = useState<'efficiency' | 'hours'>('efficiency');

  const departments = [
    {
      id: 'eng',
      name: 'Engineering & Core Platform',
      headcount: 18,
      hours: 542.5,
      billableRatio: 94.2,
      efficiency: 96.8,
      lead: 'Alex Rivers',
      color: 'from-[#f95716] to-[#fb923c]',
      trend: '+4.2%',
    },
    {
      id: 'secops',
      name: 'DevSecOps & Cloud Architecture',
      headcount: 6,
      hours: 218.0,
      billableRatio: 96.5,
      efficiency: 97.4,
      lead: 'Marcus Vance',
      color: 'from-[#ea580c] to-[#f97316]',
      trend: '+3.8%',
    },
    {
      id: 'design',
      name: 'Product Experience & Design',
      headcount: 8,
      hours: 268.4,
      billableRatio: 91.8,
      efficiency: 94.5,
      lead: 'Elena Rostova',
      color: 'from-[#f97316] to-[#fdba74]',
      trend: '+5.1%',
    },
    {
      id: 'solutions',
      name: 'Client Solutions & Delivery',
      headcount: 11,
      hours: 236.2,
      billableRatio: 89.4,
      efficiency: 93.2,
      lead: 'Sarah Jenkins',
      color: 'from-[#fb923c] to-[#fed7aa]',
      trend: '+1.9%',
    },
    {
      id: 'qa',
      name: 'Quality Assurance & Automation',
      headcount: 7,
      hours: 163.4,
      billableRatio: 88.0,
      efficiency: 91.6,
      lead: 'Taro Tanaka',
      color: 'from-[#fdba74] to-[#ffedd5]',
      trend: '+2.4%',
    },
  ];

  const sortedDepts = [...departments].sort((a, b) => {
    if (sortBy === 'efficiency') return b.efficiency - a.efficiency;
    return b.hours - a.hours;
  });

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 flex flex-col justify-between space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <Building2 className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Department Performance
            </h3>
            <p className="text-xs text-slate-400">Headcount utilization and output rating</p>
          </div>
        </div>

        {/* Sort Pill */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSortBy('efficiency')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              sortBy === 'efficiency' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Efficiency
          </button>
          <button
            type="button"
            onClick={() => setSortBy('hours')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              sortBy === 'hours' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Hours
          </button>
        </div>
      </div>

      {/* Department Rows */}
      <div className="space-y-4">
        {sortedDepts.map((dept) => (
          <div
            key={dept.id}
            className="group p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 hover:border-orange-200/60 bg-slate-50/40 hover:bg-white hover:shadow-[0_4px_16px_rgba(249,87,22,0.06)] transition-all duration-200"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#f95716] transition-colors">
                  {dept.name}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200/60 shadow-2xs">
                  <Users className="w-3 h-3 text-slate-400" />
                  {dept.headcount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">{dept.efficiency}%</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                  {dept.trend}
                </span>
              </div>
            </div>

            {/* Gradient progress bar */}
            <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${dept.color} transition-all duration-500`}
                style={{ width: `${dept.efficiency}%` }}
              />
            </div>

            {/* Metadata Footer */}
            <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-slate-400">
              <span>{dept.hours} total hrs logged</span>
              <span>{dept.billableRatio}% billable ratio</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footnote */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-600">Company Average: 94.7%</span>
        <span className="text-emerald-600 font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          All Depts Exceeding Target
        </span>
      </div>
    </div>
  );
};

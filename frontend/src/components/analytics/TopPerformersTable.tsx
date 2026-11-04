import React, { useState } from 'react';
import { Award, Search, Filter, ExternalLink, ArrowUpRight, Flame, CheckCircle, Clock } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface TopPerformersTableProps {
  range: TimeRange;
}

export const TopPerformersTable: React.FC<TopPerformersTableProps> = ({ range }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const performers = [
    {
      id: 'usr_1',
      name: 'Alex Rivers',
      email: 'alex.rivers@bitspark.io',
      role: 'Staff Principal Engineer',
      dept: 'Engineering',
      hours: 44.5,
      billable: 42.0,
      activityScore: 98.2,
      deepWorkHours: 34.2,
      primaryTool: 'VS Code & Go',
      status: 'active',
      avatarColor: 'bg-orange-500',
    },
    {
      id: 'usr_2',
      name: 'Elena Rostova',
      email: 'elena.r@bitspark.io',
      role: 'Lead UX Architect',
      dept: 'Design',
      hours: 41.8,
      billable: 39.5,
      activityScore: 96.5,
      deepWorkHours: 31.0,
      primaryTool: 'Figma & Design Tokens',
      status: 'deep_work',
      avatarColor: 'bg-amber-500',
    },
    {
      id: 'usr_3',
      name: 'Marcus Vance',
      email: 'm.vance@bitspark.io',
      role: 'DevSecOps Specialist',
      dept: 'Cloud & Infra',
      hours: 43.2,
      billable: 41.8,
      activityScore: 97.8,
      deepWorkHours: 32.5,
      primaryTool: 'Kubernetes & Terraform',
      status: 'active',
      avatarColor: 'bg-emerald-600',
    },
    {
      id: 'usr_4',
      name: 'Sarah Jenkins',
      email: 'sarah.j@bitspark.io',
      role: 'Client Solutions Director',
      dept: 'Delivery',
      hours: 40.0,
      billable: 38.2,
      activityScore: 94.0,
      deepWorkHours: 28.4,
      primaryTool: 'Linear & Client Hub',
      status: 'active',
      avatarColor: 'bg-blue-600',
    },
    {
      id: 'usr_5',
      name: 'Taro Tanaka',
      email: 'taro.t@bitspark.io',
      role: 'Senior QA Automation Lead',
      dept: 'Quality',
      hours: 39.4,
      billable: 36.8,
      activityScore: 93.5,
      deepWorkHours: 27.8,
      primaryTool: 'Playwright & Jest',
      status: 'offline',
      avatarColor: 'bg-purple-600',
    },
  ];

  const filtered = performers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'all' || p.dept.toLowerCase() === selectedDept.toLowerCase();
    return matchesSearch && matchesDept;
  });

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 space-y-4">
      {/* Table Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <Award className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Talent Performance &amp; Focus Index
            </h3>
            <p className="text-xs text-slate-400">Individual time logged, activity cadence, and flow hours</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#f95716] focus:ring-2 focus:ring-[#f95716]/10 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto no-scrollbar border border-slate-100 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Talent Member</th>
              <th className="py-3 px-4">Hours Logged</th>
              <th className="py-3 px-4">Activity Index</th>
              <th className="py-3 px-4">Deep Focus</th>
              <th className="py-3 px-4">Primary Tool</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-orange-50/30 transition-colors group">
                {/* Member Info */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs ${item.avatarColor}`}
                    >
                      {item.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-[#f95716] transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400">{item.role}</p>
                    </div>
                  </div>
                </td>

                {/* Hours Logged */}
                <td className="py-3.5 px-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{item.hours}h</span>
                      <span className="text-[10px] text-slate-400">({item.billable}h billable)</span>
                    </div>
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#f95716] h-full rounded-full"
                        style={{ width: `${(item.billable / item.hours) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Activity Score */}
                <td className="py-3.5 px-4">
                  <div className="inline-flex items-center gap-1 font-black text-slate-800 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                    <span>{item.activityScore}%</span>
                  </div>
                </td>

                {/* Deep Focus */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <Flame className="w-3.5 h-3.5 text-[#f95716]" />
                    <span>{item.deepWorkHours} hrs</span>
                  </div>
                </td>

                {/* Primary Tool */}
                <td className="py-3.5 px-4 font-medium text-slate-600">
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                    {item.primaryTool}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 text-right">
                  {item.status === 'active' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  )}
                  {item.status === 'deep_work' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f95716] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
                      <Flame className="w-3 h-3 text-[#f95716]" />
                      Deep Flow
                    </span>
                  )}
                  {item.status === 'offline' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                      Offline
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

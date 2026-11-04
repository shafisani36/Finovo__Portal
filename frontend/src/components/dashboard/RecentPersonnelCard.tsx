import React from 'react';
import {
  Users,
  ArrowRight,
  UserPlus,
  Building2,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export interface PersonnelItem {
  id: string;
  name: string;
  role: string;
  department: string;
  status: string;
  avatarLetter: string;
}

interface RecentPersonnelCardProps {
  personnel?: PersonnelItem[];
  totalWorkforce?: number;
  departmentCount?: number;
  roleCount?: number;
  onAddEmployeeClick?: () => void;
}

export const RecentPersonnelCard: React.FC<RecentPersonnelCardProps> = ({
  personnel = [
    {
      id: '1',
      name: 'Elena Rostova',
      role: 'Lead Product Strategist',
      department: 'Enterprise Products',
      status: 'Active',
      avatarLetter: 'E',
    },
    {
      id: '2',
      name: 'Marcus Wright',
      role: 'Principal Cloud Architect',
      department: 'Infrastructure Core',
      status: 'Active',
      avatarLetter: 'M',
    },
    {
      id: '3',
      name: 'Priya Sharma',
      role: 'Senior Security Engineer',
      department: 'DevSecOps & Governance',
      status: 'Active',
      avatarLetter: 'P',
    },
    {
      id: '4',
      name: 'David Chen',
      role: 'Senior Full-Stack Engineer',
      department: 'Client Platforms',
      status: 'Active',
      avatarLetter: 'D',
    },
  ],
  totalWorkforce = 87,
  departmentCount = 5,
  roleCount = 10,
  onAddEmployeeClick,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Recent Personnel Onboardings
            </h3>
            <p className="text-[10.5px] text-slate-400">
              Newest talents joined across departments
            </p>
          </div>
        </div>

        <Link
          to={`/app/${companySlug || 'default'}/employees`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#f95716] transition-colors"
        >
          <span>Directory</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Personnel List */}
      <div className="space-y-1.5 py-0.5">
        {personnel.map((person) => (
          <div
            key={person.id}
            className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                {person.avatarLetter}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 group-hover:text-[#f95716] transition-colors truncate">
                  {person.name}
                </p>
                <p className="text-[10.5px] text-slate-400 truncate">
                  {person.role} &bull; {person.department}
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              {person.status}
            </span>
          </div>
        ))}
      </div>

      {/* Grow Your Team Promotional Banner Card */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500/[0.07] via-amber-500/[0.04] to-white border border-orange-200/50 p-4 space-y-3 relative overflow-hidden">
        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-1 max-w-[240px]">
            <h4 className="text-xs font-black text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Grow Your Team
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-relaxed">
              Build high-performing squads and drive enterprise impact together.
            </p>
          </div>

          <Link
            to={`/app/${companySlug || 'default'}/employees`}
            onClick={onAddEmployeeClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:opacity-95 text-white font-bold text-[11px] shadow-sm shadow-orange-500/25 transition-all shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </Link>
        </div>

        {/* Quick Stats Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-orange-200/40 text-[10px] text-slate-500 font-medium relative z-10">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-[#f95716]" />
            <span>{totalWorkforce} Workforce</span>
          </div>
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-[#f95716]" />
            <span>{departmentCount} Depts</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#f95716]" />
            <span>{roleCount} Roles</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>100% Policy</span>
          </div>
        </div>

        {/* Decorative Graphic Element */}
        <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
          <Users className="w-24 h-24 text-orange-500" />
        </div>
      </div>
    </div>
  );
};

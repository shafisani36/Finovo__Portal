import React from 'react';
import { ShieldCheck, ArrowRight, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export interface AuditStreamItem {
  id: string;
  action: string;
  user: string;
  performedBy: string;
  timestamp: string;
  type: 'Login' | 'Logout' | 'Security' | 'Compliance' | 'Approval';
}

interface AuditStreamCardProps {
  logs?: AuditStreamItem[];
}

export const AuditStreamCard: React.FC<AuditStreamCardProps> = ({
  logs = [
    {
      id: '1',
      action: 'Session Authenticated',
      user: 'SSO Okta Enterprise',
      performedBy: 'Sarah Jenkins (Director Eng)',
      timestamp: 'Today, 09:42 AM',
      type: 'Login',
    },
    {
      id: '2',
      action: 'RBAC Role Assigned',
      user: 'David Chen (Full-Stack)',
      performedBy: 'Alex Vance (VP Operations)',
      timestamp: 'Today, 08:30 AM',
      type: 'Security',
    },
    {
      id: '3',
      action: 'Secret Key Rotated',
      user: 'PCI-DSS Vault Key #4',
      performedBy: 'SecOps Automated Engine',
      timestamp: 'Today, 06:15 AM',
      type: 'Compliance',
    },
    {
      id: '4',
      action: 'Milestone Approved',
      user: 'PRJ-1042 Beta Launch',
      performedBy: 'Elena Rostova (Client Rep)',
      timestamp: 'Oct 11, 09:04 PM',
      type: 'Approval',
    },
    {
      id: '5',
      action: 'MFA Token Enrolled',
      user: 'Hardware Security Key',
      performedBy: 'Priya Sharma (SecOps)',
      timestamp: 'Oct 11, 02:22 PM',
      type: 'Security',
    },
    {
      id: '6',
      action: 'Session Terminated',
      user: 'Inactivity Guard Policy',
      performedBy: 'Finovo Policy Engine',
      timestamp: 'Oct 11, 12:00 PM',
      type: 'Logout',
    },
  ],
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              System Audit Stream
            </h3>
            <p className="text-[10.5px] text-slate-400">
              Immutable chronological record of administrative operations
            </p>
          </div>
        </div>

        <Link
          to={`/app/${companySlug || 'default'}/audit`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#f95716] transition-colors"
        >
          <span>Full Log</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-3 space-y-3 py-1">
        {/* Timeline connecting vertical line */}
        <div className="absolute left-6 top-3 bottom-3 w-[1.5px] bg-slate-100" />

        {logs.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 relative z-10 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Dot / Node Icon */}
              <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-[#f95716] group-hover:text-[#f95716] transition-colors">
                <FileText className="w-3 h-3" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 tracking-tight truncate">
                  {item.action} &bull; <span className="font-medium text-slate-600">{item.user}</span>
                </p>
                <p className="text-[10.5px] text-slate-400 truncate">
                  By {item.performedBy} &bull; {item.timestamp}
                </p>
              </div>
            </div>

            {/* Event Pill */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                item.type === 'Login'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : item.type === 'Logout'
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : item.type === 'Security'
                  ? 'bg-purple-50 text-purple-600 border border-purple-100'
                  : item.type === 'Compliance'
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-orange-50 text-[#f95716] border border-orange-100'
              }`}
            >
              {item.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldCheck, Shield, Users, Key, ChevronRight } from 'lucide-react';
import { RoleItem } from './types';

interface RoleCardProps {
  role: RoleItem;
  onInspect: (role: RoleItem) => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, onInspect }) => {
  const isSystem = role.is_system;

  return (
    <div
      onClick={() => onInspect(role)}
      className="group relative bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 hover:border-orange-300/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer min-w-0"
    >
      <div className="space-y-2.5 min-w-0">
        {/* Top Header: Icon, Name & Badges */}
        <div className="flex items-start justify-between gap-2.5 min-w-0">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 border shadow-2xs mt-0.5 ${
                isSystem
                  ? 'bg-orange-500/10 text-[#F95716] border-orange-200/70'
                  : 'bg-blue-500/10 text-blue-600 border-blue-200/70'
              }`}
            >
              {isSystem ? (
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Shield className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-[#F95716] transition-colors break-words line-clamp-1"
                title={role.name}
              >
                {role.name}
              </h3>

              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="font-mono text-[9.5px] sm:text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-semibold truncate max-w-[130px]">
                  {role.slug}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-semibold border ${
                    isSystem
                      ? 'bg-slate-100 text-slate-700 border-slate-200/70'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                  }`}
                >
                  {isSystem ? 'System Built-In' : 'Custom Tenant'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11.5px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px] break-words">
          {role.description || (
            <span className="text-slate-300 italic">
              Custom workspace role configured with specific resource access rights.
            </span>
          )}
        </p>
      </div>

      {/* Footer Metrics & Inspect CTA */}
      <div className="mt-3.5 sm:mt-4 pt-3 sm:pt-3.5 border-t border-slate-100/80 flex items-center justify-between text-xs min-w-0">
        <div className="flex items-center gap-3 text-slate-500 min-w-0">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 font-mono text-[11px] shrink-0">
            <Key className="w-3 h-3 text-slate-400" />
            <span>{role.permissions_count} Perms</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-[11px] truncate">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{role.active_members_count} assigned</span>
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(role);
          }}
          className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#F95716] group-hover:translate-x-0.5 transition-transform shrink-0"
        >
          <span>Inspect</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

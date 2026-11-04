import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Key,
  ShieldCheck,
  ShieldAlert,
  Infinity as InfinityIcon,
  XCircle,
  Filter,
} from 'lucide-react';
import { TemporaryGrant } from './types';

interface TemporaryGrantsTableProps {
  grants: TemporaryGrant[];
  onRevokeGrant: (grantId: number) => void;
  onOpenIssueModal?: () => void;
}

export const TemporaryGrantsTable: React.FC<TemporaryGrantsTableProps> = ({
  grants,
  onRevokeGrant,
  onOpenIssueModal,
}) => {
  const [filterMode, setFilterMode] = useState<
    'all' | 'active' | 'grant' | 'restrict' | 'permanent' | 'expired'
  >('all');
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Live timer tick every 5 seconds for precise duration countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getDurationStatus = React.useCallback((g: TemporaryGrant) => {
    if (g.is_permanent) {
      return {
        isPermanent: true,
        label: 'Forever (Permanent)',
        isExpired: false,
        remainingText: 'No expiration',
      };
    }

    if (!g.expires_at) {
      return {
        isPermanent: true,
        label: 'Permanent',
        isExpired: false,
        remainingText: 'Indefinite',
      };
    }

    const expMs = new Date(g.expires_at).getTime();
    const diff = expMs - currentTime;

    if (diff <= 0) {
      return {
        isPermanent: false,
        label: new Date(g.expires_at).toLocaleString(),
        isExpired: true,
        remainingText: 'Duration ended',
      };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let remainingText = '';
    if (days > 0) {
      remainingText = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      remainingText = `${hours}h ${minutes}m left`;
    } else {
      remainingText = `${Math.max(1, minutes)}m left`;
    }

    return {
      isPermanent: false,
      label: new Date(g.expires_at).toLocaleString(),
      isExpired: false,
      remainingText: `Expires in ${remainingText}`,
    };
  }, [currentTime]);

  // Filtered grants
  const filteredGrants = useMemo(() => {
    return grants.filter((g) => {
      const dur = getDurationStatus(g);
      const isGrant = (g.grant_type ?? 'grant') === 'grant';
      const isRestrict = g.grant_type === 'restrict';
      const effectiveActive = g.is_active && !dur.isExpired;

      if (filterMode === 'active') return effectiveActive;
      if (filterMode === 'grant') return isGrant;
      if (filterMode === 'restrict') return isRestrict;
      if (filterMode === 'permanent') return g.is_permanent;
      if (filterMode === 'expired') return dur.isExpired || (!g.is_active && !g.revoked_at);
      return true;
    });
  }, [grants, filterMode, getDurationStatus]);

  // Counts for pills
  const counts = useMemo(() => {
    let active = 0;
    let grantsCount = 0;
    let restrictsCount = 0;
    let permanentCount = 0;
    let expiredCount = 0;

    for (const g of grants) {
      const dur = getDurationStatus(g);
      const isGrant = (g.grant_type ?? 'grant') === 'grant';
      const isRestrict = g.grant_type === 'restrict';
      const effectiveActive = g.is_active && !dur.isExpired;

      if (effectiveActive) active++;
      if (isGrant) grantsCount++;
      if (isRestrict) restrictsCount++;
      if (g.is_permanent) permanentCount++;
      if (dur.isExpired || (!g.is_active && !g.revoked_at)) expiredCount++;
    }

    return {
      all: grants.length,
      active,
      grant: grantsCount,
      restrict: restrictsCount,
      permanent: permanentCount,
      expired: expiredCount,
    };
  }, [grants, getDurationStatus]);

  return (
    <div className="space-y-4">
      {/* Information Header Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white border border-amber-200/80 rounded-2xl flex items-start justify-between gap-3 text-xs text-amber-950">
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">
              Access Overrides &amp; Security Policies (Elevated Grants &amp; Restrictions)
            </p>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              Manage time-bound or permanent elevated allowances and explicit permission restrictions. Time-bound permissions automatically terminate immediately when their duration window concludes. Explicit restrictions override all baseline role permissions.
            </p>
          </div>
        </div>

        {onOpenIssueModal && (
          <button
            type="button"
            onClick={onOpenIssueModal}
            className="shrink-0 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            + Issue Policy Override
          </button>
        )}
      </div>

      {/* Filter Tabs / Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" /> Filter By:
        </span>
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Policies ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('active')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'active'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Active Now ({counts.active})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('grant')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'grant'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Grants / ALLOW ({counts.grant})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('restrict')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'restrict'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Restrictions / DENY ({counts.restrict})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('permanent')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'permanent'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Permanent / Forever ({counts.permanent})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('expired')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
            filterMode === 'expired'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Expired ({counts.expired})
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6 pr-3">Target Member</th>
                <th className="py-3.5 px-3">Policy Action</th>
                <th className="py-3.5 px-3">Permission Operation</th>
                <th className="py-3.5 px-3">Scope</th>
                <th className="py-3.5 px-3">Duration &amp; Expiry</th>
                <th className="py-3.5 px-3">Audit Justification</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredGrants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                    <Key className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-medium text-slate-600">No matching security overrides found</p>
                    <p className="text-[11px] text-slate-400">
                      Use the "+ Issue Policy Override" button to create an elevated grant or restriction.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredGrants.map((g) => {
                  const initials = getInitials(g.member.user_name);
                  const isRestrict = g.grant_type === 'restrict';
                  const dur = getDurationStatus(g);
                  const isRevoked = !g.is_active && !!g.revoked_at;
                  const effectivelyActive = g.is_active && !dur.isExpired;

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Target Member */}
                      <td className="py-3.5 pl-6 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center font-mono shrink-0 shadow-2xs ${
                              isRestrict
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {g.member.user_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {g.member.user_email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Policy Action Mode (ALLOW vs DENY) */}
                      <td className="py-3.5 px-3">
                        {isRestrict ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>DENY (Restrict)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>ALLOW (Grant)</span>
                          </span>
                        )}
                      </td>

                      {/* Permission Key */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                          {g.permission_key || g.role_name || 'Wildcard Access'}
                        </span>
                      </td>

                      {/* Scope */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                          {g.scope_type}
                          {g.scope_id ? ` #${g.scope_id}` : ''}
                        </span>
                      </td>

                      {/* Duration & Expiry */}
                      <td className="py-3.5 px-3">
                        {dur.isPermanent ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-mono">
                            <InfinityIcon className="w-3 h-3 text-indigo-600" />
                            Permanent (Forever)
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-slate-700 text-xs font-medium block">
                              {dur.label}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-semibold ${
                                dur.isExpired ? 'text-slate-400' : 'text-amber-600'
                              }`}
                            >
                              {dur.remainingText}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-3 text-slate-500 max-w-xs truncate" title={g.reason}>
                        {g.reason}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {effectivelyActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Active
                          </span>
                        ) : isRevoked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                            Ended (Duration)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-6 text-right">
                        {effectivelyActive ? (
                          <button
                            type="button"
                            onClick={() => onRevokeGrant(g.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

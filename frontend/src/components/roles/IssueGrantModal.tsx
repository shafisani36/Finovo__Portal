import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Key,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { CustomDropdown } from '../ui/CustomDropdown';
import { ModuleCatalog, WorkspaceMember } from './types';

interface IssueGrantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    membership_id: number;
    permission_key: string;
    grant_type: 'grant' | 'restrict';
    is_permanent: boolean;
    duration_hours: number;
    scope_type: string;
    reason: string;
  }) => Promise<void>;
  members: WorkspaceMember[];
  catalog: ModuleCatalog[];
}

export const IssueGrantModal: React.FC<IssueGrantModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  members,
  catalog,
}) => {
  const [policyType, setPolicyType] = useState<'grant' | 'restrict'>('grant');
  const [membershipId, setMembershipId] = useState<string>('');
  const [permissionKey, setPermissionKey] = useState<string>('');
  const [durationSelection, setDurationSelection] = useState<string>('4'); // '1' | '4' | '8' | '24' | '72' | '168' | '720' | 'forever'
  const [scopeType, setScopeType] = useState<string>('organization');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPolicyType('grant');
      setMembershipId(members.length > 0 ? String(members[0].id) : '');
      setPermissionKey('payroll.view');
      setDurationSelection('4');
      setScopeType('organization');
      setReason('');
      setError(null);
    }
  }, [isOpen, members]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  // Flattened Permission Options from catalog
  const permissionOptions = useMemo(() => {
    const list: Array<{ value: string; label: string; description?: string; badge?: string }> = [];
    for (const mod of catalog) {
      for (const p of mod.permissions) {
        list.push({
          value: p.key,
          label: p.key,
          description: `${mod.module_title} • ${p.name}`,
          badge: mod.module,
        });
      }
    }
    return list;
  }, [catalog]);

  const memberOptions = useMemo(() => {
    return members.map((m) => ({
      value: String(m.id),
      label: m.user?.name || `Member #${m.id}`,
      description: m.user?.email,
      badge: `ID: ${m.id}`,
    }));
  }, [members]);

  const isPermanent = durationSelection === 'forever';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membershipId || !permissionKey || !reason.trim()) {
      setError('Member, permission key, and compliance justification reason are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        membership_id: parseInt(membershipId, 10),
        permission_key: permissionKey,
        grant_type: policyType,
        is_permanent: isPermanent,
        duration_hours: isPermanent ? 0 : parseInt(durationSelection, 10),
        scope_type: scopeType,
        reason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not issue security policy override.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isRestrict = policyType === 'restrict';

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={() => {
          if (!loading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className={`px-5 sm:px-6 py-4.5 border-b border-slate-100 flex items-center justify-between transition-colors ${
            isRestrict
              ? 'bg-gradient-to-r from-rose-50/70 via-rose-50/30 to-white'
              : 'bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-white'
          } shrink-0`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md shrink-0 transition-colors ${
                isRestrict
                  ? 'bg-rose-100 text-rose-700 border border-rose-300 shadow-rose-500/10'
                  : 'bg-amber-100 text-amber-700 border border-amber-300 shadow-amber-500/10'
              }`}
            >
              {isRestrict ? (
                <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Key className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {isRestrict ? 'Issue Permission Restriction' : 'Issue Elevated Access Grant'}
              </h2>
              <p className="text-xs text-slate-500">
                {isRestrict
                  ? 'Explicitly restrict or deny a permission, overriding role assignments'
                  : 'Time-bound or permanent elevated authorization override'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* POLICY ACTION / MODE SELECTOR */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Policy Action Mode <span className="text-[#F95716]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Grant (ALLOW) */}
              <button
                type="button"
                onClick={() => setPolicyType('grant')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  !isRestrict
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ALLOW (Grant)
                  </span>
                  {!isRestrict && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Grant permission beyond standard role assignments
                </p>
              </button>

              {/* Option 2: Restrict (DENY) */}
              <button
                type="button"
                onClick={() => setPolicyType('restrict')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isRestrict
                    ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-rose-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    DENY (Restrict)
                  </span>
                  {isRestrict && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Explicitly block permission, overriding any role
                </p>
              </button>
            </div>
          </div>

          {/* Member Dropdown */}
          <div>
            <CustomDropdown
              label="Target Member"
              placeholder="Select Workspace Member"
              value={membershipId}
              onChange={setMembershipId}
              options={memberOptions}
              searchable={memberOptions.length > 4}
              searchPlaceholder="Search member name or email..."
              fullWidth
              size="md"
            />
          </div>

          {/* Permission Key Dropdown */}
          <div>
            <CustomDropdown
              label={isRestrict ? 'Permission Operation to Restrict' : 'Elevated Permission Operation'}
              placeholder="Select Permission Key"
              value={permissionKey}
              onChange={setPermissionKey}
              options={permissionOptions}
              searchable
              searchPlaceholder="Search permission key (e.g. payroll, roles)..."
              fullWidth
              size="md"
            />
          </div>

          {/* Duration & Scope Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <CustomDropdown
                label="Duration Window"
                value={durationSelection}
                onChange={setDurationSelection}
                options={[
                  { value: '1', label: '1 Hour', description: 'Urgent task incident window' },
                  { value: '4', label: '4 Hours (Half Day)', description: 'Standard shift escalation' },
                  { value: '8', label: '8 Hours (Full Shift)', description: 'Daily operational coverage' },
                  { value: '24', label: '24 Hours (1 Day)', description: 'Full day authorization' },
                  { value: '72', label: '72 Hours (3 Days)', description: 'Extended weekend audit' },
                  { value: '168', label: '7 Days (Sprint)', description: 'Weekly project cycle' },
                  { value: '720', label: '30 Days (Month)', description: 'Extended monthly assignment' },
                  {
                    value: 'forever',
                    label: 'Permanent (Forever)',
                    description: 'Indefinite until manually revoked',
                  },
                ]}
                fullWidth
                size="md"
              />
            </div>

            <div>
              <CustomDropdown
                label="Authorization Scope"
                value={scopeType}
                onChange={setScopeType}
                options={[
                  { value: 'organization', label: 'Organization-Wide', description: 'All tenant facilities' },
                  { value: 'department', label: 'Departmental Scope', description: 'Target department only' },
                  { value: 'team', label: 'Team Level Scope', description: 'Designated working group' },
                ]}
                fullWidth
                size="md"
              />
            </div>
          </div>

          {/* DURATION EXPLANATION CALLOUT */}
          {isPermanent ? (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-indigo-900">
              <InfinityIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="text-[11px] leading-tight font-medium">
                <strong>Permanent Override (Forever):</strong> This {isRestrict ? 'restriction' : 'grant'} will never expire automatically. It will remain in active effect until manually revoked.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-slate-700">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="text-[11px] leading-tight">
                <strong>Time-Bound Duration:</strong> This {isRestrict ? 'restriction' : 'grant'} will automatically terminate precisely after <strong>{durationSelection} hour(s)</strong>.
              </div>
            </div>
          )}

          {/* Justification Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Compliance &amp; Security Justification <span className="text-[#F95716]">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder={
                isRestrict
                  ? 'Explain security reason, investigation code, or policy reason for restriction...'
                  : 'Explain audit reason, ticket reference, or incident code...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !membershipId || !permissionKey || !reason.trim()}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer ${
                isRestrict
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-rose-500/20'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Applying Policy...</span>
                </>
              ) : isRestrict ? (
                <>
                  <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
                  <span>Apply Restriction (DENY)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  <span>Issue Access Grant (ALLOW)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

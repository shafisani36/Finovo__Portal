import React, { useState, useMemo } from 'react';
import {
  Zap,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Terminal,
} from 'lucide-react';
import { CustomDropdown } from '../ui/CustomDropdown';
import { AccessPreviewResult, ModuleCatalog, WorkspaceMember } from './types';

interface AccessSimulatorCardProps {
  members: WorkspaceMember[];
  catalog: ModuleCatalog[];
  onEvaluate: (params: {
    membership_id: number;
    permission_key: string;
    scope_type: string;
    scope_id: number | null;
  }) => Promise<AccessPreviewResult>;
}

export const AccessSimulatorCard: React.FC<AccessSimulatorCardProps> = ({
  members,
  catalog,
  onEvaluate,
}) => {
  const [membershipId, setMembershipId] = useState<string>(
    members.length > 0 ? String(members[0].id) : '1'
  );
  const [permissionKey, setPermissionKey] = useState<string>('departments.update');
  const [scopeType, setScopeType] = useState<string>('department');
  const [scopeId, setScopeId] = useState<string>('1');
  const [evaluating, setEvaluating] = useState(false);
  const [previewResult, setPreviewResult] = useState<AccessPreviewResult | null>(null);

  // Flattened Permission Options
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

  const handleRunSimulation = async () => {
    if (!membershipId || !permissionKey) return;
    setEvaluating(true);
    try {
      const res = await onEvaluate({
        membership_id: parseInt(membershipId, 10),
        permission_key: permissionKey,
        scope_type: scopeType,
        scope_id: scopeId ? parseInt(scopeId, 10) : null,
      });
      setPreviewResult(res);
    } catch {
      // Handled by parent
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Informative Banner */}
      <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
        <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Explainable Authorization Simulation (ABAC + RBAC Evaluation)</p>
          <p className="text-blue-800/90 text-[11px] mt-0.5 leading-relaxed">
            Test whether any workspace member holds authorization to perform a sensitive operation under specified resource scopes. The engine checks system roles, custom roles, active temporary grants, and Separation of Duties rules in real time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Col: Parameters Form */}
        <div className="lg:col-span-5 p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-sm text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Simulation Parameters
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-100">
              ABAC / RBAC
            </span>
          </div>

          <div>
            <CustomDropdown
              label="Evaluation Target Member"
              placeholder="Select Member"
              value={membershipId}
              onChange={setMembershipId}
              options={memberOptions}
              searchable={memberOptions.length > 4}
              searchPlaceholder="Search member name or email..."
              fullWidth
              size="md"
            />
          </div>

          <div>
            <CustomDropdown
              label="Operation Permission Key"
              placeholder="Select Permission Key"
              value={permissionKey}
              onChange={setPermissionKey}
              options={permissionOptions}
              searchable
              searchPlaceholder="Search key (e.g. payroll, departments)..."
              fullWidth
              size="md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <CustomDropdown
                label="Scope Type"
                value={scopeType}
                onChange={setScopeType}
                options={[
                  { value: 'organization', label: 'Organization' },
                  { value: 'department', label: 'Department' },
                  { value: 'team', label: 'Team' },
                  { value: 'self', label: 'Self Only' },
                ]}
                fullWidth
                size="md"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Resource ID <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={evaluating || !membershipId || !permissionKey}
            className="w-full py-2.5 bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:from-[#ea4d10] hover:to-[#db460c] text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {evaluating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating Policy Matrix...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Evaluate Authorization</span>
              </>
            )}
          </button>
        </div>

        {/* Right Col: Simulation Decision Result */}
        <div className="lg:col-span-7 p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Engine Authorization Verdict
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                Fail-Closed Architecture
              </span>
            </div>

            {previewResult ? (
              <div className="space-y-4 pt-3 animate-in fade-in duration-150">
                {/* Result Banner */}
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                    previewResult.is_allowed
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-200 text-rose-950'
                  }`}
                >
                  {previewResult.is_allowed ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">
                      <XCircle className="w-6 h-6 stroke-[2.2]" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-xs sm:text-sm">
                      {previewResult.is_allowed
                        ? previewResult.decision_tree?.rule === 'permanent_access_grant'
                          ? 'ACCESS GRANTED (PERMANENT OVERRIDE)'
                          : previewResult.decision_tree?.rule === 'temporary_access_grant'
                          ? 'ACCESS GRANTED (TIME-BOUND GRANT)'
                          : 'ACCESS GRANTED (ROLE PERMIT)'
                        : previewResult.decision_tree?.rule === 'explicit_permission_restriction'
                        ? 'ACCESS BLOCKED (EXPLICIT RESTRICTION OVERRIDE)'
                        : 'ACCESS DENIED (FAIL-CLOSED)'}
                    </div>
                    <div className="text-xs opacity-90 mt-0.5 leading-relaxed">
                      {previewResult.reason}
                    </div>
                  </div>
                </div>

                {/* Explainable Decision Tree JSON */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Explainable Policy Decision Trace</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      JSON Trace
                    </span>
                  </div>

                  <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 custom-scrollbar max-h-60">
                    {JSON.stringify(previewResult.decision_tree, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-14 text-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl my-3">
                <Terminal className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">
                  Ready to simulate access evaluation
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Select a team member and permission key, then click "Evaluate Authorization" to test the real-time policy pipeline.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Evaluated by AuthorizationEngine</span>
            <span className="text-emerald-600 font-bold">● Active RBAC/ABAC Gate</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  Users,
  Key,
  Search,
  RefreshCw,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';
import { CustomDropdown } from '../components/ui/CustomDropdown';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
} from '../components/portfolio';
import {
  RoleItem,
  PermissionItem,
  ModuleCatalog,
  TemporaryGrant,
  AccessPreviewResult,
  WorkspaceMember,
  RoleCard,
  RoleInspectModal,
  CreateRoleModal,
  IssueGrantModal,
  AccessSimulatorCard,
  TemporaryGrantsTable,
} from '../components/roles';

export const RolesPage: React.FC = () => {
  const { companySlug = 'bitspark-ops' } = useParams<{ companySlug: string }>();
  const { alert } = useConfirm();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core Data States
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [catalog, setCatalog] = useState<ModuleCatalog[]>([]);
  const [grants, setGrants] = useState<TemporaryGrant[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<string>('roles');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [page, setPage] = useState(1);
  const perPage = 9;

  // Modals State
  const [inspectingRole, setInspectingRole] = useState<{
    id: number;
    name: string;
    slug?: string;
    description?: string | null;
    permissions: PermissionItem[];
  } | null>(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Global Keyboard Shortcuts (N for new role, / for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreateRoleModal(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Roles, Permissions Catalog, Grants, and Workspace Members
  const fetchAccessData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (roles.length === 0) setLoading(true);

      try {
        const headers = { 'X-Company-Slug': companySlug };
        const [rolesRes, catRes, grantsRes, membersRes] = await Promise.all([
          api.get('/access/roles', { headers }),
          api.get('/permissions/catalog', { headers }),
          api.get('/access/grants', { headers }).catch(() => ({ data: { data: [] } })),
          api.get(`/companies/${companySlug}/members?per_page=100&status=active`).catch(() => ({ data: { data: [] } })),
        ]);

        const rList: RoleItem[] = rolesRes.data?.data || [];
        const cList: ModuleCatalog[] = catRes.data?.data?.modules || [];
        const gList: TemporaryGrant[] = grantsRes.data?.data || [];
        const mList: WorkspaceMember[] = membersRes.data?.data || membersRes.data?.members || [];

        setRoles(rList);
        setCatalog(cList);
        setGrants(gList);
        setMembers(mList);

        dataPipeline.set(`roles_${companySlug}`, rList);
      } catch (err: any) {
        console.error('Failed to load access control data:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companySlug, roles.length]
  );

  useEffect(() => {
    fetchAccessData();
  }, [fetchAccessData]);

  // Inspect Role Details Handler
  const handleInspectRole = async (role: RoleItem) => {
    try {
      const res = await api.get(`/access/roles/${role.id}`, {
        headers: { 'X-Company-Slug': companySlug },
      });
      const data = res.data?.data;
      setInspectingRole({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        permissions: data?.permissions || [],
      });
    } catch {
      await alert({
        title: 'Error',
        message: 'Could not load role permissions.',
        variant: 'danger',
      });
    }
  };

  // Create Role Handler
  const handleCreateRole = async (data: {
    name: string;
    description: string;
    permission_ids: number[];
  }) => {
    await api.post('/access/roles', data, {
      headers: { 'X-Company-Slug': companySlug },
    });
    await fetchAccessData(true);
    await alert({
      title: 'Role Created',
      message: `Custom role "${data.name}" has been established with ${data.permission_ids.length} operations.`,
      variant: 'success',
    });
  };

  // Issue Grant / Restriction Handler
  const handleIssueGrant = async (data: {
    membership_id: number;
    permission_key: string;
    grant_type: 'grant' | 'restrict';
    is_permanent: boolean;
    duration_hours: number;
    scope_type: string;
    reason: string;
  }) => {
    await api.post('/access/grants', data, {
      headers: { 'X-Company-Slug': companySlug },
    });
    await fetchAccessData(true);
    const isRestrict = data.grant_type === 'restrict';
    const durationLabel = data.is_permanent ? 'Permanent / Forever' : `${data.duration_hours} hour duration`;
    await alert({
      title: isRestrict ? 'Restriction Policy Applied' : 'Access Grant Issued',
      message: isRestrict
        ? `Permission "${data.permission_key}" is now explicitly restricted for this member (${durationLabel}).`
        : `Elevated access for "${data.permission_key}" granted successfully (${durationLabel}).`,
      variant: isRestrict ? 'warning' : 'success',
    });
  };

  // Revoke Grant Handler
  const handleRevokeGrant = async (grantId: number) => {
    try {
      await api.post(
        `/access/grants/${grantId}/revoke`,
        { reason: 'Revoked by workspace security administrator' },
        { headers: { 'X-Company-Slug': companySlug } }
      );
      await fetchAccessData(true);
      await alert({
        title: 'Grant Revoked',
        message: 'The elevated access privileges have been immediately terminated.',
        variant: 'success',
      });
    } catch {
      await alert({
        title: 'Revoke Failed',
        message: 'Could not revoke grant.',
        variant: 'danger',
      });
    }
  };

  // Evaluate Simulation Handler
  const handleEvaluateSimulation = async (params: {
    membership_id: number;
    permission_key: string;
    scope_type: string;
    scope_id: number | null;
  }): Promise<AccessPreviewResult> => {
    const res = await api.post('/access/preview', params, {
      headers: { 'X-Company-Slug': companySlug },
    });
    return res.data?.data;
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    if (roles.length === 0) return;

    const headers = ['ID', 'Role Name', 'Slug', 'Type', 'Permissions Count', 'Active Members', 'Description'];
    const rows = roles.map((r) => [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      r.slug,
      r.is_system ? 'System Built-In' : 'Custom Tenant',
      r.permissions_count,
      r.active_members_count,
      `"${(r.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `security_roles_${companySlug}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metric Stats
  const systemRolesCount = useMemo(() => roles.filter((r) => r.is_system).length, [roles]);
  const customRolesCount = useMemo(() => roles.filter((r) => !r.is_system).length, [roles]);
  const activeGrantsCount = useMemo(
    () => grants.filter((g) => g.is_active && (g.grant_type ?? 'grant') === 'grant').length,
    [grants]
  );
  const activeRestrictionsCount = useMemo(
    () => grants.filter((g) => g.is_active && g.grant_type === 'restrict').length,
    [grants]
  );
  const permanentOverridesCount = useMemo(
    () => grants.filter((g) => g.is_active && g.is_permanent).length,
    [grants]
  );
  const totalActiveOverrides = useMemo(() => grants.filter((g) => g.is_active).length, [grants]);
  const totalCatalogPerms = useMemo(
    () => catalog.reduce((acc, m) => acc + m.total_permissions, 0),
    [catalog]
  );

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    let result = [...roles];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.slug.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    // Tab Filter
    if (activeTab === 'system') {
      result = result.filter((r) => r.is_system);
    } else if (activeTab === 'custom') {
      result = result.filter((r) => !r.is_system);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'perms_desc':
          return b.permissions_count - a.permissions_count;
        case 'members_desc':
          return b.active_members_count - a.active_members_count;
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [roles, search, activeTab, sortBy]);

  const paginatedRoles = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredRoles.slice(startIndex, startIndex + perPage);
  }, [filteredRoles, page, perPage]);

  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* =========================================================================
            TOP PORTFOLIO HEADER (1:1 UX PARITY WITH EMPLOYEES & DEPARTMENTS)
           ========================================================================= */}
        <PortfolioPageHeader
          category="SECURITY & ACCESS CONTROL"
          title="Roles & Permissions"
          subtitle="Finovo RBAC + Attribute-Based Access Control (ABAC) with real-time break-glass temporary elevation."
          onExport={handleExportCsv}
          exportLabel="Export Audit CSV"
          onAdd={() => setShowCreateRoleModal(true)}
          addLabel="Create custom role"
          addShortcut="N"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL (EXACT 2-COLUMN SPLIT)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<ShieldCheck className="w-4 h-4 text-orange-600 fill-orange-500/20" />}
          totalCount={roles.length}
          totalLabel="Total security roles"
          scopeLabel="governing tenant authorization"
          distribution={[
            {
              key: 'system',
              label: 'System Roles',
              count: systemRolesCount,
              colorClass: 'bg-orange-500',
              showPercent: true,
            },
            {
              key: 'custom',
              label: 'Custom Roles',
              count: customRolesCount,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'grants',
              label: 'Active Grants',
              count: activeGrantsCount,
              colorClass: 'bg-emerald-500',
              dotClass: 'bg-emerald-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'restrictions',
              label: 'Restrictions (Deny)',
              count: activeRestrictionsCount,
              colorClass: 'bg-rose-500',
              dotClass: 'bg-rose-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'permanent',
              label: 'Permanent Overrides',
              count: permanentOverridesCount,
              colorClass: 'bg-indigo-500',
              dotClass: 'bg-indigo-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'perms',
              label: 'Catalog Operations',
              count: totalCatalogPerms,
              colorClass: 'bg-slate-500',
              dotClass: 'bg-slate-500 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: systemRolesCount,
            medium: totalActiveOverrides,
            low: customRolesCount,
            total: roles.length,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW (IDENTICAL UX & DESIGN LANGUAGE)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'roles', label: 'All Roles', count: roles.length },
            {
              id: 'system',
              label: 'System Built-In',
              count: systemRolesCount,
              dotColor: 'bg-orange-500',
            },
            {
              id: 'custom',
              label: 'Custom Tenant',
              count: customRolesCount,
              dotColor: 'bg-blue-500',
            },
            {
              id: 'grants',
              label: 'Access Overrides',
              count: totalActiveOverrides,
              dotColor: 'bg-amber-400',
            },
            {
              id: 'simulator',
              label: 'Access Simulator',
              count: catalog.length,
              dotColor: 'bg-purple-500',
            },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId);
            setPage(1);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* =========================================================================
            SEARCH AND CONTROLS TOOLBAR
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard shortcut badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search roles by title, key slug, or permissions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-mono border border-slate-200/80">
                /
              </span>
            )}
          </div>

          {/* Right Action Tools: Issue Grant Button & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* ISSUE POLICY OVERRIDE BUTTON */}
            <button
              type="button"
              onClick={() => setShowGrantModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-700 text-xs font-bold border border-amber-200/90 shadow-2xs transition-all cursor-pointer group"
              title="Issue Elevated Grant or Permission Restriction"
            >
              <Key className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
              <span>Issue Policy Override</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-800 text-[10px] font-mono font-bold">
                M03
              </span>
            </button>

            {/* Sort Dropdown */}
            {['roles', 'system', 'custom'].includes(activeTab) && (
              <div className="w-36">
                <CustomDropdown
                  placeholder="Sort By"
                  value={sortBy}
                  onChange={(v) => {
                    setSortBy(v);
                    setPage(1);
                  }}
                  options={[
                    { value: 'name_asc', label: 'Name (A to Z)' },
                    { value: 'name_desc', label: 'Name (Z to A)' },
                    { value: 'perms_desc', label: 'Perms (High)' },
                    { value: 'members_desc', label: 'Members (High)' },
                  ]}
                  fullWidth
                  size="sm"
                />
              </div>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchAccessData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200/90 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
              title="Refresh access control data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F95716]' : ''}`} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN CONTENT AREA: ROLES / GRANTS / SIMULATOR
           ========================================================================= */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200/80">
            <Loader2 className="w-8 h-8 animate-spin text-[#F95716]" />
            <span className="text-xs font-semibold text-slate-500">
              Loading access control &amp; RBAC matrix...
            </span>
          </div>
        ) : (
          <>
            {/* TAB 1, 2, 3: WORKSPACE ROLES (GRID OR TABLE) */}
            {['roles', 'system', 'custom'].includes(activeTab) && (
              <div className="space-y-4">
                {filteredRoles.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-2xs">
                    <Shield className="w-10 h-10 mx-auto text-slate-300" />
                    <h4 className="text-sm font-bold text-slate-800">No matching roles found</h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Adjust your search criteria or create a new custom role.
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedRoles.map((role) => (
                      <RoleCard
                        key={role.id}
                        role={role}
                        onInspect={handleInspectRole}
                      />
                    ))}
                  </div>
                ) : (
                  /* Dense Table View */
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3.5 pl-6 pr-3">Role Name</th>
                            <th className="py-3.5 px-3">Role Slug</th>
                            <th className="py-3.5 px-3">Type</th>
                            <th className="py-3.5 px-3 text-center">Perms Count</th>
                            <th className="py-3.5 px-3 text-center">Assigned Members</th>
                            <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-normal">
                          {paginatedRoles.map((role) => (
                            <tr
                              key={role.id}
                              className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                              onClick={() => handleInspectRole(role)}
                            >
                              <td className="py-4 pl-6 pr-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                      role.is_system
                                        ? 'bg-orange-50 text-[#F95716] border border-orange-200/60'
                                        : 'bg-blue-50 text-blue-600 border border-blue-200/60'
                                    }`}
                                  >
                                    <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors block">
                                      {role.name}
                                    </span>
                                    {role.description && (
                                      <span className="text-[11px] text-slate-400 truncate max-w-[280px] block">
                                        {role.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-3 font-mono text-slate-600 text-xs">
                                {role.slug}
                              </td>

                              <td className="py-4 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                    role.is_system
                                      ? 'bg-slate-100 text-slate-700 border-slate-200/60'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  }`}
                                >
                                  {role.is_system ? 'System' : 'Custom'}
                                </span>
                              </td>

                              <td className="py-4 px-3 text-center font-mono font-bold text-slate-800">
                                {role.permissions_count}
                              </td>

                              <td className="py-4 px-3 text-center">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  <span>{role.active_members_count}</span>
                                </span>
                              </td>

                              <td className="py-4 pl-3 pr-6 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInspectRole(role);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#F95716] hover:text-[#ea4d10] cursor-pointer"
                                >
                                  <span>Inspect</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {filteredRoles.length > perPage && (
                  <PortfolioPagination
                    page={page}
                    perPage={perPage}
                    totalCount={filteredRoles.length}
                    currentCount={paginatedRoles.length}
                    onPageChange={setPage}
                  />
                )}
              </div>
            )}

            {/* TAB 4: ACCESS OVERRIDES & GRANTS */}
            {activeTab === 'grants' && (
              <TemporaryGrantsTable
                grants={grants}
                onRevokeGrant={handleRevokeGrant}
                onOpenIssueModal={() => setShowGrantModal(true)}
              />
            )}

            {/* TAB 5: ACCESS SIMULATOR */}
            {activeTab === 'simulator' && (
              <AccessSimulatorCard
                members={members}
                catalog={catalog}
                onEvaluate={handleEvaluateSimulation}
              />
            )}
          </>
        )}

        {/* =========================================================================
            PORTFOLIO FOOTER
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} activeLink="employees" />
      </div>

      {/* =========================================================================
          MODAL 1: INSPECT ROLE PERMISSIONS (WITH BACKGROUND BLUR OVERLAY)
         ========================================================================= */}
      <RoleInspectModal
        role={inspectingRole}
        onClose={() => setInspectingRole(null)}
      />

      {/* =========================================================================
          MODAL 2: CREATE CUSTOM ROLE (WITH PERMISSIONS MATRIX & OVERLAY)
         ========================================================================= */}
      <CreateRoleModal
        isOpen={showCreateRoleModal}
        onClose={() => setShowCreateRoleModal(false)}
        onSubmit={handleCreateRole}
        catalog={catalog}
      />

      {/* =========================================================================
          MODAL 3: ISSUE TEMPORARY ELEVATED GRANT (WITH DROPDOWNS & OVERLAY)
         ========================================================================= */}
      <IssueGrantModal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        onSubmit={handleIssueGrant}
        members={members}
        catalog={catalog}
      />
    </AppShell>
  );
};

export default RolesPage;

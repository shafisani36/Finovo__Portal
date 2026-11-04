import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Network,
  Search,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { DeleteConfirmationModal } from '../components/ui/DeleteConfirmationModal';
import { CustomDropdown } from '../components/ui/CustomDropdown';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
} from '../components/portfolio';
import {
  Department,
  MemberOption,
  DepartmentFilterLead,
  DepartmentFilterHierarchy,
  DepartmentSortBy,
  DepartmentModal,
  DepartmentCard,
  DepartmentTableView,
  DepartmentDetailDrawer,
  OrgChartModal,
} from '../components/departments';

export const DepartmentsPage: React.FC = () => {
  const { companySlug = 'bitspark-ops' } = useParams<{ companySlug: string }>();
  const { alert } = useConfirm();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Data State with Cache Hydration
  const [departments, setDepartments] = useState<Department[]>(
    () => dataPipeline.get(`departments_${companySlug}`) || []
  );
  const [members, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || []
  );
  const [loading, setLoading] = useState(!dataPipeline.get(`departments_${companySlug}`));
  const [isValidating, setIsValidating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // View & Filter State matching EmployeeDirectoryPage
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [leadFilter, setLeadFilter] = useState<DepartmentFilterLead>('all');
  const [hierarchyFilter, setHierarchyFilter] = useState<DepartmentFilterHierarchy>('all');
  const [sortBy, setSortBy] = useState<DepartmentSortBy>('name_asc');
  const [page, setPage] = useState(1);
  const perPage = 9;

  // Modal & Engine State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOrgChartModal, setShowOrgChartModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [activeDrawerDept, setActiveDrawerDept] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Global Keyboard Shortcuts (N for new department, / to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreateModal(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Departments
  const fetchDepartments = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (departments.length === 0) setLoading(true);
      else setIsValidating(true);

      try {
        const res = await api.get(`/companies/${companySlug}/departments`);
        const deptList: Department[] = res.data.departments || [];
        setDepartments(deptList);
        dataPipeline.set(`departments_${companySlug}`, deptList);
      } catch (err: any) {
        console.error('Failed to fetch departments:', err);
      } finally {
        setLoading(false);
        setIsValidating(false);
        setRefreshing(false);
      }
    },
    [companySlug, departments.length]
  );

  // Fetch Members for leadership assignment
  const fetchMembers = useCallback(async () => {
    const cached = dataPipeline.get<MemberOption[]>(`members_${companySlug}`);
    if (cached) setMembers(cached);

    try {
      const res = await api.get(`/companies/${companySlug}/members?per_page=100&status=active`);
      const memList = res.data.data || res.data.members || [];
      setMembers(memList);
      dataPipeline.set(`members_${companySlug}`, memList);
    } catch {
      // Retain existing
    }
  }, [companySlug]);

  useEffect(() => {
    if (companySlug) {
      fetchDepartments();
      fetchMembers();
    }
  }, [companySlug, fetchDepartments, fetchMembers]);

  // Create / Update Handler
  const handleSaveDepartment = async (payload: {
    name: string;
    code: string | null;
    description: string | null;
    manager_membership_id: number | null;
    parent_department_id: number | null;
    status: string;
  }) => {
    if (editingDept) {
      await api.patch(`/companies/${companySlug}/departments/${editingDept.id}`, payload);
      setEditingDept(null);
    } else {
      await api.post(`/companies/${companySlug}/departments`, payload);
      setShowCreateModal(false);
    }
    await fetchDepartments();
  };

  // Delete Handler
  const handleDeleteDepartment = async () => {
    if (!deletingDept) return;

    setIsDeleting(true);
    try {
      await api.delete(`/companies/${companySlug}/departments/${deletingDept.id}`);
      setDeletingDept(null);
      if (activeDrawerDept?.id === deletingDept.id) {
        setActiveDrawerDept(null);
      }
      await fetchDepartments();
    } catch (err: any) {
      await alert({
        title: 'Delete Failed',
        message: err.response?.data?.message || 'Failed to delete department.',
        variant: 'danger',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (departments.length === 0) return;

    const headers = [
      'ID',
      'Name',
      'Code',
      'Status',
      'Hierarchy Level',
      'Parent Department',
      'Department Head',
      'Workforce Count',
      'Description',
    ];
    const rows = departments.map((d) => [
      d.id,
      `"${d.name.replace(/"/g, '""')}"`,
      d.code || '',
      d.status || 'active',
      d.parent_department ? 'Sub-Unit' : 'Top Division',
      d.parent_department ? `"${d.parent_department.name.replace(/"/g, '""')}"` : 'None',
      d.manager?.user.name ? `"${d.manager.user.name.replace(/"/g, '""')}"` : 'Unassigned',
      d.employee_profiles_count || d.members_count || 0,
      `"${(d.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `departments_${companySlug}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setStatusTab('all');
    setLeadFilter('all');
    setHierarchyFilter('all');
    setSortBy('name_asc');
    setPage(1);
  };

  // Hero Analytics Breakdown
  const totalCount = departments.length;
  const activeCount = useMemo(() => departments.filter((d) => d.status !== 'archived').length, [departments]);
  const archivedCount = totalCount - activeCount;
  const topLevelCount = useMemo(
    () => departments.filter((d) => !d.parent_department_id && !d.parent_department).length,
    [departments]
  );
  const subUnitsCount = totalCount - topLevelCount;
  const withLeadCount = useMemo(
    () => departments.filter((d) => d.manager_membership_id != null).length,
    [departments]
  );
  const unassignedLeadCount = totalCount - withLeadCount;

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    let result = [...departments];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.code && d.code.toLowerCase().includes(q)) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          (d.manager?.user.name && d.manager.user.name.toLowerCase().includes(q)) ||
          (d.manager?.user.email && d.manager.user.email.toLowerCase().includes(q))
      );
    }

    // Status Tab (Filter tabs matching Employees page)
    if (statusTab === 'active') {
      result = result.filter((d) => d.status !== 'archived');
    } else if (statusTab === 'archived') {
      result = result.filter((d) => d.status === 'archived');
    } else if (statusTab === 'top_level') {
      result = result.filter((d) => !d.parent_department_id && !d.parent_department);
    } else if (statusTab === 'sub_units') {
      result = result.filter((d) => d.parent_department_id || d.parent_department);
    } else if (statusTab === 'with_lead') {
      result = result.filter((d) => d.manager_membership_id != null);
    }

    // Leadership filter
    if (leadFilter === 'with_lead') {
      result = result.filter((d) => d.manager_membership_id != null);
    } else if (leadFilter === 'unassigned') {
      result = result.filter((d) => d.manager_membership_id == null);
    }

    // Hierarchy filter
    if (hierarchyFilter === 'top_level') {
      result = result.filter((d) => !d.parent_department_id && !d.parent_department);
    } else if (hierarchyFilter === 'sub_units') {
      result = result.filter((d) => d.parent_department_id || d.parent_department);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'members_desc': {
          const aCount = a.employee_profiles_count || a.members_count || 0;
          const bCount = b.employee_profiles_count || b.members_count || 0;
          return bCount - aCount;
        }
        case 'members_asc': {
          const aCount = a.employee_profiles_count || a.members_count || 0;
          const bCount = b.employee_profiles_count || b.members_count || 0;
          return aCount - bCount;
        }
        case 'code_asc':
          return (a.code || '').localeCompare(b.code || '');
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [departments, search, statusTab, leadFilter, hierarchyFilter, sortBy]);

  // Paginated Departments
  const paginatedDepartments = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return filteredDepartments.slice(startIndex, startIndex + perPage);
  }, [filteredDepartments, page, perPage]);

  const hasActiveFilters =
    search.trim() !== '' ||
    statusTab !== 'all' ||
    leadFilter !== 'all' ||
    hierarchyFilter !== 'all';

  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* =========================================================================
            TOP PORTFOLIO HEADER (1:1 PARITY WITH EMPLOYEES PAGE)
           ========================================================================= */}
        <PortfolioPageHeader
          category="ORGANIZATIONAL ARCHITECTURE"
          title="Departments"
          subtitle="Organize team structures, assign leadership, monitor workforce distribution, and govern organizational units."
          onExport={handleExportCSV}
          exportLabel="Export CSV"
          onAdd={() => setShowCreateModal(true)}
          addLabel="Add department"
          addShortcut="N"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL (2-COLUMN SPLIT 1:1 WITH EMPLOYEES PAGE)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<Network className="w-4 h-4 text-orange-600 fill-orange-500/20" />}
          totalCount={totalCount}
          totalLabel="Total operating units"
          scopeLabel="across company organization"
          distribution={[
            {
              key: 'active',
              label: 'Active',
              count: activeCount,
              colorClass: 'bg-emerald-500',
              showPercent: true,
            },
            {
              key: 'top_level',
              label: 'Top Divisions',
              count: topLevelCount,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'sub_units',
              label: 'Sub-Units',
              count: subUnitsCount,
              colorClass: 'bg-purple-500',
              dotClass: 'bg-purple-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'with_lead',
              label: 'With Lead',
              count: withLeadCount,
              colorClass: 'bg-indigo-500',
              dotClass: 'bg-indigo-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'archived',
              label: 'Archived',
              count: archivedCount,
              colorClass: 'bg-slate-300',
              dotClass: 'bg-slate-300 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: withLeadCount,
            medium: subUnitsCount,
            low: unassignedLeadCount,
            total: totalCount,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW (IDENTICAL UX & DESIGN LANGUAGE)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'all', label: 'All', count: totalCount },
            {
              id: 'active',
              label: 'Active',
              count: activeCount,
              dotColor: 'bg-emerald-500',
            },
            {
              id: 'top_level',
              label: 'Top Divisions',
              count: topLevelCount,
              dotColor: 'bg-blue-500',
            },
            {
              id: 'sub_units',
              label: 'Sub-Units',
              count: subUnitsCount,
              dotColor: 'bg-purple-500',
            },
            {
              id: 'with_lead',
              label: 'With Lead',
              count: withLeadCount,
              dotColor: 'bg-indigo-500',
            },
            {
              id: 'archived',
              label: 'Archived',
              count: archivedCount,
              dotColor: 'bg-slate-400',
            },
          ]}
          activeTab={statusTab}
          onTabChange={(tabId) => {
            setStatusTab(tabId);
            setPage(1);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* =========================================================================
            SEARCH AND CONTROLS TOOLBAR WITH ORGANIZATIONAL CHART ENGINE TRIGGER
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard shortcut badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search departments by name, code, manager, charter..."
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

          {/* Right Action Tools: Org Chart Engine Button & Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* ORGANIZATIONAL CHART BUTTON */}
            <button
              type="button"
              onClick={() => setShowOrgChartModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 hover:from-orange-500/20 hover:to-orange-500/20 text-[#F95716] text-xs font-bold border border-orange-200/90 shadow-2xs transition-all cursor-pointer group"
              title="Launch Interactive 2D Vector Organization Chart"
            >
              <Network className="w-3.5 h-3.5 text-[#F95716] group-hover:scale-110 transition-transform" />
              <span>Show Org Chart</span>
              <span className="px-1.5 py-0.2 rounded bg-orange-500/15 text-[#F95716] text-[10px] font-mono font-bold">
                2D Tree
              </span>
            </button>

            {/* Leadership Dropdown */}
            <div className="w-36">
              <CustomDropdown
                placeholder="Leadership"
                value={leadFilter}
                onChange={(v) => {
                  setLeadFilter(v as DepartmentFilterLead);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Leadership' },
                  { value: 'with_lead', label: 'Assigned Lead' },
                  { value: 'unassigned', label: 'Unassigned Lead' },
                ]}
                fullWidth
                size="sm"
              />
            </div>

            {/* Hierarchy Dropdown */}
            <div className="w-36">
              <CustomDropdown
                placeholder="Hierarchy"
                value={hierarchyFilter}
                onChange={(v) => {
                  setHierarchyFilter(v as DepartmentFilterHierarchy);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Hierarchy' },
                  { value: 'top_level', label: 'Top Divisions' },
                  { value: 'sub_units', label: 'Sub-Units' },
                ]}
                fullWidth
                size="sm"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="w-36">
              <CustomDropdown
                placeholder="Sort"
                value={sortBy}
                onChange={(v) => {
                  setSortBy(v as DepartmentSortBy);
                  setPage(1);
                }}
                options={[
                  { value: 'name_asc', label: 'Name (A to Z)' },
                  { value: 'name_desc', label: 'Name (Z to A)' },
                  { value: 'members_desc', label: 'Workforce (High)' },
                  { value: 'members_asc', label: 'Workforce (Low)' },
                  { value: 'code_asc', label: 'Code (A to Z)' },
                ]}
                fullWidth
                size="sm"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDepartments(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200/90 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
              title="Refresh departments list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F95716]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Active Filter Clear Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs px-1 text-slate-500">
            <span>
              Showing <strong>{filteredDepartments.length}</strong> of{' '}
              <strong>{departments.length}</strong> departments
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#F95716] hover:text-[#ea4d10] font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        )}

        {/* Background Sync Pulse Line */}
        {isValidating && departments.length > 0 && (
          <div className="h-0.5 w-full bg-orange-100 overflow-hidden rounded-full">
            <div className="h-full bg-gradient-to-r from-[#f95716] via-orange-400 to-[#f95716] w-full animate-pulse" />
          </div>
        )}

        {/* =========================================================================
            DATA LISTING & VIEW MODES (TABLE & GRID)
           ========================================================================= */}
        {loading && departments.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200/80">
            <Loader2 className="w-8 h-8 animate-spin text-[#F95716]" />
            <span className="text-xs font-semibold text-slate-500">
              Loading departmental workforce records...
            </span>
          </div>
        ) : departments.length === 0 ? (
          /* Zero Total Departments Empty State */
          <div className="py-20 text-center text-slate-400 space-y-4 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-2xs">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 text-[#F95716] mx-auto flex items-center justify-center border border-orange-100">
              <Network className="w-8 h-8 stroke-[1.8]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                No departments established yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Establish your company's core organizational structure such as Engineering, Product, Marketing, Operations, or Finance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:from-[#ea4d10] hover:to-[#db460c] rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Network className="w-4 h-4 stroke-[2.2]" />
              <span>Create First Department</span>
            </button>
          </div>
        ) : filteredDepartments.length === 0 ? (
          /* Filtered Zero Results State */
          <div className="py-16 text-center text-slate-400 space-y-3 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              No matching departments found
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              No departments matched your current search and filter criteria. Try adjusting your search query.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'table' ? (
              <DepartmentTableView
                departments={paginatedDepartments}
                onEdit={(d) => setEditingDept(d)}
                onDelete={(d) => setDeletingDept(d)}
                onViewDetails={(d) => setActiveDrawerDept(d)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedDepartments.map((dept) => (
                  <DepartmentCard
                    key={dept.id}
                    department={dept}
                    onEdit={(d) => setEditingDept(d)}
                    onDelete={(d) => setDeletingDept(d)}
                    onViewDetails={(d) => setActiveDrawerDept(d)}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredDepartments.length > perPage && (
              <PortfolioPagination
                page={page}
                perPage={perPage}
                totalCount={filteredDepartments.length}
                currentCount={paginatedDepartments.length}
                onPageChange={setPage}
              />
            )}
          </div>
        )}

        {/* =========================================================================
            PORTFOLIO FOOTER (ACTIVE LINK SET TO EMPLOYEES / ORG)
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} activeLink="employees" />
      </div>

      {/* =========================================================================
          CREATE / EDIT DEPARTMENT MODAL (WITH BACKGROUND BLUR OVERLAY)
         ========================================================================= */}
      <DepartmentModal
        isOpen={showCreateModal || !!editingDept}
        onClose={() => {
          setShowCreateModal(false);
          setEditingDept(null);
        }}
        onSubmit={handleSaveDepartment}
        editingDepartment={editingDept}
        departments={departments}
        members={members}
      />

      {/* =========================================================================
          INTERACTIVE ORGANIZATIONAL CHART ENGINE MODAL (2D VECTOR GRAPH)
         ========================================================================= */}
      <OrgChartModal
        isOpen={showOrgChartModal}
        onClose={() => setShowOrgChartModal(false)}
        departments={departments}
        onEditDepartment={(dept) => setEditingDept(dept)}
        onViewDetails={(dept) => setActiveDrawerDept(dept)}
      />

      {/* =========================================================================
          DEPARTMENT DETAIL SLIDE-OVER INSPECTOR
         ========================================================================= */}
      <DepartmentDetailDrawer
        department={activeDrawerDept}
        onClose={() => setActiveDrawerDept(null)}
        onEdit={(d) => setEditingDept(d)}
        subDepartments={departments.filter(
          (d) =>
            d.parent_department_id === activeDrawerDept?.id ||
            d.parent_department?.id === activeDrawerDept?.id
        )}
      />

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
         ========================================================================= */}
      <DeleteConfirmationModal
        isOpen={!!deletingDept}
        title="Delete Department"
        itemName={deletingDept?.name}
        message="Are you sure you want to delete this department? All assigned team members will remain in the company and will have their department set to unassigned."
        confirmText="Delete Department"
        cancelText="Cancel"
        variant="danger"
        isDeleting={isDeleting}
        onConfirm={handleDeleteDepartment}
        onCancel={() => setDeletingDept(null)}
      />
    </AppShell>
  );
};

export default DepartmentsPage;

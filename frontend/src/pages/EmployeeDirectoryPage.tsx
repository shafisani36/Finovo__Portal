import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Building,
  Shield,
  Briefcase,
  Loader2,
  X,
  Plus,
  Trash2,
  Clock,
  FileText,
  Award,
  Sparkles,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  Lock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  MoreHorizontal,
  Table as TableIcon,
  LayoutGrid,
  ShieldCheck,
  UserX,
  RefreshCw,
  MapPin,
  Laptop,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';
import {
  CustomDropdown,
  CustomCheckboxDropdown,
  CustomActionDropdown,
} from '../components/ui/CustomDropdown';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
  PortfolioStatusBadge,
} from '../components/portfolio';
import {
  CreateEmployeeModal,
  EmployeeCredentialsModal,
  ResetPasswordModal,
  EmployeeCredentials,
  DepartmentItem,
  DesignationItem,
} from '../components/employees';

interface EmployeeUser {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  status?: string;
}

interface EmployeeRole {
  id: number;
  name: string;
  slug: string;
}

interface EmployeeMembership {
  id: number;
  company_id: number;
  user_id: number;
  status: string;
  roles?: EmployeeRole[];
  user?: EmployeeUser;
}

interface OnboardingTask {
  id: number;
  employment_record_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'completed' | 'in_progress';
  is_required: boolean;
  due_date?: string;
}

interface EmployeeSkill {
  id: number;
  skill_name: string;
  proficiency_level: string;
  years_of_experience: number;
  verified: boolean;
}

interface EmployeeHistoryEvent {
  id: number;
  change_type: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  reason?: string;
  effective_at: string;
  changed_by_user?: { name: string };
}

interface Employee {
  id: number;
  company_id: number;
  membership_id: number;
  employee_number: string;
  employment_type: string;
  status: 'invited' | 'onboarding' | 'active' | 'on_leave' | 'suspended' | 'offboarding' | 'former_employee';
  department_id: number | null;
  designation_id: number | null;
  manager_membership_id: number | null;
  hire_date: string;
  probation_end_date: string | null;
  work_location: string | null;
  work_arrangement: string | null;
  created_at: string;
  updated_at: string;
  user?: EmployeeUser;
  membership?: EmployeeMembership;
  department?: { id: number; name: string; code?: string };
  designation?: { id: number; name: string; level?: string | number };
  managerMembership?: {
    id: number;
    user?: { id: number; name: string; email: string };
  };
  onboardingTasks?: OnboardingTask[];
  onboarding_tasks?: OnboardingTask[];
  skills?: EmployeeSkill[];
  history?: EmployeeHistoryEvent[];
}

export const EmployeeDirectoryPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { confirm: confirmModal, alert: alertModal } = useConfirm();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [managers, setManagers] = useState<Array<{ id: number; user?: { id: number; name: string; email: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filtering States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [arrangementFilter, setArrangementFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // View Mode: 'table' | 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Bulk Selection
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  // Drawer & Modals State
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'credentials' | 'onboarding' | 'skills' | 'history'>('overview');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [activeCredentials, setActiveCredentials] = useState<EmployeeCredentials | null>(null);

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [employeeToReset, setEmployeeToReset] = useState<Employee | null>(null);

  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [employeeToOffboard, setEmployeeToOffboard] = useState<Employee | null>(null);
  const [offboardReason, setOffboardReason] = useState('Standard departure');
  const [offboardImmediate, setOffboardImmediate] = useState(false);
  const [offboardLoading, setOffboardLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        navigate(`/app/${companySlug}/employees/create`);
      }
      if (e.key === 'Escape') {
        if (selectedEmployee) setSelectedEmployee(null);
        if (showCreateModal) setShowCreateModal(false);
        if (showCredentialsModal) setShowCredentialsModal(false);
        if (showResetPasswordModal) setShowResetPasswordModal(false);
        if (showOffboardModal) setShowOffboardModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmployee, showCreateModal, showCredentialsModal, showResetPasswordModal, showOffboardModal]);

  // Fetch Lookups (Departments, Designations, Managers)
  const fetchLookups = useCallback(async () => {
    if (!companySlug) return;
    try {
      const [deptRes, desigRes, memberRes] = await Promise.allSettled([
        api.get(`/companies/${companySlug}/departments`),
        api.get(`/companies/${companySlug}/designations`),
        api.get(`/companies/${companySlug}/members?status=active&per_page=100`),
      ]);

      if (deptRes.status === 'fulfilled' && deptRes.value.data?.departments) {
        setDepartments(deptRes.value.data.departments);
      }
      if (desigRes.status === 'fulfilled' && desigRes.value.data?.designations) {
        setDesignations(desigRes.value.data.designations);
      }
      if (memberRes.status === 'fulfilled' && memberRes.value.data?.members) {
        const memList = memberRes.value.data.members?.data || memberRes.value.data.members || [];
        setManagers(memList);
      }
    } catch (err) {
      console.error('Failed to load organization lookups', err);
    }
  }, [companySlug]);

  // Fetch Employees List with all active filters
  const fetchEmployees = useCallback(
    async (forceFresh = false) => {
      if (!companySlug) return;
      if (forceFresh) {
        setIsValidating(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (statusTab !== 'all' && statusTab !== 'contractors') {
          params.append('status', statusTab);
        }
        if (statusTab === 'contractors') {
          params.append('employment_type', 'contractor');
        }
        if (departmentFilter) params.append('department_id', departmentFilter);
        if (roleFilter) params.append('role', roleFilter);
        if (arrangementFilter) params.append('work_arrangement', arrangementFilter);
        if (employmentTypeFilter) params.append('employment_type', employmentTypeFilter);

        params.append('sort_by', sortBy);
        params.append('sort_direction', sortDirection);
        params.append('page', String(page));
        params.append('per_page', String(perPage));

        const res = await api.get(`/companies/${companySlug}/employees?${params.toString()}`);
        if (res.data?.employees) {
          const empList = res.data.employees.data || res.data.employees || [];
          setEmployees(empList);
          setTotalCount(res.data.employees.total ?? empList.length);
        }
      } catch (err) {
        console.error('Failed to load employees directory', err);
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    },
    [
      companySlug,
      debouncedSearch,
      statusTab,
      departmentFilter,
      roleFilter,
      arrangementFilter,
      employmentTypeFilter,
      sortBy,
      sortDirection,
      page,
    ]
  );

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Open Slide-Over Profile Drawer
  const openEmployeeDrawer = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setDrawerLoading(true);
    setDrawerTab('overview');
    try {
      const res = await api.get(`/companies/${companySlug}/employees/${emp.id}`);
      if (res.data?.employee) {
        setSelectedEmployee(res.data.employee);
      }
    } catch (err) {
      console.error('Failed to load employee details', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Toggle Onboarding Task Item in Drawer
  const handleToggleTask = async (taskId: number) => {
    if (!selectedEmployee) return;
    try {
      const res = await api.post(
        `/companies/${companySlug}/employees/${selectedEmployee.id}/onboarding-tasks/${taskId}/toggle`
      );
      if (res.data?.task) {
        setSelectedEmployee((prev) => {
          if (!prev) return null;
          const updatedTasks = (prev.onboardingTasks || prev.onboarding_tasks || []).map((t) =>
            t.id === taskId ? { ...t, status: res.data.task.status } : t
          );
          return {
            ...prev,
            onboardingTasks: updatedTasks,
            onboarding_tasks: updatedTasks,
          };
        });
      }
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  // Status Transition Action
  const handleTransitionStatus = async (newStatus: string) => {
    if (!selectedEmployee) return;
    try {
      await api.post(`/companies/${companySlug}/employees/${selectedEmployee.id}/status-transitions`, {
        status: newStatus,
        reason: `Status transition requested from administrative console to ${newStatus}`,
      });
      setSelectedEmployee((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      fetchEmployees(true);
      await alertModal({
        title: 'Status Updated',
        message: `Employee status transitioned to ${newStatus}.`,
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Transition Failed',
        message: err.response?.data?.message || 'Failed to update employee status.',
        variant: 'danger',
      });
    }
  };

  // Delete Single Employee
  const handleDeleteEmployee = async (emp: Employee) => {
    const ok = await confirmModal({
      title: 'Remove Employee Record',
      message: `Are you sure you want to permanently remove employee "${emp.user?.name || emp.employee_number}" from the workspace? All associated onboarding history and records will be deleted.`,
      confirmText: 'Delete Employee',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/companies/${companySlug}/employees/${emp.id}`);
      if (selectedEmployee?.id === emp.id) setSelectedEmployee(null);
      setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.id));
      fetchEmployees(true);
      await alertModal({
        title: 'Record Deleted',
        message: 'Employee record has been removed from this company workspace.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Action Failed',
        message: err.response?.data?.message || 'Could not delete employee record.',
        variant: 'danger',
      });
    }
  };

  // Submit Offboard
  const handleSubmitOffboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeToOffboard) return;
    setOffboardLoading(true);
    try {
      await api.post(`/companies/${companySlug}/employees/${employeeToOffboard.id}/offboarding`, {
        reason: offboardReason,
        immediate_security_revocation: offboardImmediate,
        final_status: 'offboarding',
      });
      setShowOffboardModal(false);
      setEmployeeToOffboard(null);
      fetchEmployees(true);
      await alertModal({
        title: 'Offboarding Initiated',
        message: 'Standard departure checklist has been assigned and credentials status updated.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Offboard Error',
        message: err.response?.data?.message || 'Could not process offboarding request.',
        variant: 'danger',
      });
    } finally {
      setOffboardLoading(false);
    }
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length && employees.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map((e) => e.id));
    }
  };

  const handleToggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Export CSV
  const handleExportCsv = () => {
    if (employees.length === 0) {
      alertModal({
        title: 'Export Notice',
        message: 'No employees available to export in the current view.',
        variant: 'info',
      });
      return;
    }

    const headers = [
      'Employee Number',
      'Full Name',
      'Work Email',
      'Status',
      'Role',
      'Department',
      'Designation',
      'Type',
      'Arrangement',
      'Work Location',
      'Hire Date',
    ];

    const rows = employees.map((emp) => [
      emp.employee_number,
      `"${emp.user?.name || ''}"`,
      emp.user?.email || '',
      emp.status,
      emp.membership?.roles?.[0]?.name || 'Employee',
      `"${emp.department?.name || ''}"`,
      `"${emp.designation?.name || ''}"`,
      emp.employment_type,
      emp.work_arrangement || 'remote',
      `"${emp.work_location || 'Headquarters'}"`,
      emp.hire_date || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `employees_${companySlug}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusTab('all');
    setDepartmentFilter('');
    setRoleFilter('');
    setArrangementFilter('');
    setEmploymentTypeFilter('');
    setSortBy('created_at');
    setSortDirection('desc');
    setPage(1);
  };

  // Helper: Initials
  const getInitials = (fullName?: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper: Format Date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Headcount Distribution Stats
  const activeCount = useMemo(() => employees.filter((e) => e.status === 'active').length, [employees]);
  const onboardingCount = useMemo(() => employees.filter((e) => e.status === 'onboarding').length, [employees]);
  const invitedCount = useMemo(() => employees.filter((e) => e.status === 'invited').length, [employees]);
  const onLeaveCount = useMemo(() => employees.filter((e) => e.status === 'on_leave').length, [employees]);
  const contractorsCount = useMemo(() => employees.filter((e) => e.employment_type === 'contractor').length, [employees]);

  const permanentCount = useMemo(() => employees.filter((e) => e.employment_type === 'permanent').length, [employees]);
  const otherTypesCount = useMemo(
    () => employees.filter((e) => !['permanent', 'contractor'].includes(e.employment_type)).length,
    [employees]
  );

  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* =========================================================================
            TOP PORTFOLIO HEADER (1:1 UX PARITY WITH PROJECTS & TASKS)
           ========================================================================= */}
        <PortfolioPageHeader
          category="HUMAN CAPITAL"
          title="Employees"
          subtitle="Manage workforce profiles, credentials, onboarding workflows, roles, and departmental structure."
          onExport={handleExportCsv}
          exportLabel="Export CSV"
          onAdd={() => navigate(`/app/${companySlug}/employees/create`)}
          addLabel="Add employee"
          addShortcut="N"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL (EXACT 2-COLUMN SPLIT)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<Users className="w-4 h-4 fill-blue-500/20" />}
          totalCount={totalCount || employees.length}
          totalLabel="Total workforce"
          scopeLabel="across all departments"
          distribution={[
            {
              key: 'active',
              label: 'Active',
              count: activeCount,
              colorClass: 'bg-emerald-500',
              showPercent: true,
            },
            {
              key: 'onboarding',
              label: 'Onboarding',
              count: onboardingCount,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'invited',
              label: 'Invited',
              count: invitedCount,
              colorClass: 'bg-purple-500',
              dotClass: 'bg-purple-500 rounded-full',
              showPercent: false,
            },
            {
              key: 'on_leave',
              label: 'On Leave',
              count: onLeaveCount,
              colorClass: 'bg-amber-400',
              dotClass: 'bg-amber-400 rounded-full',
              showPercent: false,
            },
            {
              key: 'contractors',
              label: 'Contractors',
              count: contractorsCount,
              colorClass: 'bg-slate-300',
              dotClass: 'bg-slate-300 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: permanentCount,
            medium: contractorsCount,
            low: otherTypesCount,
            total: totalCount || employees.length,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW (IDENTICAL UX & DESIGN LANGUAGE)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'all', label: 'All', count: totalCount || employees.length },
            {
              id: 'active',
              label: 'Active',
              count: activeCount,
              dotColor: 'bg-emerald-500',
            },
            {
              id: 'onboarding',
              label: 'Onboarding',
              count: onboardingCount,
              dotColor: 'bg-blue-500',
            },
            {
              id: 'invited',
              label: 'Invited',
              count: invitedCount,
              dotColor: 'bg-purple-500',
            },
            {
              id: 'on_leave',
              label: 'On Leave',
              count: onLeaveCount,
              dotColor: 'bg-amber-400',
            },
            {
              id: 'contractors',
              label: 'Contractors',
              count: contractorsCount,
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
            SEARCH AND CONTROLS TOOLBAR (EXACT MATCH WITH CUSTOM DROPDOWNS)
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard shortcut badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search employees by name, email, employee #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            <CustomDropdown
              value={departmentFilter}
              onChange={(val) => {
                setDepartmentFilter(val);
                setPage(1);
              }}
              placeholder="All departments"
              size="sm"
              variant="filter"
              leadingIcon={<Building className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All departments' },
                ...departments.map((d) => ({ value: String(d.id), label: d.name })),
              ]}
            />

            {/* Role Filter */}
            <CustomDropdown
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
              placeholder="All roles"
              size="sm"
              variant="filter"
              leadingIcon={<Shield className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All roles' },
                { value: 'employee', label: 'Employee' },
                { value: 'project-manager', label: 'Project Manager' },
                { value: 'hr-officer', label: 'HR Officer' },
                { value: 'company-admin', label: 'Company Administrator' },
              ]}
            />

            {/* Work Arrangement Filter */}
            <CustomDropdown
              value={arrangementFilter}
              onChange={(val) => {
                setArrangementFilter(val);
                setPage(1);
              }}
              placeholder="Arrangement"
              size="sm"
              variant="filter"
              leadingIcon={<Laptop className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All arrangements' },
                { value: 'remote', label: 'Remote' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'on_site', label: 'On-Site' },
              ]}
            />

            {/* Sort Dropdown */}
            <CustomDropdown
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
              placeholder="Sort by"
              size="sm"
              variant="filter"
              options={[
                { value: 'created_at', label: 'Recently added' },
                { value: 'hire_date', label: 'Hire date' },
                { value: 'employee_number', label: 'Employee #' },
                { value: 'status', label: 'Status' },
              ]}
            />

            {/* Reset / Clear Button */}
            {(search || departmentFilter || roleFilter || arrangementFilter || employmentTypeFilter || statusTab !== 'all') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-2xs cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (when rows selected) */}
        {selectedEmployeeIds.length > 0 && (
          <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F95716]" />
              <span className="font-bold text-slate-900">
                {selectedEmployeeIds.length} {selectedEmployeeIds.length === 1 ? 'employee' : 'employees'} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedEmployeeIds([])}
                className="px-3 py-1.5 rounded-xl border border-orange-200 bg-white hover:bg-orange-50 text-slate-700 font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            MAIN DIRECTORY DATA: TABLE OR GRID VIEW
           ========================================================================= */}
        {loading && employees.length === 0 ? (
          <div className="py-24 text-center space-y-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <Loader2 className="w-8 h-8 animate-spin text-[#F95716] mx-auto" />
            <p className="text-xs text-slate-400">Loading workforce directory...</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {employees.length === 0 ? (
                <div className="col-span-full py-16 text-center space-y-2 bg-white rounded-2xl border border-slate-200">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No employees match this filter</p>
                  <p className="text-[11px] text-slate-400">Try modifying your search or clearing active filters.</p>
                </div>
              ) : (
                employees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => openEmployeeDrawer(emp)}
                    className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-orange-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-orange-500/20">
                          {getInitials(emp.user?.name)}
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <PortfolioStatusBadge status={emp.status} />
                          <CustomActionDropdown
                            align="right"
                            title="Actions"
                            trigger={
                              <button
                                type="button"
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            }
                            items={[
                              {
                                id: 'view',
                                label: 'View Profile',
                                icon: <Eye className="w-3.5 h-3.5" />,
                                onClick: () => openEmployeeDrawer(emp),
                              },
                              {
                                id: 'reset_pwd',
                                label: 'Reset Credentials',
                                icon: <Key className="w-3.5 h-3.5" />,
                                onClick: () => {
                                  setEmployeeToReset(emp);
                                  setShowResetPasswordModal(true);
                                },
                              },
                              {
                                id: 'offboard',
                                label: 'Initiate Offboard',
                                icon: <UserX className="w-3.5 h-3.5 text-amber-600" />,
                                onClick: () => {
                                  setEmployeeToOffboard(emp);
                                  setShowOffboardModal(true);
                                },
                              },
                              {
                                id: 'delete',
                                label: 'Delete Record',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                danger: true,
                                dividerBefore: true,
                                onClick: () => handleDeleteEmployee(emp),
                              },
                            ]}
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#F95716] transition-colors truncate">
                          {emp.user?.name || emp.employee_number}
                        </h4>
                        <p className="text-xs text-slate-500 truncate font-mono mt-0.5">
                          {emp.user?.email || '—'}
                        </p>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px] mt-1.5">
                          {emp.employee_number}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Department:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                            {emp.department?.name || 'Unassigned'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Title:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[150px]">
                            {emp.designation?.name || 'Team Member'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Role:</span>
                          <span className="font-semibold text-[#F95716] capitalize">
                            {(emp.membership?.roles?.[0]?.name || 'Employee').toLowerCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{emp.work_arrangement || 'Remote'}</span>
                      <span className="font-mono">{formatDate(emp.hire_date)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <PortfolioPagination
              page={page}
              perPage={perPage}
              totalCount={totalCount}
              currentCount={employees.length}
              onPageChange={setPage}
            />
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-bold text-slate-500 tracking-wider">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.length === employees.length && employees.length > 0}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-[#F95716] focus:ring-[#F95716]/20 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">EMPLOYEE</th>
                    <th className="py-3 px-4">ROLE &amp; ORG</th>
                    <th className="py-3 px-4">DEPARTMENT &amp; TITLE</th>
                    <th className="py-3 px-4">ARRANGEMENT</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">HIRE DATE</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center space-y-2">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">No employees match this filter</p>
                        <p className="text-[11px] text-slate-400">Try modifying your search or clearing active filters.</p>
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => {
                      const isSelected = selectedEmployeeIds.includes(emp.id);
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => openEmployeeDrawer(emp)}
                          className={`hover:bg-orange-50/20 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-4" onClick={(e) => handleToggleSelectOne(emp.id, e)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-[#F95716] focus:ring-[#F95716]/20 cursor-pointer"
                            />
                          </td>

                          {/* Employee Name, Avatar & Email */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                                {getInitials(emp.user?.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors truncate">
                                    {emp.user?.name || emp.employee_number}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
                                    {emp.employee_number}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono block truncate">
                                  {emp.user?.email || '—'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role & Org */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-orange-50 text-[#F95716] border border-orange-200/60">
                                <Shield className="w-3 h-3" />
                                <span>{emp.membership?.roles?.[0]?.name || 'Employee'}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {companySlug}
                              </span>
                            </div>
                          </td>

                          {/* Department & Title */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                                {emp.department?.name || 'Unassigned'}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                                {emp.designation?.name || 'Team Member'}
                              </span>
                            </div>
                          </td>

                          {/* Arrangement & Type */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-700 capitalize block">
                                {emp.work_arrangement || 'Remote'}
                              </span>
                              <span className="text-[10.5px] text-slate-400 capitalize block">
                                {emp.employment_type}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <PortfolioStatusBadge status={emp.status} />
                          </td>

                          {/* Hire Date */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            {formatDate(emp.hire_date)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEmployeeDrawer(emp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="View Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEmployeeToReset(emp);
                                  setShowResetPasswordModal(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#F95716] hover:bg-orange-50 transition-colors cursor-pointer"
                                title="Reset Login Credentials"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              <CustomActionDropdown
                                align="right"
                                title="Employee Actions"
                                trigger={
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                }
                                items={[
                                  {
                                    id: 'view',
                                    label: 'Open Details & Access',
                                    icon: <Eye className="w-3.5 h-3.5" />,
                                    onClick: () => openEmployeeDrawer(emp),
                                  },
                                  {
                                    id: 'reset_pwd',
                                    label: 'Reset Credentials',
                                    icon: <Key className="w-3.5 h-3.5" />,
                                    onClick: () => {
                                      setEmployeeToReset(emp);
                                      setShowResetPasswordModal(true);
                                    },
                                  },
                                  {
                                    id: 'offboard',
                                    label: 'Initiate Offboard',
                                    icon: <UserX className="w-3.5 h-3.5 text-amber-600" />,
                                    onClick: () => {
                                      setEmployeeToOffboard(emp);
                                      setShowOffboardModal(true);
                                    },
                                  },
                                  {
                                    id: 'delete',
                                    label: 'Delete Record',
                                    icon: <Trash2 className="w-3.5 h-3.5" />,
                                    danger: true,
                                    dividerBefore: true,
                                    onClick: () => handleDeleteEmployee(emp),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <PortfolioPagination
              page={page}
              perPage={perPage}
              totalCount={totalCount}
              currentCount={employees.length}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* =========================================================================
            SLIDE-OVER EMPLOYEE DETAIL DRAWER (1:1 PARITY WITH PROJECTS & TASKS)
           ========================================================================= */}
        {selectedEmployee &&
          createPortal(
            <div className="fixed inset-0 z-[99999] overflow-hidden font-['Inter',sans-serif]">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={() => setSelectedEmployee(null)}
              />
              <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-200">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20 shrink-0">
                        {getInitials(selectedEmployee.user?.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 truncate">
                            {selectedEmployee.user?.name || selectedEmployee.employee_number}
                          </h3>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
                            {selectedEmployee.employee_number}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate font-mono">
                          {selectedEmployee.user?.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEmployee(null)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Drawer Tab Navigation */}
                  <div className="px-5 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold overflow-x-auto custom-scrollbar">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'credentials', label: 'Access & Roles' },
                      { id: 'onboarding', label: `Onboarding (${(selectedEmployee.onboardingTasks || selectedEmployee.onboarding_tasks || []).length})` },
                      { id: 'skills', label: `Skills (${(selectedEmployee.skills || []).length})` },
                      { id: 'history', label: 'Audit Trail' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDrawerTab(tab.id as any)}
                        className={`py-3 relative cursor-pointer whitespace-nowrap ${
                          drawerTab === tab.id
                            ? 'text-[#F95716] font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {drawerTab === tab.id && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F95716] rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Drawer Tab Content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
                    {drawerLoading ? (
                      <div className="py-16 text-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#F95716] mx-auto" />
                        <p className="text-xs text-slate-400">Loading profile data...</p>
                      </div>
                    ) : drawerTab === 'overview' ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Employment Status:</span>
                            <PortfolioStatusBadge status={selectedEmployee.status} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Department:</span>
                            <span className="font-semibold text-slate-800">
                              {selectedEmployee.department?.name || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Job Title / Designation:</span>
                            <span className="font-medium text-slate-800">
                              {selectedEmployee.designation?.name || 'Team Member'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Reporting Manager:</span>
                            <span className="font-medium text-slate-800">
                              {selectedEmployee.managerMembership?.user?.name || 'None / Direct'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Work Arrangement:</span>
                            <span className="capitalize font-semibold text-[#F95716]">
                              {selectedEmployee.work_arrangement || 'Remote'} ({selectedEmployee.employment_type})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Work Location:</span>
                            <span className="font-medium text-slate-800">
                              {selectedEmployee.work_location || 'Headquarters'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hire Date:</span>
                            <span className="font-mono text-slate-800">
                              {formatDate(selectedEmployee.hire_date)}
                            </span>
                          </div>
                          {selectedEmployee.probation_end_date && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Probation Target:</span>
                              <span className="font-mono text-slate-800">
                                {formatDate(selectedEmployee.probation_end_date)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Status Transition Quick Actions */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Quick Status Transitions
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {selectedEmployee.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus('active')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold cursor-pointer"
                              >
                                Mark Active
                              </button>
                            )}
                            {selectedEmployee.status !== 'on_leave' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus('on_leave')}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-semibold cursor-pointer"
                              >
                                Mark On Leave
                              </button>
                            )}
                            {selectedEmployee.status !== 'suspended' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus('suspended')}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold cursor-pointer"
                              >
                                Suspend Access
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : drawerTab === 'credentials' ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Organization:</span>
                            <span className="font-bold text-slate-800 font-mono text-[11px]">
                              {companySlug}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Assigned Role:</span>
                            <span className="font-semibold text-[#F95716] capitalize">
                              {selectedEmployee.membership?.roles?.[0]?.name || 'Employee'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account Identity:</span>
                            <span className="font-mono text-slate-800">
                              {selectedEmployee.user?.email}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Membership Status:</span>
                            <span className="font-semibold text-emerald-600 flex items-center gap-1 font-mono">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </span>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200/80 space-y-2">
                          <h5 className="font-bold text-orange-950 text-xs">Credentials Management</h5>
                          <p className="text-[11px] text-orange-900 leading-relaxed">
                            Generate a new secure temporary password for this employee account. They will be able to sign in immediately with the new credentials.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEmployeeToReset(selectedEmployee);
                              setShowResetPasswordModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F95716] text-white text-xs font-bold hover:bg-[#e0480c] transition-all cursor-pointer mt-1"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Reset Credentials</span>
                          </button>
                        </div>
                      </div>
                    ) : drawerTab === 'onboarding' ? (
                      <div className="space-y-3">
                        <p className="text-slate-500 text-[11.5px]">
                          Checklist tasks created for this employee onboarding workflow. Click to toggle status:
                        </p>
                        {(selectedEmployee.onboardingTasks || selectedEmployee.onboarding_tasks || []).length > 0 ? (
                          <div className="space-y-2">
                            {(selectedEmployee.onboardingTasks || selectedEmployee.onboarding_tasks || []).map((t) => (
                              <div
                                key={t.id}
                                onClick={() => handleToggleTask(t.id)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                  t.status === 'completed'
                                    ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                                    : 'bg-white border-slate-200 hover:border-orange-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={t.status === 'completed'}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded border-slate-300 text-[#F95716] focus:ring-[#F95716]/20 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className={`font-bold text-xs block ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                    {t.title}
                                  </span>
                                  {t.description && (
                                    <span className="text-[11px] text-slate-400 block mt-0.5">
                                      {t.description}
                                    </span>
                                  )}
                                  {t.due_date && (
                                    <span className="text-[10px] font-mono text-slate-400 block mt-1">
                                      Target: {formatDate(t.due_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-center">
                            No onboarding tasks configured.
                          </div>
                        )}
                      </div>
                    ) : drawerTab === 'skills' ? (
                      <div className="space-y-3">
                        <p className="text-slate-500 text-[11.5px]">
                          Technical and domain proficiencies associated with this employee profile:
                        </p>
                        {(selectedEmployee.skills || []).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {(selectedEmployee.skills || []).map((s) => (
                              <div
                                key={s.id}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs"
                              >
                                <Award className="w-3.5 h-3.5 text-[#F95716]" />
                                <span className="font-bold text-slate-800">{s.skill_name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-500 capitalize">
                                  {s.proficiency_level} • {s.years_of_experience}y
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-center">
                            No skills cataloged yet.
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Audit Trail */
                      <div className="space-y-3">
                        <p className="text-slate-500 text-[11.5px]">
                          Employee lifecycle change history and security logs:
                        </p>
                        {(selectedEmployee.history || []).length > 0 ? (
                          <div className="space-y-2">
                            {(selectedEmployee.history || []).map((evt) => (
                              <div
                                key={evt.id}
                                className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-800 capitalize block">
                                    {evt.change_type}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block">
                                    {evt.reason || 'Lifecycle event recorded'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                                    {formatDate(evt.effective_at)}
                                  </span>
                                </div>
                                <span className="text-slate-500 text-[11px] font-medium">
                                  {evt.changed_by_user?.name || 'Administrator'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-center">
                            No change log records captured yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(selectedEmployee)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Employee</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeToOffboard(selectedEmployee);
                          setShowOffboardModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-amber-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Offboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeToReset(selectedEmployee);
                          setShowResetPasswordModal(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Credentials</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            CREATE EMPLOYEE MODAL (PORTAL TO DOCUMENT.BODY: FULL-PAGE OVERLAY)
           ========================================================================= */}
        <CreateEmployeeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(creds, newEmp) => {
            setShowCreateModal(false);
            setActiveCredentials(creds);
            setShowCredentialsModal(true);
            fetchEmployees(true);
          }}
          companySlug={companySlug || 'bitspark-ops'}
          companyName="Bitspark Global Operations"
          departments={departments}
          designations={designations}
          managers={managers}
        />

        {/* =========================================================================
            EMPLOYEE CREDENTIALS SUCCESS MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        <EmployeeCredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false);
            setActiveCredentials(null);
          }}
          credentials={activeCredentials}
        />

        {/* =========================================================================
            RESET PASSWORD MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        <ResetPasswordModal
          isOpen={showResetPasswordModal}
          onClose={() => {
            setShowResetPasswordModal(false);
            setEmployeeToReset(null);
          }}
          employee={employeeToReset}
          companySlug={companySlug || 'bitspark-ops'}
          onSuccess={(creds) => {
            setShowResetPasswordModal(false);
            setEmployeeToReset(null);
            setActiveCredentials(creds);
            setShowCredentialsModal(true);
          }}
        />

        {/* =========================================================================
            OFFBOARDING MODAL (PORTAL TO DOCUMENT.BODY)
           ========================================================================= */}
        {showOffboardModal && employeeToOffboard &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-['Inter',sans-serif]">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4 my-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
                      <UserX className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Initiate Offboarding</h3>
                      <p className="text-[11px] text-slate-400">
                        {employeeToOffboard.user?.name || employeeToOffboard.employee_number}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOffboardModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitOffboard} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Departure Reason *</label>
                    <input
                      type="text"
                      required
                      value={offboardReason}
                      onChange={(e) => setOffboardReason(e.target.value)}
                      placeholder="e.g. Resignation, Project completion, Relocation"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <input
                      type="checkbox"
                      id="immediate-revocation"
                      checked={offboardImmediate}
                      onChange={(e) => setOffboardImmediate(e.target.checked)}
                      className="rounded border-slate-300 text-[#F95716] focus:ring-[#F95716]/20 cursor-pointer"
                    />
                    <label htmlFor="immediate-revocation" className="text-slate-700 font-medium cursor-pointer">
                      Revoke active workspace access &amp; session tokens immediately
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowOffboardModal(false)}
                      disabled={offboardLoading}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={offboardLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {offboardLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Initiate Offboarding</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* =========================================================================
            PORTFOLIO FOOTER (ACTIVE LINK SET TO EMPLOYEES)
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} activeLink="employees" />
      </div>
    </AppShell>
  );
};

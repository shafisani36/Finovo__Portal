import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  Folder,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Users,
  GitCommit,
  FileText,
  DollarSign,
  TrendingUp,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Activity,
  Layers,
  CheckSquare,
  AlertOctagon,
  ArrowRight,
  Link as LinkIcon,
  HelpCircle,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
  Columns3,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  SlidersHorizontal,
  RefreshCw,
  ChevronsUp,
  Equal,
  ChevronsDown,
  MoreHorizontal,
  Flag,
  ChevronDown,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';
import { notifyProjectsUpdated } from '../lib/projectSync';
import { CustomDropdown, CustomCheckboxDropdown, CustomActionDropdown } from '../components/ui/CustomDropdown';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
  PortfolioPriorityBadge,
  PortfolioStatusBadge,
} from '../components/portfolio';

interface ProjectMember {
  id: number;
  project_id: number;
  membership_id: number;
  project_role: string;
  allocation_percent: number;
  joined_at: string;
  membership?: {
    id: number;
    user: { id: number; name: string; email: string };
  };
}

interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  status: 'planned' | 'in_progress' | 'review' | 'completed' | 'blocked';
  weight: number;
  baseline_due_date?: string;
  forecast_due_date?: string;
  actual_completed_at?: string;
  order: number;
  predecessors?: { id: number; predecessor_milestone_id: number; predecessor?: { name: string } }[];
  deliverables?: { id: number; name: string; acceptance_status: string }[];
}

interface ScopeRevision {
  id: number;
  project_id: number;
  revision_number: number;
  business_objective: string;
  in_scope?: string;
  out_of_scope?: string;
  status: string;
  approved_at?: string;
  created_at: string;
}

interface ChangeRequest {
  id: number;
  project_id: number;
  request_type: 'scope' | 'schedule' | 'budget';
  title: string;
  reason: string;
  impact_summary?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  created_at: string;
}

interface ProjectRisk {
  id: number;
  project_id: number;
  type: 'risk' | 'issue' | 'blocker';
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
  status: 'open' | 'mitigating' | 'resolved';
  mitigation_plan?: string;
  resolved_at?: string;
  created_at: string;
}

interface ProjectDecision {
  id: number;
  project_id: number;
  title: string;
  decision: string;
  rationale?: string;
  decided_at: string;
}

interface ProjectDocument {
  id: number;
  project_id: number;
  document_name: string;
  document_type?: string;
  file_path: string;
  visibility: 'internal' | 'client_visible';
  created_at: string;
}

interface Project {
  id: number;
  company_id: number;
  project_code: string;
  name: string;
  client_name?: string;
  manager_membership_id?: number;
  manager?: {
    id: number;
    user: { id: number; name: string; email: string };
  };
  project_type: string;
  priority: string;
  status: 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'closed' | 'cancelled';
  health_status: 'healthy' | 'at_risk' | 'critical' | 'unknown';
  billing_model: string;
  budget_amount: number;
  currency: string;
  start_date?: string;
  target_end_date?: string;
  progress_percent: number;
  version: number;
  created_at: string;
  health_signals?: string[];
  members?: ProjectMember[];
  milestones?: Milestone[];
  scope_revisions?: ScopeRevision[];
  change_requests?: ChangeRequest[];
  risks?: ProjectRisk[];
  decisions?: ProjectDecision[];
  documents?: ProjectDocument[];
}

interface MemberOption {
  id: number;
  user: { id: number; name: string; email: string };
}

export const ProjectManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { confirm: confirmModal, alert: alertModal } = useConfirm();

  // Directory State - initialized from cache pipeline for 0ms instant render
  const initialCacheKey = `projects_${companySlug}_default`;
  const cachedProjects = dataPipeline.get<{ projects: Project[]; total: number; stats?: any }>(initialCacheKey);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>(
    () => dataPipeline.get(`departments_${companySlug}`) || []
  );

  const [projects, setProjects] = useState<Project[]>(() => cachedProjects?.projects || []);
  const [totalCount, setTotalCount] = useState(() => cachedProjects?.total || 0);
  const [portfolioStats, setPortfolioStats] = useState(() => cachedProjects?.stats || {
    total: cachedProjects?.total || 0,
    active: 0,
    planning: 0,
    on_hold: 0,
    completed: 0,
    archived: 0,
    at_risk: 0,
    priority_high: 0,
    priority_medium: 0,
    priority_low: 0,
  });
  const [loading, setLoading] = useState(!cachedProjects);
  const [isValidating, setIsValidating] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || []
  );

  // View Mode: 'table' | 'grid' | 'kanban'
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'kanban'>(() => {
    try {
      return (localStorage.getItem('finovo_projects_view_mode') as any) || 'table';
    } catch {
      return 'table';
    }
  });

  const handleSetViewMode = (mode: 'table' | 'grid' | 'kanban') => {
    setViewMode(mode);
    try {
      localStorage.setItem('finovo_projects_view_mode', mode);
    } catch {}
  };

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Selected Project Slide-Over
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'milestones' | 'scope' | 'team' | 'risks' | 'decisions' | 'lifecycle'
  >('overview');
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Table selection & column dropdown
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    Department: true,
    Description: true,
    Priority: true,
    Status: true,
    Deadline: true,
    Manager: true,
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getProjectAvatarColor = (name: string, index: number) => {
    const colors = [
      'bg-[#F95716]', // Vibrant orange
      'bg-rose-600',  // Crimson
      'bg-slate-900', // Dark navy
      'bg-indigo-600',// Indigo
      'bg-teal-600',  // Teal
      'bg-blue-600',  // Blue
      'bg-amber-600', // Amber
    ];
    return colors[index % colors.length];
  };

  const handleToggleSelectAll = () => {
    if (selectedProjectIds.length === projects.length && projects.length > 0) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
  };

  const handleToggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportProjects = () => {
    if (projects.length === 0) {
      alertModal?.('No projects to export in this workspace.');
      return;
    }
    const headers = ['Code', 'Name', 'Department', 'Description', 'Priority', 'Status', 'Deadline', 'Manager'];
    const rows = projects.map((p) => [
      p.project_code || `PRJ-${p.id}`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.department?.name || p.project_type || '').replace(/"/g, '""')}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      p.priority || 'medium',
      p.status || 'planning',
      p.target_end_date || '',
      `"${(p.manager?.user?.name || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finovo-projects-${companySlug || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Form States
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Project Creation Form
  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pClient, setPClient] = useState('');
  const [pManagerId, setPManagerId] = useState('');
  const [pType, setPType] = useState('web_app');
  const [pPriority, setPPriority] = useState('medium');
  const [pBilling, setPBilling] = useState('fixed_price');
  const [pBudget, setPBudget] = useState('50000');
  const [pCurrency, setPCurrency] = useState('USD');
  const [pStartDate, setPStartDate] = useState('');
  const [pEndDate, setPEndDate] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pObjective, setPObjective] = useState('');
  const [pInScope, setPInScope] = useState('');
  const [pOutScope, setPOutScope] = useState('');

  // Milestone Form
  const [msName, setMsName] = useState('');
  const [msWeight, setMsWeight] = useState(25);
  const [msDue, setMsDue] = useState('');
  const [msDesc, setMsDesc] = useState('');

  // Dependency Form
  const [depPredecessorId, setDepPredecessorId] = useState('');
  const [depSuccessorId, setDepSuccessorId] = useState('');

  // Member Assignment Form
  const [memMembershipId, setMemMembershipId] = useState('');
  const [memRole, setMemRole] = useState('developer');
  const [memAllocation, setMemAllocation] = useState(100);

  // Risk Form
  const [riskType, setRiskType] = useState<'risk' | 'issue' | 'blocker'>('risk');
  const [riskTitle, setRiskTitle] = useState('');
  const [riskSeverity, setRiskSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [riskProb, setRiskProb] = useState<'low' | 'medium' | 'high'>('medium');
  const [riskMitigation, setRiskMitigation] = useState('');

  // Change Request Form
  const [crType, setCrType] = useState<'scope' | 'schedule' | 'budget'>('scope');
  const [crTitle, setCrTitle] = useState('');
  const [crReason, setCrReason] = useState('');
  const [crImpact, setCrImpact] = useState('');

  // Decision Form
  const [decTitle, setDecTitle] = useState('');
  const [decDecision, setDecDecision] = useState('');
  const [decRationale, setDecRationale] = useState('');

  // Doc Form
  const [docName, setDocName] = useState('');
  const [docPath, setDocPath] = useState('');
  const [docVis, setDocVis] = useState<'internal' | 'client_visible'>('internal');

  // Status Transition Form
  const [transStatus, setTransStatus] = useState('active');
  const [transReason, setTransReason] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Lazy fetch members only when modals are opened or needed
  const fetchMembers = useCallback(async () => {
    const cacheKey = `members_${companySlug}`;
    const cached = dataPipeline.get<MemberOption[]>(cacheKey);
    if (cached) {
      setMembers(cached);
      return;
    }
    try {
      const res = await api.get(`/companies/${companySlug}/members?per_page=100&status=active`);
      const list = res.data.data || [];
      setMembers(list);
      dataPipeline.set(cacheKey, list, 300000);
    } catch {
      // Handled
    }
  }, [companySlug]);

  // Fetch company departments
  useEffect(() => {
    if (!companySlug) return;
    const loadDepts = async () => {
      try {
        const res = await api.get(`/companies/${companySlug}/departments?per_page=50`);
        const list = res.data.data || [];
        setDepartments(list);
        dataPipeline.set(`departments_${companySlug}`, list, 300000);
      } catch {}
    };
    loadDepts();
  }, [companySlug]);

  // Global Keyboard Shortcuts (N -> Add Project, / -> Focus Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key.toLowerCase() === 'n' && !selectedProject) {
        e.preventDefault();
        navigate(`/app/${companySlug}/projects/create`);
      }
      if (e.key === '/' && !selectedProject) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companySlug, selectedProject, navigate]);

  // Fetch Directory with High-Speed Pipeline & SWR Caching
  const fetchProjects = useCallback(async (forceFresh = false) => {
    if (!companySlug) return;
    const effectiveStatus =
      activeTabFilter === 'all'
        ? statusFilter
        : activeTabFilter === 'archived'
        ? 'closed'
        : activeTabFilter;
    const effectiveHealth = healthFilter;

    const cacheKey = `projects_${companySlug}_${page}_${debouncedSearch}_${effectiveStatus}_${effectiveHealth}_${priorityFilter}_${deptFilter}_${sortBy}_${sortDirection}`;
    const cached = dataPipeline.get<{ projects: Project[]; total: number; stats?: any }>(cacheKey);

    if (cached && !forceFresh) {
      setProjects(cached.projects);
      setTotalCount(cached.total);
      if (cached.stats) setPortfolioStats(cached.stats);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (effectiveStatus) params.append('status', effectiveStatus);
      if (effectiveHealth) params.append('health_status', effectiveHealth);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (sortBy) params.append('sort_by', sortBy);
      if (sortDirection) params.append('sort_direction', sortDirection);
      params.append('page', page.toString());
      params.append('per_page', '15');

      const res = await api.get(`/companies/${companySlug}/projects?${params.toString()}`);
      const projectList = res.data.projects?.data || res.data.data || (Array.isArray(res.data.projects) ? res.data.projects : []);
      const total = Number(res.data.projects?.total ?? res.data.total ?? projectList.length);
      const stats = res.data.stats || {
        total,
        active: projectList.filter((p: any) => p.status === 'active').length,
        planning: projectList.filter((p: any) => p.status === 'planning').length,
        on_hold: projectList.filter((p: any) => p.status === 'on_hold').length,
        completed: projectList.filter((p: any) => p.status === 'completed').length,
        archived: projectList.filter((p: any) => p.status === 'closed' || p.status === 'archived').length,
        at_risk: projectList.filter((p: any) => p.health_status === 'at_risk' || p.health_status === 'critical').length,
        priority_high: projectList.filter((p: any) => p.priority === 'high' || p.priority === 'critical').length,
        priority_medium: projectList.filter((p: any) => p.priority === 'medium').length,
        priority_low: projectList.filter((p: any) => p.priority === 'low').length,
      };

      setProjects(projectList);
      setTotalCount(total);
      setPortfolioStats(stats);

      dataPipeline.set(cacheKey, { projects: projectList, total, stats }, 120000);
      if (!debouncedSearch && !effectiveStatus && !effectiveHealth && !priorityFilter && !deptFilter && page === 1) {
        dataPipeline.set(`projects_${companySlug}_default`, { projects: projectList, total, stats }, 120000);
      }

      // Reactive update to sidebar counter & ongoing projects list
      notifyProjectsUpdated(companySlug, total, projectList);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }, [companySlug, page, debouncedSearch, activeTabFilter, statusFilter, healthFilter, priorityFilter, deptFilter, sortBy, sortDirection]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Support URL query param ?selected=123 to open drawer directly
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('selected');
    if (selectedId && !selectedProject) {
      fetchProjectDetails(parseInt(selectedId));
    }
  }, [window.location.search]);

  const fetchProjectDetails = async (projectId: number) => {
    const cacheKey = `project_detail_${companySlug}_${projectId}`;
    const cached = dataPipeline.get<Project>(cacheKey);
    if (cached) {
      setSelectedProject(cached);
    } else {
      setDetailLoading(true);
    }
    try {
      const res = await api.get(`/companies/${companySlug}/projects/${projectId}`);
      if (res.data.project) {
        setSelectedProject(res.data.project);
        dataPipeline.set(cacheKey, res.data.project, 120000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTabChange = (tab: 'all' | 'active' | 'planning' | 'on_hold' | 'at_risk' | 'completed') => {
    setActiveTabFilter(tab);
    setPage(1);
    if (tab === 'at_risk') {
      setStatusFilter('');
      setHealthFilter('at_risk');
    } else if (tab === 'all') {
      setStatusFilter('');
      setHealthFilter('');
    } else {
      setStatusFilter(tab);
      setHealthFilter('');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActiveTabFilter('all');
    setStatusFilter('');
    setHealthFilter('');
    setPriorityFilter('');
    setPage(1);
  };

  // Open Quick Create Modal and fetch members lazily
  const openCreateModal = () => {
    setFormError(null);
    setPName('');
    setPCode(`PRJ-${String(totalCount + 1).padStart(3, '0')}`);
    setPClient('');
    setPManagerId('');
    setPBudget('50000');
    setPStartDate(new Date().toISOString().split('T')[0]);
    setShowCreateModal(true);
    fetchMembers();
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await api.post(`/companies/${companySlug}/projects`, {
        name: pName,
        project_code: pCode,
        client_name: pClient || undefined,
        manager_membership_id: pManagerId ? parseInt(pManagerId) : undefined,
        project_type: pType,
        priority: pPriority,
        billing_model: pBilling,
        budget_amount: parseFloat(pBudget),
        currency: pCurrency,
        start_date: pStartDate || undefined,
        target_end_date: pEndDate || undefined,
        description: pDesc || undefined,
        business_objective: pObjective || undefined,
        in_scope: pInScope || undefined,
        out_of_scope: pOutScope || undefined,
      });

      setShowCreateModal(false);
      fetchProjects();
      if (res.data.project) {
        fetchProjectDetails(res.data.project.id);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setFormLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const res = await api.get(`/companies/${companySlug}/projects/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `projects_${companySlug}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      await alertModal({ title: 'Export Failed', message: 'Failed to export projects.', variant: 'danger' });
    }
  };

  // Transition Status (Lifecycle)
  const handleTransitionStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/transitions`, {
        status: transStatus,
        reason: transReason || undefined,
      });
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
      await alertModal({
        title: 'Status Transitioned',
        message: `Project status successfully transitioned to "${transStatus}".`,
        variant: 'success',
      });
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to change project status.');
    } finally {
      setFormLoading(false);
    }
  };

  // Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/milestones`, {
        name: msName,
        weight: msWeight,
        baseline_due_date: msDue || undefined,
        description: msDesc || undefined,
      });
      setShowMilestoneModal(false);
      setMsName('');
      setMsDesc('');
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to add milestone');
    } finally {
      setFormLoading(false);
    }
  };

  // Complete Milestone
  const handleCompleteMilestone = async (milestoneId: number) => {
    if (!selectedProject) return;
    const ok = await confirmModal({
      title: 'Complete Milestone',
      message: 'Mark milestone as complete? This will recalculate progress and health.',
      confirmText: 'Complete Milestone',
      variant: 'info',
    });
    if (!ok) return;
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/milestones/${milestoneId}/complete`);
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (err: any) {
      await alertModal({
        title: 'Milestone Error',
        message: err.response?.data?.message || 'Failed to complete milestone',
        variant: 'danger',
      });
    }
  };

  // Add Milestone Dependency (DAG Cycle Prevention)
  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/milestone-dependencies`, {
        predecessor_milestone_id: parseInt(depPredecessorId),
        successor_milestone_id: parseInt(depSuccessorId),
        dependency_type: 'finish_to_start',
      });
      setShowDependencyModal(false);
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to add dependency (possible circular loop)');
    } finally {
      setFormLoading(false);
    }
  };

  // Assign Team Member
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/members`, {
        membership_id: parseInt(memMembershipId),
        project_role: memRole,
        allocation_percent: memAllocation,
      });
      setShowMemberModal(false);
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to assign team member');
    } finally {
      setFormLoading(false);
    }
  };

  // Remove Team Member
  const handleRemoveMember = async (memberId: number) => {
    if (!selectedProject) return;
    const ok = await confirmModal({
      title: 'Remove Team Member',
      message: 'Are you sure you want to remove this member from the project?',
      confirmText: 'Remove Member',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/companies/${companySlug}/projects/${selectedProject.id}/members/${memberId}`);
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      await alertModal({
        title: 'Member Error',
        message: err.response?.data?.message || 'Failed to remove member',
        variant: 'danger',
      });
    }
  };

  // Log Risk / Blocker
  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/risks`, {
        type: riskType,
        title: riskTitle,
        severity: riskSeverity,
        probability: riskProb,
        mitigation_plan: riskMitigation || undefined,
      });
      setShowRiskModal(false);
      setRiskTitle('');
      setRiskMitigation('');
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to log risk');
    } finally {
      setFormLoading(false);
    }
  };

  // Resolve Risk
  const handleResolveRisk = async (riskId: number) => {
    if (!selectedProject) return;
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/risks/${riskId}/resolve`);
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (err: any) {
      await alertModal({
        title: 'Risk Error',
        message: err.response?.data?.message || 'Failed to resolve risk',
        variant: 'danger',
      });
    }
  };

  // Propose Change Request
  const handleAddChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/change-requests`, {
        request_type: crType,
        title: crTitle,
        reason: crReason,
        impact_summary: crImpact || undefined,
      });
      setShowChangeRequestModal(false);
      setCrTitle('');
      setCrReason('');
      setCrImpact('');
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit change request');
    } finally {
      setFormLoading(false);
    }
  };

  // Review Change Request
  const handleReviewChangeRequest = async (crId: number, status: 'approved' | 'rejected') => {
    if (!selectedProject) return;
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/change-requests/${crId}/review`, {
        status,
      });
      await fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (err: any) {
      await alertModal({
        title: 'Change Request Error',
        message: err.response?.data?.message || 'Failed to review change request',
        variant: 'danger',
      });
    }
  };

  // Log Decision
  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/decisions`, {
        title: decTitle,
        decision: decDecision,
        rationale: decRationale || undefined,
      });
      setShowDecisionModal(false);
      setDecTitle('');
      setDecDecision('');
      setDecRationale('');
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to record decision');
    } finally {
      setFormLoading(false);
    }
  };

  // Add Document
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(`/companies/${companySlug}/projects/${selectedProject.id}/documents`, {
        document_name: docName,
        file_path: docPath,
        visibility: docVis,
      });
      setShowDocModal(false);
      setDocName('');
      setDocPath('');
      await fetchProjectDetails(selectedProject.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to record document');
    } finally {
      setFormLoading(false);
    }
  };

  const formatDisplayDate = (d?: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SA';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };



  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* =========================================================================
            TOP PORTFOLIO HEADER
           ========================================================================= */}
        <PortfolioPageHeader
          category="PORTFOLIO"
          title="Projects"
          subtitle="Track every project across departments — status, priority, deadlines and ownership."
          onExport={handleExportCsv}
          onAdd={() => navigate(`/app/${companySlug}/projects/create`)}
          addLabel="Add project"
          addShortcut="N"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<Folder className="w-4 h-4 fill-blue-500/20" />}
          totalCount={portfolioStats.total}
          totalLabel="Total projects"
          scopeLabel="across all departments"
          distribution={[
            { key: 'planning', label: 'Planning', count: portfolioStats.planning, colorClass: 'bg-blue-500', showPercent: true },
            { key: 'ongoing', label: 'Ongoing', count: portfolioStats.active, colorClass: 'bg-[#F95716]', showPercent: true },
            { key: 'on_hold', label: 'On hold', count: portfolioStats.on_hold, colorClass: 'bg-slate-300', dotClass: 'bg-slate-300 rounded-full', showPercent: false },
            { key: 'completed', label: 'Completed', count: portfolioStats.completed, colorClass: 'bg-emerald-500', dotClass: 'bg-emerald-500 rounded-full', showPercent: false },
            { key: 'archived', label: 'Archived', count: portfolioStats.archived || 0, colorClass: 'bg-slate-500', dotClass: 'bg-slate-500 rounded-full', showPercent: false },
          ]}
          priorityMix={{
            high: portfolioStats.priority_high ?? 0,
            medium: portfolioStats.priority_medium ?? 0,
            low: portfolioStats.priority_low ?? 0,
            total: portfolioStats.total,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'all', label: 'All', count: portfolioStats.total },
            { id: 'planning', label: 'Planning', count: portfolioStats.planning, dotColor: 'bg-blue-500' },
            { id: 'active', label: 'Ongoing', count: portfolioStats.active, dotColor: 'bg-[#F95716]' },
            { id: 'on_hold', label: 'On hold', count: portfolioStats.on_hold, dotColor: 'bg-slate-400' },
            { id: 'completed', label: 'Completed', count: portfolioStats.completed, dotColor: 'bg-emerald-500' },
            { id: 'archived', label: 'Archived', count: portfolioStats.archived || 0, dotColor: 'bg-slate-500' },
          ]}
          activeTab={activeTabFilter}
          onTabChange={(tabId) => handleTabChange(tabId as any)}
          viewMode={viewMode === 'grid' ? 'grid' : 'table'}
          onViewModeChange={handleSetViewMode}
        />

        {/* =========================================================================
            SEARCH AND CONTROLS TOOLBAR (MATCHES FIGMA IMAGE 3)
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search project name, code, manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-mono border border-slate-200/80">
                /
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priorities Filter */}
            <CustomDropdown
              value={priorityFilter}
              onChange={(val) => {
                setPriorityFilter(val);
                setPage(1);
              }}
              placeholder="All priorities"
              size="sm"
              variant="filter"
              leadingIcon={<Flag className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All priorities' },
                { value: 'high', label: 'High Priority', badge: 'High', colorDot: '#e11d48' },
                { value: 'medium', label: 'Medium Priority', badge: 'Medium', colorDot: '#d97706' },
                { value: 'low', label: 'Low Priority', badge: 'Low', colorDot: '#0d9488' },
              ]}
              searchable={false}
              className="min-w-[145px]"
            />

            {/* Department Filter */}
            <CustomDropdown
              value={deptFilter}
              onChange={(val) => {
                setDeptFilter(val);
                setPage(1);
              }}
              placeholder="All departments"
              size="sm"
              variant="filter"
              leadingIcon={<Folder className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All departments' },
                ...departments.map((d) => ({ value: d.name, label: d.name })),
              ]}
              searchable={departments.length > 5}
              className="min-w-[160px]"
            />

            {/* Sort Dropdown */}
            <CustomDropdown
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
              size="sm"
              variant="filter"
              leadingIcon={<ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: 'created_at', label: 'Sort: Newest' },
                { value: 'name', label: 'Sort: Name A-Z' },
                { value: 'progress_percent', label: 'Sort: Progress %' },
                { value: 'budget_amount', label: 'Sort: Budget' },
                { value: 'target_end_date', label: 'Sort: Deadline' },
              ]}
              searchable={false}
              className="min-w-[150px]"
            />

            {/* Columns Toggle Dropdown */}
            <CustomCheckboxDropdown
              label="Columns"
              title="Toggle Columns"
              icon={<Columns3 className="w-3.5 h-3.5 text-slate-400" />}
              items={[
                { id: 'Department', label: 'Department', checked: visibleColumns.Department },
                { id: 'Description', label: 'Description', checked: visibleColumns.Description },
                { id: 'Priority', label: 'Priority', checked: visibleColumns.Priority },
                { id: 'Status', label: 'Status', checked: visibleColumns.Status },
                { id: 'Deadline', label: 'Deadline', checked: visibleColumns.Deadline },
                { id: 'Manager', label: 'Manager', checked: visibleColumns.Manager },
              ]}
              onToggle={toggleColumn}
              onSelectAll={() =>
                setVisibleColumns({
                  Department: true,
                  Description: true,
                  Priority: true,
                  Status: true,
                  Deadline: true,
                  Manager: true,
                })
              }
              onDeselectAll={() =>
                setVisibleColumns({
                  Department: false,
                  Description: false,
                  Priority: false,
                  Status: false,
                  Deadline: false,
                  Manager: false,
                })
              }
              size="sm"
            />

            {/* Refresh Button */}
            <button
              onClick={() => fetchProjects(true)}
              disabled={isValidating}
              className="p-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-[#F95716]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Subtle Background Revalidation Indicator */}
        {isValidating && projects.length > 0 && (
          <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-[#F95716] animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {/* =========================================================================
            DATA VIEW: 1:1 ENTERPRISE TABLE OR GRID VIEW (MATCHES FIGMA IMAGE 3)
           ========================================================================= */}
        {viewMode === 'grid' ? (
          /* GRID VIEW */
          projects.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {search || priorityFilter || deptFilter || activeTabFilter !== 'all'
                  ? 'No Projects Match Active Filters'
                  : 'No Projects in Workspace'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {search || priorityFilter || deptFilter || activeTabFilter !== 'all'
                  ? 'Try adjusting your search query, status tab, or priority filter.'
                  : 'Provision your first project workspace to start tracking delivery.'}
              </p>
              <button
                onClick={() => navigate(`/app/${companySlug}/projects/create`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#F95716] text-white hover:bg-[#e0480c] transition-all cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, idx) => (
                <div
                  key={project.id}
                  onClick={() => fetchProjectDetails(project.id)}
                  className="group rounded-2xl bg-white border border-slate-200/80 hover:border-orange-300 hover:shadow-md p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ${getProjectAvatarColor(
                            project.name,
                            idx
                          )}`}
                        >
                          {(project.name || 'P')[0].toUpperCase()}
                        </div>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                          {project.project_code || `PRJ-${project.id}`}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            project.status === 'active'
                              ? 'bg-amber-500'
                              : project.status === 'planning'
                              ? 'bg-blue-500'
                              : project.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#F95716] transition-colors line-clamp-1">
                        {project.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {project.description || project.objective || 'No description provided'}
                      </p>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                        <span>Progress</span>
                        <span className="text-slate-900 font-bold">{Math.round(project.progress_percent)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#F95716] h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, project.progress_percent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                        {project.manager?.user ? (project.manager.user.name || 'U')[0].toUpperCase() : 'SA'}
                      </div>
                      <span className="text-slate-700 text-[11px] font-medium truncate max-w-[100px]">
                        {project.manager?.user?.name || 'SuperAdmin'}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-700">
                      {project.budget_amount ? `$${Number(project.budget_amount).toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* =========================================================================
             VIEW: 1:1 HIGH-DENSITY ENTERPRISE TABLE VIEW (MATCHES FIGMA IMAGE 3)
             ========================================================================= */
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={projects.length > 0 && selectedProjectIds.length === projects.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer"
                        title="Select all projects"
                      />
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-700 transition-colors"
                      onClick={() => {
                        setSortBy('name');
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>PROJECT</span>
                        <span className="text-[11px]">↑</span>
                      </div>
                    </th>
                    {visibleColumns.Department && <th className="py-3 px-4">DEPARTMENT</th>}
                    {visibleColumns.Description && <th className="py-3 px-4">DESCRIPTION</th>}
                    {visibleColumns.Priority && <th className="py-3 px-4">PRIORITY</th>}
                    {visibleColumns.Status && <th className="py-3 px-4">STATUS</th>}
                    {visibleColumns.Deadline && <th className="py-3 px-4">DEADLINE</th>}
                    {visibleColumns.Manager && <th className="py-3 px-4">MANAGER</th>}
                    <th className="py-3 px-4 w-10 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90 text-xs">
                  {loading && projects.length === 0 ? (
                    /* SKELETON PREVIEW ROWS */
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-3.5 px-4"><div className="w-4 h-4 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100" />
                            <div className="space-y-1.5">
                              <div className="w-32 h-3.5 bg-slate-100 rounded" />
                              <div className="w-16 h-2.5 bg-slate-100 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4"><div className="w-20 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-40 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-14 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-16 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-20 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="w-24 h-3 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><div className="w-4 h-4 bg-slate-100 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : projects.length === 0 ? (
                    /* EMPTY STATE (PRESERVES TABLE HEADERS AND GEOMETRY) */
                    <tr>
                      <td colSpan={9} className="py-16 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center mx-auto border border-orange-100 shadow-xs">
                            <FolderKanban className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {search || priorityFilter || deptFilter || activeTabFilter !== 'all'
                              ? 'No projects match your active filters'
                              : 'No projects in this workspace yet'}
                          </h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {search || priorityFilter || deptFilter || activeTabFilter !== 'all'
                              ? 'Try adjusting your search query, status tab, or priority filter to find what you are looking for.'
                              : 'Create your first project to track milestones, team capacity, deadlines, and budget governance.'}
                          </p>
                          {search || priorityFilter || deptFilter || activeTabFilter !== 'all' ? (
                            <button
                              onClick={handleClearFilters}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                            >
                              Clear filters
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/app/${companySlug}/projects/create`)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer mt-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add project
                              <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">N</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* POPULATED 1:1 FIGMA ROWS */
                    projects.map((project, idx) => {
                      const isSelected = selectedProjectIds.includes(project.id);
                      return (
                        <tr
                          key={project.id}
                          onClick={() => fetchProjectDetails(project.id)}
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectOne(project.id, e as any)}
                              className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* 2. Project Name + Avatar + Code */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${getProjectAvatarColor(
                                  project.name,
                                  idx
                                )} shadow-2xs`}
                              >
                                {(project.name || 'P')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors truncate text-xs">
                                  {project.name}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                                  {project.project_code || `PRJ-${String(project.id).padStart(4, '0')}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Department */}
                          {visibleColumns.Department && (
                            <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                              {project.department?.name || (project.project_type ? project.project_type.replace('_', ' ') : '—')}
                            </td>
                          )}

                          {/* 4. Description */}
                          {visibleColumns.Description && (
                            <td className="py-3 px-4">
                              <span
                                className="text-xs text-slate-500 max-w-[240px] truncate block"
                                title={project.description || project.objective}
                              >
                                {project.description || project.objective || 'No description provided'}
                              </span>
                            </td>
                          )}

                          {/* 5. Priority (Flag Icon + Text) */}
                          {visibleColumns.Priority && (
                            <td className="py-3 px-4">
                              <PortfolioPriorityBadge priority={project.priority} />
                            </td>
                          )}

                          {/* 6. Status (Colored Dot + Text) */}
                          {visibleColumns.Status && (
                            <td className="py-3 px-4">
                              <PortfolioStatusBadge status={project.status} />
                            </td>
                          )}

                          {/* 7. Deadline */}
                          {visibleColumns.Deadline && (
                            <td className="py-3 px-4">
                              {project.target_end_date ? (
                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{formatDeadline(project.target_end_date)}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          )}

                          {/* 8. Manager */}
                          {visibleColumns.Manager && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {project.manager?.user ? (project.manager.user.name || 'U')[0].toUpperCase() : 'SA'}
                                </div>
                                <span className="text-xs text-slate-700 font-medium truncate max-w-[130px]">
                                  {project.manager?.user?.name || 'System SuperAdmin'}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* 9. Action Menu Dropdown */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <CustomActionDropdown
                              align="right"
                              title="Project Options"
                              trigger={
                                <button
                                  type="button"
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Workspace options"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              }
                              items={[
                                {
                                  id: 'details',
                                  label: 'View Workspace Details',
                                  icon: <Folder className="w-3.5 h-3.5 text-[#F95716]" />,
                                  onClick: () => fetchProjectDetails(project.id),
                                },
                                {
                                  id: 'transition',
                                  label: 'Lifecycle Governance',
                                  icon: <Activity className="w-3.5 h-3.5 text-amber-500" />,
                                  onClick: () => {
                                    fetchProjectDetails(project.id);
                                    setActiveTab('lifecycle');
                                  },
                                },
                                {
                                  id: 'milestones',
                                  label: 'Milestones & Tasks',
                                  icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" />,
                                  onClick: () => {
                                    fetchProjectDetails(project.id);
                                    setActiveTab('milestones');
                                  },
                                },
                                {
                                  id: 'assign',
                                  label: 'Assign Team Member',
                                  icon: <Users className="w-3.5 h-3.5 text-indigo-500" />,
                                  onClick: () => {
                                    fetchProjectDetails(project.id);
                                    setShowMemberModal(true);
                                  },
                                },
                                {
                                  id: 'risk',
                                  label: 'Log Risk / Blocker',
                                  icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />,
                                  onClick: () => {
                                    fetchProjectDetails(project.id);
                                    setShowRiskModal(true);
                                  },
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Row */}
            <PortfolioPagination
              page={page}
              perPage={15}
              totalCount={totalCount || projects.length}
              currentCount={projects.length}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}

        {/* =========================================================================
            BOTTOM GLOBAL STATUS & NAVIGATION FOOTER
           ========================================================================= */}
        <PortfolioFooter
          companySlug={companySlug}
          activeLink="projects"
        />
      </div>

      {/* Slide-Over Project Workspace Drawer */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-xs">
                    {selectedProject.project_code}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedProject.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedProject.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedProject.status}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedProject.health_status === 'healthy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedProject.health_status === 'at_risk'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : selectedProject.health_status === 'critical'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    Engine: {selectedProject.health_status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">v{selectedProject.version}.0</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedProject.name}</h2>
                <p className="text-xs text-slate-500">
                  Client:{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedProject.client_name || 'Internal Product'}
                  </span>{' '}
                  · Manager:{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedProject.manager?.user?.name || 'Unassigned'}
                  </span>
                </p>
              </div>

              <button
                onClick={() => setSelectedProject(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto gap-4">
              {[
                { id: 'overview', label: 'Overview & Health', icon: Activity },
                { id: 'milestones', label: 'Milestones & Gates', icon: Layers },
                { id: 'scope', label: 'Scope & Baselines', icon: GitCommit },
                { id: 'team', label: 'Team Allocation', icon: Users },
                { id: 'risks', label: 'Risks & Blockers', icon: ShieldAlert },
                { id: 'decisions', label: 'Decisions & Docs', icon: FileText },
                { id: 'lifecycle', label: 'Lifecycle Governance', icon: TrendingUp },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'border-[#F95716] text-[#F95716]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#F95716] mb-2" />
                  Loading project telemetry...
                </div>
              ) : (
                <>
                  {/* TAB: OVERVIEW & HEALTH ENGINE */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Health Engine Card */}
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#F95716]" />
                            <h3 className="text-sm font-bold text-slate-900">Explainable Project Health Engine</h3>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                              selectedProject.health_status === 'healthy'
                                ? 'bg-emerald-100 text-emerald-800'
                                : selectedProject.health_status === 'at_risk'
                                ? 'bg-amber-100 text-amber-800'
                                : selectedProject.health_status === 'critical'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {selectedProject.health_status}
                          </span>
                        </div>

                        {selectedProject.health_signals && selectedProject.health_signals.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-700">Observed Signal Triggers:</p>
                            <div className="space-y-1.5">
                              {selectedProject.health_signals.map((sig, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-rose-200/60 text-xs text-rose-700"
                                >
                                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                  <span>{sig}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              All health criteria satisfied. Milestones, schedule, and risks are operating within normal
                              tolerances.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Weighted Milestone Progress */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Progress Calculation</h3>
                            <p className="text-[11px] text-slate-500">
                              Weighted formula: P = (∑ w_i * c_i) / (∑ w_i) × 100
                            </p>
                          </div>
                          <span className="text-2xl font-black text-[#F95716]">
                            {Math.round(selectedProject.progress_percent)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-[#F95716] h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, selectedProject.progress_percent)}%` }}
                          />
                        </div>
                      </div>

                      {/* Commercial & Contractual Controls */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Billing Model</p>
                          <p className="text-sm font-bold text-slate-800 capitalize">
                            {selectedProject.billing_model.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Approved Budget</p>
                          <p className="text-sm font-bold text-slate-800">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: selectedProject.currency,
                            }).format(selectedProject.budget_amount)}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Committed Timeline</p>
                          <p className="text-sm font-bold text-slate-800">
                            {selectedProject.start_date || 'N/A'} → {selectedProject.target_end_date || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: MILESTONES & DELIVERY GATES */}
                  {activeTab === 'milestones' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Milestones & Delivery Gates</h3>
                          <p className="text-xs text-slate-500">
                            Owns high-level delivery commitments with DAG dependency tracking.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDepPredecessorId('');
                              setDepSuccessorId('');
                              setFormError(null);
                              setShowDependencyModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                          >
                            <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                            Link Dependency
                          </button>
                          <button
                            onClick={() => {
                              setMsName('');
                              setMsWeight(25);
                              setMsDue('');
                              setMsDesc('');
                              setFormError(null);
                              setShowMilestoneModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Milestone
                          </button>
                        </div>
                      </div>

                      {/* Milestones List */}
                      <div className="space-y-3">
                        {selectedProject.milestones && selectedProject.milestones.length > 0 ? (
                          selectedProject.milestones.map((ms) => (
                            <div
                              key={ms.id}
                              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-slate-900">{ms.name}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      ms.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {ms.status}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Weight: {ms.weight}%
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">{ms.description || 'No description provided'}</p>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                  <span>Baseline Due: {ms.baseline_due_date || 'Unspecified'}</span>
                                  {ms.predecessors && ms.predecessors.length > 0 && (
                                    <span className="text-purple-600 font-semibold">
                                      Depends on: {ms.predecessors.map((p) => p.predecessor?.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {ms.status !== 'completed' ? (
                                  <button
                                    onClick={() => handleCompleteMilestone(ms.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    Complete Gate
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Accepted</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No milestones configured for this project yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: SCOPE & BASELINES */}
                  {activeTab === 'scope' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Approved Scope Baseline</h3>
                          <p className="text-xs text-slate-500">
                            Changes require formal Change Request approvals to prevent uncontrolled scope creep.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setCrType('scope');
                            setCrTitle('');
                            setCrReason('');
                            setCrImpact('');
                            setFormError(null);
                            setShowChangeRequestModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Propose Change Request
                        </button>
                      </div>

                      {/* Current Active Baseline */}
                      {selectedProject.scope_revisions && selectedProject.scope_revisions.length > 0 ? (
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-xs text-slate-700">
                              Revision #{selectedProject.scope_revisions[0].revision_number} (Approved Baseline)
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Approved on:{' '}
                              {selectedProject.scope_revisions[0].approved_at
                                ? new Date(selectedProject.scope_revisions[0].approved_at).toLocaleDateString()
                                : 'Pending'}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase">Business Objective</p>
                              <p className="text-xs text-slate-800 font-medium mt-0.5">
                                {selectedProject.scope_revisions[0].business_objective}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                <p className="text-[10px] font-bold text-emerald-800 uppercase">In-Scope Deliverables</p>
                                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">
                                  {selectedProject.scope_revisions[0].in_scope || 'None specified'}
                                </p>
                              </div>
                              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                                <p className="text-[10px] font-bold text-rose-800 uppercase">Out-of-Scope Exclusions</p>
                                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">
                                  {selectedProject.scope_revisions[0].out_of_scope || 'None specified'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                          No scope baseline committed yet.
                        </div>
                      )}

                      {/* Change Requests Inbox */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Change Requests Register
                        </h4>
                        {selectedProject.change_requests && selectedProject.change_requests.length > 0 ? (
                          selectedProject.change_requests.map((cr) => (
                            <div
                              key={cr.id}
                              className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">{cr.title}</span>
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                    {cr.request_type}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      cr.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : cr.status === 'rejected'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {cr.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">{cr.reason}</p>
                                {cr.impact_summary && (
                                  <p className="text-[11px] text-slate-400">Impact: {cr.impact_summary}</p>
                                )}
                              </div>

                              {cr.status === 'pending' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleReviewChangeRequest(cr.id, 'approved')}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                  >
                                    Approve & Bump
                                  </button>
                                  <button
                                    onClick={() => handleReviewChangeRequest(cr.id, 'rejected')}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                            No change requests submitted.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: TEAM & ALLOCATION */}
                  {activeTab === 'team' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Project Team & Allocation</h3>
                          <p className="text-xs text-slate-500">
                            Assigned employees and capacity allocation (Integrated with M03 Employee records).
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setMemMembershipId(members[0]?.id?.toString() || '');
                            setMemRole('developer');
                            setMemAllocation(100);
                            setFormError(null);
                            setShowMemberModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Assign Member
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedProject.members && selectedProject.members.length > 0 ? (
                          selectedProject.members.map((m) => (
                            <div
                              key={m.id}
                              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F95716] font-bold text-xs flex items-center justify-center">
                                  {m.membership?.user?.name?.[0] || 'U'}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{m.membership?.user?.name}</p>
                                  <p className="text-[11px] text-slate-500 capitalize">
                                    {m.project_role.replace('_', ' ')} · {m.allocation_percent}% Capacity
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="text-slate-400 hover:text-rose-600 text-xs font-semibold p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No team members allocated to this project workspace.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: RISKS & BLOCKERS */}
                  {activeTab === 'risks' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Risks, Issues & Critical Blockers</h3>
                          <p className="text-xs text-slate-500">
                            Active critical blockers will flag project health as Critical and prevent project closure.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setRiskType('risk');
                            setRiskTitle('');
                            setRiskSeverity('medium');
                            setRiskProb('medium');
                            setRiskMitigation('');
                            setFormError(null);
                            setShowRiskModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Log Risk / Blocker
                        </button>
                      </div>

                      <div className="space-y-3">
                        {selectedProject.risks && selectedProject.risks.length > 0 ? (
                          selectedProject.risks.map((r) => (
                            <div
                              key={r.id}
                              className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between gap-4 ${
                                r.type === 'blocker' && r.status !== 'resolved'
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                      r.type === 'blocker'
                                        ? 'bg-rose-100 text-rose-800'
                                        : r.type === 'issue'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {r.type}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900">{r.title}</span>
                                  <span className="text-[10px] font-bold uppercase text-slate-500">
                                    Severity: {r.severity}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      r.status === 'resolved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </div>
                                {r.mitigation_plan && (
                                  <p className="text-xs text-slate-600">Mitigation: {r.mitigation_plan}</p>
                                )}
                              </div>

                              <div>
                                {r.status !== 'resolved' ? (
                                  <button
                                    onClick={() => handleResolveRisk(r.id)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs"
                                  >
                                    Resolve
                                  </button>
                                ) : (
                                  <span className="text-xs font-semibold text-emerald-600">Resolved</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No risks or blockers recorded.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: DECISIONS & DOCS */}
                  {activeTab === 'decisions' && (
                    <div className="space-y-6">
                      {/* Decisions Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">Project Decisions Register</h3>
                          <button
                            onClick={() => {
                              setDecTitle('');
                              setDecDecision('');
                              setDecRationale('');
                              setFormError(null);
                              setShowDecisionModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-500" />
                            Record Decision
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selectedProject.decisions && selectedProject.decisions.length > 0 ? (
                            selectedProject.decisions.map((d) => (
                              <div key={d.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                                <p className="text-xs font-bold text-slate-900">{d.title}</p>
                                <p className="text-xs text-slate-700 mt-1">{d.decision}</p>
                                {d.rationale && (
                                  <p className="text-[11px] text-slate-400 mt-1">Rationale: {d.rationale}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">No formal decisions logged.</p>
                          )}
                        </div>
                      </div>

                      {/* Documents Section */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">Protected Documents & References</h3>
                          <button
                            onClick={() => {
                              setDocName('');
                              setDocPath('');
                              setDocVis('internal');
                              setFormError(null);
                              setShowDocModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-500" />
                            Attach Document
                          </button>
                        </div>
                        <div className="space-y-2">
                          {selectedProject.documents && selectedProject.documents.length > 0 ? (
                            selectedProject.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{doc.document_name}</p>
                                  <span className="text-[10px] text-slate-400 uppercase">{doc.visibility}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                                  {doc.file_path}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">No documents attached.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: LIFECYCLE GOVERNANCE */}
                  {activeTab === 'lifecycle' && (
                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900">State Machine & Closure Gate Controls</h3>
                        <p className="text-xs text-slate-500">
                          Transitions enforce business rules. Transitioning to <strong>completed</strong> or{' '}
                          <strong>closed</strong> will be automatically rejected by the backend if any active blockers
                          remain unresolved.
                        </p>

                        <form onSubmit={handleTransitionStatus} className="space-y-4 max-w-md">
                          {formError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                              {formError}
                            </div>
                          )}

                          <CustomDropdown
                            label="Target Lifecycle State"
                            value={transStatus}
                            onChange={setTransStatus}
                            options={[
                              { value: 'draft', label: 'Draft', badge: 'Draft', colorDot: '#94a3b8' },
                              { value: 'planning', label: 'Planning', badge: 'Plan', colorDot: '#3b82f6' },
                              { value: 'active', label: 'Active Execution', badge: 'Active', colorDot: '#f59e0b' },
                              { value: 'on_hold', label: 'On Hold', badge: 'Hold', colorDot: '#64748b' },
                              { value: 'completed', label: 'Completed (Enforces Closure Gates)', badge: 'Closed', colorDot: '#10b981' },
                              { value: 'closed', label: 'Closed & Archived (Enforces Closure Gates)', badge: 'Archive', colorDot: '#0f172a' },
                              { value: 'cancelled', label: 'Cancelled', badge: 'Void', colorDot: '#ef4444' },
                            ]}
                            searchable={false}
                            fullWidth
                          />

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Audit Justification / Reason</label>
                            <input
                              type="text"
                              placeholder="e.g. Approved all phase milestones, client sign-off complete"
                              value={transReason}
                              onChange={(e) => setTransReason(e.target.value)}
                              className="w-full text-xs rounded-xl border border-slate-200 bg-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {formLoading ? 'Evaluating Gates...' : 'Commit Lifecycle Transition'}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}



      {/* MODAL: ADD MILESTONE */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Milestone Gate</h3>
            <form onSubmit={handleAddMilestone} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Milestone Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 1 MVP Deployment"
                  value={msName}
                  onChange={(e) => setMsName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Progress Weight (%) *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={msWeight}
                  onChange={(e) => setMsWeight(parseInt(e.target.value) || 0)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Baseline Due Date</label>
                <input
                  type="date"
                  value={msDue}
                  onChange={(e) => setMsDue(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description & Acceptance Criteria</label>
                <textarea
                  rows={2}
                  value={msDesc}
                  onChange={(e) => setMsDesc(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMilestoneModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LINK DEPENDENCY (DAG) */}
      {showDependencyModal && selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Link Milestone Dependency (DAG)</h3>
            <p className="text-xs text-slate-500">
              The server prevents circular loops and ensures valid chronological ordering.
            </p>
            <form onSubmit={handleAddDependency} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <CustomDropdown
                label="Predecessor (Must finish first)"
                required
                placeholder="Select Predecessor"
                value={depPredecessorId}
                onChange={setDepPredecessorId}
                options={(selectedProject.milestones || []).map((m) => ({
                  value: String(m.id),
                  label: m.name,
                  badge: m.status.replace('_', ' '),
                }))}
                searchable={(selectedProject.milestones || []).length > 5}
                fullWidth
              />
              <CustomDropdown
                label="Successor (Depends on predecessor)"
                required
                placeholder="Select Successor"
                value={depSuccessorId}
                onChange={setDepSuccessorId}
                options={(selectedProject.milestones || []).map((m) => ({
                  value: String(m.id),
                  label: m.name,
                  badge: m.status.replace('_', ' '),
                }))}
                searchable={(selectedProject.milestones || []).length > 5}
                fullWidth
              />
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDependencyModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Link Dependency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN MEMBER */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Assign Team Member</h3>
            <form onSubmit={handleAssignMember} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <CustomDropdown
                label="Employee"
                required
                placeholder="Select Employee"
                value={memMembershipId}
                onChange={setMemMembershipId}
                options={members.map((m) => ({
                  value: String(m.id),
                  label: m.user.name,
                  description: m.user.email,
                }))}
                searchable={members.length > 5}
                fullWidth
              />
              <CustomDropdown
                label="Project Role"
                required
                value={memRole}
                onChange={setMemRole}
                options={[
                  { value: 'project_manager', label: 'Project Manager', description: 'Leads project execution & governance' },
                  { value: 'tech_lead', label: 'Technical Lead', description: 'Architecture & engineering delivery' },
                  { value: 'developer', label: 'Developer', description: 'Feature implementation & tests' },
                  { value: 'qa_engineer', label: 'QA Engineer', description: 'Quality assurance & testing' },
                  { value: 'designer', label: 'UI/UX Designer', description: 'User interfaces & design systems' },
                ]}
                searchable={false}
                fullWidth
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Allocation Percentage (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={memAllocation}
                  onChange={(e) => setMemAllocation(parseInt(e.target.value) || 100)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG RISK / BLOCKER */}
      {showRiskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Log Risk / Critical Blocker</h3>
            <form onSubmit={handleAddRisk} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <CustomDropdown
                label="Type"
                required
                value={riskType}
                onChange={(val) => setRiskType(val as any)}
                options={[
                  { value: 'risk', label: 'Unrealized Risk', description: 'Potential issue that may impact project' },
                  { value: 'issue', label: 'Active Issue', description: 'Ongoing issue being addressed' },
                  { value: 'blocker', label: 'Critical Blocker (Gates Closure)', description: 'Prevents milestone completion or closure' },
                ]}
                searchable={false}
                fullWidth
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Third-party payment gateway credentials pending"
                  value={riskTitle}
                  onChange={(e) => setRiskTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CustomDropdown
                  label="Severity"
                  value={riskSeverity}
                  onChange={(val) => setRiskSeverity(val as any)}
                  options={[
                    { value: 'low', label: 'Low', badge: 'Low', colorDot: '#10b981' },
                    { value: 'medium', label: 'Medium', badge: 'Medium', colorDot: '#f59e0b' },
                    { value: 'high', label: 'High', badge: 'High', colorDot: '#f97316' },
                    { value: 'critical', label: 'Critical', badge: 'Critical', colorDot: '#ef4444' },
                  ]}
                  searchable={false}
                  fullWidth
                />
                <CustomDropdown
                  label="Probability"
                  value={riskProb}
                  onChange={(val) => setRiskProb(val as any)}
                  options={[
                    { value: 'low', label: 'Low Probability', badge: 'Low' },
                    { value: 'medium', label: 'Medium Probability', badge: 'Medium' },
                    { value: 'high', label: 'High Probability', badge: 'High' },
                  ]}
                  searchable={false}
                  fullWidth
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Mitigation / Resolution Plan</label>
                <textarea
                  rows={2}
                  value={riskMitigation}
                  onChange={(e) => setRiskMitigation(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRiskModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl shadow-xs"
                >
                  Log Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE REQUEST */}
      {showChangeRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Propose Change Request</h3>
            <form onSubmit={handleAddChangeRequest} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <CustomDropdown
                label="Request Type"
                required
                value={crType}
                onChange={(val) => setCrType(val as any)}
                options={[
                  { value: 'scope', label: 'Scope Revision', description: 'Changes to agreed feature set or deliverables' },
                  { value: 'schedule', label: 'Schedule Extension', description: 'Timeline delay or revised milestones' },
                  { value: 'budget', label: 'Budget Adjustment', description: 'Resource or cost expansion' },
                ]}
                searchable={false}
                fullWidth
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Add biometric auth support"
                  value={crTitle}
                  onChange={(e) => setCrTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Business Justification *</label>
                <textarea
                  required
                  rows={2}
                  value={crReason}
                  onChange={(e) => setCrReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Impact Summary</label>
                <textarea
                  rows={2}
                  placeholder="+2 weeks development, +$5,000 budget"
                  value={crImpact}
                  onChange={(e) => setCrImpact(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangeRequestModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD DECISION */}
      {showDecisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Project Decision</h3>
            <form onSubmit={handleAddDecision} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Decision Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architectural choice of PostgreSQL vs MySQL"
                  value={decTitle}
                  onChange={(e) => setDecTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Decision Outcome *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="The agreed architectural or procedural decision..."
                  value={decDecision}
                  onChange={(e) => setDecDecision(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Why this was selected over alternatives..."
                  value={decRationale}
                  onChange={(e) => setDecRationale(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH DOCUMENT */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Attach Protected Document</h3>
            <form onSubmit={handleAddDocument} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Document Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Service Agreement v1.2"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">File Storage URI / Path *</label>
                <input
                  type="text"
                  required
                  placeholder="docs/projects/msa-signed.pdf"
                  value={docPath}
                  onChange={(e) => setDocPath(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3 font-mono"
                />
              </div>
              <CustomDropdown
                label="Visibility"
                required
                value={docVis}
                onChange={(val) => setDocVis(val as any)}
                options={[
                  { value: 'internal', label: 'Internal Software House Only', description: 'Visible only to team members' },
                  { value: 'client_visible', label: 'Client Portal Visible', description: 'Accessible in client portal' },
                ]}
                searchable={false}
                fullWidth
              />
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-[#F95716] text-white rounded-xl shadow-xs"
                >
                  Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default ProjectManagementPage;

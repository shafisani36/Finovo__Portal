import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Search,
  Calendar,
  CheckCircle2,
  X,
  Loader2,
  Layers,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  RotateCcw,
  ArrowUpDown,
  RefreshCw,
  MoreHorizontal,
  Flag,
  Folder,
  Columns3,
  Activity,
  Trash2,
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
  PortfolioPriorityBadge,
  PortfolioStatusBadge,
} from '../components/portfolio';

interface ProjectOption {
  id: number;
  name: string;
  project_code: string;
}

interface MemberOption {
  id: number;
  user: { id: number; name: string; email: string };
}

interface TaskChecklistItem {
  id: number;
  item_text: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: { user: { name: string } };
}

interface TaskChecklist {
  id: number;
  title: string;
  is_mandatory: boolean;
  items: TaskChecklistItem[];
}

interface TaskDependency {
  id: number;
  prerequisite_task_id: number;
  prerequisite_task?: {
    id: number;
    task_code: string;
    title: string;
    status: string;
  };
}

interface TaskComment {
  id: number;
  content: string;
  visibility: 'internal' | 'client_visible';
  is_pinned: boolean;
  created_at: string;
  author?: {
    user: { id: number; name: string };
  };
}

interface TaskAttachment {
  id: number;
  file_name: string;
  file_path: string;
  is_evidence: boolean;
  visibility: 'internal' | 'client_visible';
  created_at: string;
  uploader?: {
    user: { name: string };
  };
}

interface TaskApproval {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  evidence_notes?: string;
  review_notes?: string;
  submitted_at: string;
  reviewed_at?: string;
  requested_by?: { user: { name: string } };
  reviewed_by?: { user: { name: string } };
}

interface TaskStatusHistory {
  id: number;
  from_status: string;
  to_status: string;
  reason?: string;
  created_at: string;
  changed_by?: { user: { name: string } };
}

interface TaskItem {
  id: number;
  company_id: number;
  project_id: number;
  milestone_id?: number;
  parent_task_id?: number;
  task_code: string;
  title: string;
  description?: string;
  task_type: string;
  status:
    | 'open'
    | 'ready'
    | 'in_progress'
    | 'blocked'
    | 'in_review'
    | 'completed'
    | 'accepted'
    | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  visibility:
    | 'internal'
    | 'confidential'
    | 'highly_restricted'
    | 'client_visible';
  assignee_membership_id?: number;
  start_at?: string;
  due_at?: string;
  completed_at?: string;
  estimated_minutes: number;
  actual_minutes: number;
  progress_percent: number;
  weight: number;
  blocker_reason?: string;
  version: number;
  is_overdue: boolean;
  created_at?: string;
  project?: { id: number; name: string; project_code: string };
  assignee?: { id: number; user: { id: number; name: string; email: string } };
  creator?: { id: number; user: { id: number; name: string } };
  checklists?: TaskChecklist[];
  dependencies?: TaskDependency[];
  subtasks?: TaskItem[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  approvals?: TaskApproval[];
  status_history?: TaskStatusHistory[];
}

interface TaskSummaryMetrics {
  total_tasks: number;
  open: number;
  in_progress: number;
  blocked: number;
  in_review: number;
  completed: number;
  overdue: number;
}

export const TaskManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { confirm: confirmModal, alert: alertModal } = useConfirm();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Directory State - initialized from cache pipeline for 0ms instant render
  const initialCacheKey = `tasks_${companySlug}_default`;
  const cachedTasks = dataPipeline.get<{ tasks: TaskItem[]; total: number }>(
    initialCacheKey,
  );

  const [tasks, setTasks] = useState<TaskItem[]>(
    () => cachedTasks?.tasks || [],
  );
  const [totalCount, setTotalCount] = useState(() => cachedTasks?.total || 0);
  const [loading, setLoading] = useState(!cachedTasks);
  const [isValidating, setIsValidating] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>(
    () => dataPipeline.get(`projects_opt_${companySlug}`) || [],
  );
  const [, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || [],
  );

  // Summary Metrics - initialized from cache
  const [metrics, setMetrics] = useState<TaskSummaryMetrics>(
    () =>
      dataPipeline.get(`task_metrics_${companySlug}`) || {
        total_tasks: 0,
        open: 0,
        in_progress: 0,
        blocked: 0,
        in_review: 0,
        completed: 0,
        overdue: 0,
      },
  );

  // View Mode: 'table' | 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      return (localStorage.getItem('finovo_tasks_view_mode') as any) || 'table';
    } catch {
      return 'table';
    }
  });

  const handleSetViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    try {
      localStorage.setItem('finovo_tasks_view_mode', mode);
    } catch {}
  };

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<
    'all' | 'planning' | 'ongoing' | 'in_review' | 'on_hold' | 'completed'
  >('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [quickFilter] = useState<
    'all' | 'my' | 'blocked' | 'review' | 'overdue'
  >('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Row selection & Column visibility
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    Project: true,
    Description: true,
    Priority: true,
    Status: true,
    Deadline: true,
    Assignee: true,
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  // Selected Task Workspace (Slide-Over Drawer)
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'checklist'
    | 'dependencies'
    | 'discussion'
    | 'evidence'
    | 'approvals'
    | 'history'
  >('overview');
  const [detailLoading, setDetailLoading] = useState(false);

  // Drawer Form States
  const [newChecklistInput, setNewChecklistInput] = useState('');
  const [transStatus, setTransStatus] = useState('in_progress');
  const [transReason, setTransReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentVis] = useState<'internal' | 'client_visible'>('internal');
  const [depPrereqId, setDepPrereqId] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachPath, setAttachPath] = useState('');
  const [attachEvidence, setAttachEvidence] = useState(true);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Global Keyboard Shortcuts (N -> Add Task, / -> Focus Search, Esc -> Close Drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key.toLowerCase() === 'n' && !selectedTask) {
        e.preventDefault();
        navigate(`/app/${companySlug}/tasks/create`);
      }
      if (e.key === '/' && !selectedTask) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (selectedTask) setSelectedTask(null);
        if (showDependencyModal) setShowDependencyModal(false);
        if (showAttachmentModal) setShowAttachmentModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companySlug, selectedTask, showDependencyModal, showAttachmentModal, navigate]);

  // Fetch Directory with High-Speed Pipeline & SWR Caching
  const fetchTasks = useCallback(async (forceFresh = false) => {
    if (!companySlug) return;
    const effectiveStatus =
      statusTab === 'all'
        ? statusFilter
        : statusTab === 'planning'
        ? 'open'
        : statusTab === 'ongoing'
        ? 'in_progress'
        : statusTab === 'in_review'
        ? 'in_review'
        : statusTab === 'on_hold'
        ? 'blocked'
        : statusTab === 'completed'
        ? 'completed'
        : statusFilter;

    const cacheKey = `tasks_${companySlug}_${page}_${debouncedSearch}_${effectiveStatus}_${priorityFilter}_${projectFilter}_${quickFilter}_${sortBy}_${sortDirection}`;
    const cached = dataPipeline.get<{ tasks: TaskItem[]; total: number }>(cacheKey);

    if (cached && !forceFresh) {
      setTasks(cached.tasks);
      setTotalCount(cached.total);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (effectiveStatus) params.append('status', effectiveStatus);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (projectFilter) params.append('project_id', projectFilter);
      if (quickFilter === 'my') params.append('my_tasks', '1');
      if (quickFilter === 'blocked') params.append('blocked', '1');
      if (quickFilter === 'review') params.append('in_review', '1');
      if (quickFilter === 'overdue') params.append('overdue', '1');
      if (sortBy) params.append('sort_by', sortBy);
      if (sortDirection) params.append('sort_dir', sortDirection);

      params.append('page', page.toString());
      params.append('per_page', '15');

      const res = await api.get(
        `/companies/${companySlug}/tasks?${params.toString()}`,
      );
      const taskList = res.data.tasks?.data || res.data.data || [];
      const total = res.data.tasks?.total ?? res.data.total ?? taskList.length;
      setTasks(taskList);
      setTotalCount(total);
      dataPipeline.set(cacheKey, { tasks: taskList, total }, 120000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }, [
    companySlug,
    page,
    debouncedSearch,
    statusTab,
    statusFilter,
    priorityFilter,
    projectFilter,
    quickFilter,
    sortBy,
    sortDirection,
  ]);

  const fetchSummary = useCallback(async () => {
    if (!companySlug) return;
    try {
      const res = await api.get(
        `/companies/${companySlug}/task-reports/summary`,
      );
      if (res.data.summary) {
        setMetrics(res.data.summary);
        dataPipeline.set(`task_metrics_${companySlug}`, res.data.summary, 300000);
      }
    } catch {
      // Handled
    }
  }, [companySlug]);

  const fetchAuxiliary = useCallback(async () => {
    if (!companySlug) return;
    const cachedProj = dataPipeline.get<ProjectOption[]>(
      `projects_opt_${companySlug}`,
    );
    const cachedMem = dataPipeline.get<MemberOption[]>(
      `members_${companySlug}`,
    );
    if (cachedProj) setProjects(cachedProj);
    if (cachedMem) setMembers(cachedMem);

    try {
      const [projRes, memRes] = await Promise.allSettled([
        api.get(`/companies/${companySlug}/projects?per_page=100`),
        api.get(`/companies/${companySlug}/members?per_page=100&status=active`),
      ]);

      if (projRes.status === 'fulfilled' && projRes.value.data) {
        const pList =
          projRes.value.data.projects?.data || projRes.value.data.data || [];
        setProjects(pList);
        dataPipeline.set(`projects_opt_${companySlug}`, pList, 300000);
      }
      if (memRes.status === 'fulfilled' && memRes.value.data) {
        const mList = memRes.value.data.data || [];
        setMembers(mList);
        dataPipeline.set(`members_${companySlug}`, mList, 300000);
      }
    } catch {
      // Handled
    }
  }, [companySlug]);

  const fetchTaskDetails = async (taskId: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/companies/${companySlug}/tasks/${taskId}`);
      setSelectedTask(res.data.task);
      setTransStatus(res.data.task.status);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (companySlug) {
      fetchTasks();
      fetchSummary();
      fetchAuxiliary();
    }
  }, [companySlug, fetchTasks, fetchSummary, fetchAuxiliary]);

  // Export CSV Handler
  const handleExportCsv = async () => {
    try {
      const res = await api.get(`/companies/${companySlug}/tasks/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `finovo-tasks-${companySlug}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      if (tasks.length === 0) {
        await alertModal({
          title: 'Export Notice',
          message: 'No tasks to export in this workspace.',
          variant: 'info',
        });
        return;
      }
      const headers = ['Code', 'Title', 'Project', 'Priority', 'Status', 'Deadline', 'Assignee'];
      const rows = tasks.map((t) => [
        t.task_code || `TSK-${t.id}`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.project?.name || '').replace(/"/g, '""')}"`,
        t.priority || 'medium',
        t.status || 'open',
        t.due_at || '',
        `"${(t.assignee?.user?.name || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `finovo-tasks-${companySlug || 'export'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Row selection handlers
  const handleToggleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length && tasks.length > 0) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id));
    }
  };

  const handleToggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusTab('all');
    setStatusFilter('');
    setPriorityFilter('');
    setProjectFilter('');
    setPage(1);
  };

  // Delete Task Handler
  const handleDeleteTask = async (taskId: number) => {
    const ok = await confirmModal({
      title: 'Delete Task',
      message: 'Are you sure you want to permanently delete this task? This action cannot be undone.',
      confirmText: 'Delete Task',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/companies/${companySlug}/tasks/${taskId}`);
      if (selectedTask?.id === taskId) setSelectedTask(null);
      fetchTasks(true);
      fetchSummary();
      await alertModal({
        title: 'Task Deleted',
        message: 'The task has been permanently removed.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Deletion Failed',
        message: err.response?.data?.message || 'Failed to delete task',
        variant: 'danger',
      });
    }
  };

  // Toggle Checklist Item
  const handleToggleChecklist = async (itemId: number) => {
    if (!selectedTask) return;
    try {
      await api.patch(
        `/companies/${companySlug}/tasks/${selectedTask.id}/checklist-items/${itemId}/toggle`,
      );
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      await alertModal({
        title: 'Checklist Error',
        message:
          err.response?.data?.message || 'Failed to toggle checklist item',
        variant: 'danger',
      });
    }
  };

  // Add Checklist Item
  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newChecklistInput.trim()) return;
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/checklists`,
        {
          item_text: newChecklistInput.trim(),
        },
      );
      setNewChecklistInput('');
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      await alertModal({
        title: 'Checklist Error',
        message: err.response?.data?.message || 'Failed to add checklist item',
        variant: 'danger',
      });
    }
  };

  // Transition Task Status (Enforces Completion Gates)
  const handleTransitionStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/transitions`,
        {
          target_status: transStatus,
          reason: transReason || undefined,
        },
      );
      await fetchTaskDetails(selectedTask.id);
      fetchTasks(true);
      fetchSummary();
      setTransReason('');
      await alertModal({
        title: 'Status Transitioned',
        message: `Task status transitioned to "${transStatus}".`,
        variant: 'success',
      });
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || 'Failed to change task status',
      );
    } finally {
      setFormLoading(false);
    }
  };

  // Submit for Review
  const handleSubmitReview = async () => {
    if (!selectedTask) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/submit-review`,
        {
          evidence_notes:
            reviewNotes || 'All mandatory acceptance criteria completed',
        },
      );
      await fetchTaskDetails(selectedTask.id);
      fetchTasks(true);
      fetchSummary();
      setReviewNotes('');
      await alertModal({
        title: 'Review Submitted',
        message: 'Task successfully submitted for review.',
        variant: 'success',
      });
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setFormLoading(false);
    }
  };

  // Reviewer Approve
  const handleApproveReview = async () => {
    if (!selectedTask) return;
    const ok = await confirmModal({
      title: 'Approve Task Deliverable',
      message: 'Approve task deliverable and mark as completed?',
      confirmText: 'Approve & Complete',
      variant: 'success',
    });
    if (!ok) return;
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/approve`,
        {
          review_notes:
            reviewNotes || 'Verified deliverables against acceptance gates',
        },
      );
      await fetchTaskDetails(selectedTask.id);
      fetchTasks(true);
      fetchSummary();
      setReviewNotes('');
      await alertModal({
        title: 'Task Approved',
        message: 'Task approved and completed successfully.',
        variant: 'success',
      });
    } catch (err: any) {
      await alertModal({
        title: 'Approval Error',
        message: err.response?.data?.message || 'Failed to approve task',
        variant: 'danger',
      });
    }
  };

  // Reviewer Reject
  const handleRejectReview = async () => {
    if (!selectedTask) return;
    const reason = prompt('Please enter rejection feedback for the assignee:');
    if (!reason) return;
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/reject`,
        {
          reason,
        },
      );
      await fetchTaskDetails(selectedTask.id);
      fetchTasks(true);
      fetchSummary();
    } catch (err: any) {
      await alertModal({
        title: 'Review Error',
        message: err.response?.data?.message || 'Failed to reject review',
        variant: 'danger',
      });
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;
    setFormLoading(true);
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/comments`,
        {
          content: newCommentText,
          visibility: newCommentVis,
        },
      );
      setNewCommentText('');
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      await alertModal({
        title: 'Comment Error',
        message: err.response?.data?.message || 'Failed to add comment',
        variant: 'danger',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Add Prerequisite Dependency (DAG Cycle Prevention)
  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !depPrereqId) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/dependencies`,
        {
          prerequisite_task_id: parseInt(depPrereqId),
        },
      );
      setShowDependencyModal(false);
      setDepPrereqId('');
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          'Failed to link dependency (possible cycle)',
      );
    } finally {
      setFormLoading(false);
    }
  };

  // Add Attachment / Evidence
  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !attachName || !attachPath) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post(
        `/companies/${companySlug}/tasks/${selectedTask.id}/attachments`,
        {
          file_name: attachName,
          file_path: attachPath,
          is_evidence: attachEvidence,
          visibility: 'internal',
        },
      );
      setShowAttachmentModal(false);
      setAttachName('');
      setAttachPath('');
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to attach file');
    } finally {
      setFormLoading(false);
    }
  };

  // Formatting helpers
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

  const getTaskAvatarColor = (name: string, index: number) => {
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

  // Telemetry metric calculations
  const totalT = metrics.total_tasks || totalCount || tasks.length || 0;
  const planningCount = metrics.open || 0;
  const inProgressCount = metrics.in_progress || 0;
  const inReviewCount = metrics.in_review || 0;
  const blockedCount = metrics.blocked || 0;
  const completedCount = metrics.completed || 0;

  // Priority mix calculation
  const priorityStats = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    tasks.forEach((t) => {
      const p = (t.priority || '').toLowerCase();
      if (p === 'urgent' || p === 'high') high++;
      else if (p === 'low') low++;
      else medium++;
    });
    return { high, medium, low };
  }, [tasks]);

  return (
    <AppShell>
      <div className="space-y-5 font-['Inter',sans-serif] flex-1 flex flex-col">
        {/* =========================================================================
            TOP PORTFOLIO HEADER (IDENTICAL UI TO PROJECTS)
           ========================================================================= */}
        <PortfolioPageHeader
          category="PORTFOLIO"
          title="Tasks"
          subtitle="Track every task across projects — status, priority, deadlines and ownership."
          onExport={handleExportCsv}
          onAdd={() => navigate(`/app/${companySlug}/tasks/create`)}
          addLabel="Add task"
          addShortcut="N"
        />

        {/* =========================================================================
            TOP HERO ANALYTICS / STATS PANEL (EXACT 2-COLUMN SPLIT)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<CheckSquare className="w-4 h-4 fill-blue-500/20" />}
          totalCount={totalT}
          totalLabel="Total tasks"
          scopeLabel="across all projects"
          distribution={[
            {
              key: 'planning',
              label: 'Planning',
              count: planningCount,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'ongoing',
              label: 'Ongoing',
              count: inProgressCount,
              colorClass: 'bg-[#F95716]',
              showPercent: true,
            },
            {
              key: 'in_review',
              label: 'In Review',
              count: inReviewCount,
              colorClass: 'bg-purple-500',
              dotClass: 'bg-purple-500 rounded-xs',
              showPercent: false,
            },
            {
              key: 'on_hold',
              label: 'On hold',
              count: blockedCount,
              colorClass: 'bg-slate-300',
              dotClass: 'bg-slate-300 rounded-full',
              showPercent: false,
            },
            {
              key: 'completed',
              label: 'Completed',
              count: completedCount,
              colorClass: 'bg-emerald-500',
              dotClass: 'bg-emerald-500 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: priorityStats.high,
            medium: priorityStats.medium,
            low: priorityStats.low,
            total: totalT,
          }}
        />

        {/* =========================================================================
            TABS & VIEW SWITCHER ROW (IDENTICAL UX & DESIGN)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'all', label: 'All', count: totalT },
            {
              id: 'planning',
              label: 'Planning',
              count: planningCount,
              dotColor: 'bg-blue-500',
            },
            {
              id: 'ongoing',
              label: 'Ongoing',
              count: inProgressCount,
              dotColor: 'bg-[#F95716]',
            },
            {
              id: 'in_review',
              label: 'In Review',
              count: inReviewCount,
              dotColor: 'bg-purple-500',
            },
            {
              id: 'on_hold',
              label: 'On hold',
              count: blockedCount,
              dotColor: 'bg-slate-400',
            },
            {
              id: 'completed',
              label: 'Completed',
              count: completedCount,
              dotColor: 'bg-emerald-500',
            },
          ]}
          activeTab={statusTab}
          onTabChange={(tabId) => {
            setStatusTab(tabId as any);
            setPage(1);
          }}
          viewMode={viewMode}
          onViewModeChange={handleSetViewMode}
        />

        {/* =========================================================================
            SEARCH AND CONTROLS TOOLBAR (EXACT MATCH WITH CUSTOM DROPDOWNS)
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search with '/' keyboard badge */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search task title, code, project, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
            />
            {search ? (
              <button
                type="button"
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
                { value: 'urgent', label: 'Urgent', badge: 'Urgent', colorDot: '#be123c' },
              ]}
              searchable={false}
              className="min-w-[145px]"
            />

            {/* Project Filter */}
            <CustomDropdown
              value={projectFilter}
              onChange={(val) => {
                setProjectFilter(val);
                setPage(1);
              }}
              placeholder="All projects"
              size="sm"
              variant="filter"
              leadingIcon={<Folder className="w-3.5 h-3.5 text-slate-400" />}
              options={[
                { value: '', label: 'All projects' },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
              searchable={projects.length > 5}
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
                { value: 'title', label: 'Sort: Title A-Z' },
                { value: 'priority', label: 'Sort: Priority' },
                { value: 'due_at', label: 'Sort: Deadline' },
                { value: 'status', label: 'Sort: Status' },
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
                { id: 'Project', label: 'Project', checked: visibleColumns.Project },
                { id: 'Description', label: 'Description', checked: visibleColumns.Description },
                { id: 'Priority', label: 'Priority', checked: visibleColumns.Priority },
                { id: 'Status', label: 'Status', checked: visibleColumns.Status },
                { id: 'Deadline', label: 'Deadline', checked: visibleColumns.Deadline },
                { id: 'Assignee', label: 'Assignee', checked: visibleColumns.Assignee },
              ]}
              onToggle={toggleColumn}
              onSelectAll={() =>
                setVisibleColumns({
                  Project: true,
                  Description: true,
                  Priority: true,
                  Status: true,
                  Deadline: true,
                  Assignee: true,
                })
              }
              onDeselectAll={() =>
                setVisibleColumns({
                  Project: false,
                  Description: false,
                  Priority: false,
                  Status: false,
                  Deadline: false,
                  Assignee: false,
                })
              }
              size="sm"
            />

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchTasks(true)}
              disabled={isValidating}
              className="p-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-[#F95716]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Subtle Background Revalidation Indicator */}
        {isValidating && tasks.length > 0 && (
          <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-[#F95716] animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {/* =========================================================================
            DATA VIEW: 1:1 ENTERPRISE TABLE OR GRID VIEW
           ========================================================================= */}
        {viewMode === 'grid' ? (
          /* GRID VIEW */
          tasks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {search || priorityFilter || projectFilter || statusTab !== 'all'
                  ? 'No Tasks Match Active Filters'
                  : 'No Tasks in this Workspace'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search || priorityFilter || projectFilter || statusTab !== 'all'
                  ? 'Try adjusting your search criteria, priority filter, or status tab to view more deliverables.'
                  : 'Get started by creating your first task deliverable with gated acceptance criteria.'}
              </p>
              {search || priorityFilter || projectFilter || statusTab !== 'all' ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/app/${companySlug}/tasks/create`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer mt-2"
                >
                  Add task
                  <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">N</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tasks.map((task, idx) => (
                <div
                  key={task.id}
                  onClick={() => fetchTaskDetails(task.id)}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-orange-500/30 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${getTaskAvatarColor(
                            task.title,
                            idx,
                          )} shadow-2xs`}
                        >
                          {(task.title || 'T')[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                            {task.task_code || `TSK-${String(task.id).padStart(4, '0')}`}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 truncate max-w-[150px] block">
                            {task.project?.name || 'Workspace General'}
                          </span>
                        </div>
                      </div>

                      <PortfolioStatusBadge status={task.status} />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#F95716] transition-colors line-clamp-1">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {task.description || 'No deliverable description provided.'}
                      </p>
                    </div>

                    {/* Progress bar if checklists exist */}
                    {task.checklists && task.checklists.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {(() => {
                          const totalItems = task.checklists.reduce(
                            (acc, c) => acc + (c.items?.length || 0),
                            0,
                          );
                          const completedItems = task.checklists.reduce(
                            (acc, c) =>
                              acc +
                              (c.items?.filter((i) => i.is_completed)?.length || 0),
                            0,
                          );
                          const pct =
                            totalItems > 0
                              ? Math.round((completedItems / totalItems) * 100)
                              : 0;
                          return (
                            <>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                <span>Checklist Gates</span>
                                <span className="font-mono font-semibold text-slate-700">
                                  {completedItems}/{totalItems} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-[#F95716] h-full rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                        {task.assignee?.user ? (task.assignee.user.name || 'U')[0].toUpperCase() : 'U'}
                      </div>
                      <span className="text-slate-700 text-[11px] font-medium truncate max-w-[90px]">
                        {task.assignee?.user?.name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <PortfolioPriorityBadge priority={task.priority} />
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatDeadline(task.due_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* =========================================================================
             VIEW: 1:1 HIGH-DENSITY ENTERPRISE TABLE VIEW
             ========================================================================= */
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer"
                        title="Select all tasks"
                      />
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-700 transition-colors"
                      onClick={() => {
                        setSortBy('title');
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>TASK</span>
                        <span className="text-[11px]">↑</span>
                      </div>
                    </th>
                    {visibleColumns.Project && <th className="py-3 px-4">PROJECT</th>}
                    {visibleColumns.Description && <th className="py-3 px-4">DESCRIPTION</th>}
                    {visibleColumns.Priority && <th className="py-3 px-4">PRIORITY</th>}
                    {visibleColumns.Status && <th className="py-3 px-4">STATUS</th>}
                    {visibleColumns.Deadline && <th className="py-3 px-4">DEADLINE</th>}
                    {visibleColumns.Assignee && <th className="py-3 px-4">ASSIGNEE</th>}
                    <th className="py-3 px-4 w-10 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90 text-xs">
                  {loading && tasks.length === 0 ? (
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
                  ) : tasks.length === 0 ? (
                    /* EMPTY STATE (PRESERVES TABLE HEADERS AND GEOMETRY) */
                    <tr>
                      <td colSpan={9} className="py-16 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center mx-auto border border-orange-100 shadow-xs">
                            <CheckSquare className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {search || priorityFilter || projectFilter || statusTab !== 'all'
                              ? 'No tasks match your active filters'
                              : 'No tasks in this workspace yet'}
                          </h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {search || priorityFilter || projectFilter || statusTab !== 'all'
                              ? 'Try adjusting your search query, status tab, or priority filter to find what you are looking for.'
                              : 'Create your first deliverable task to track acceptance gates, subtasks, DAG cycles, and review governance.'}
                          </p>
                          {search || priorityFilter || projectFilter || statusTab !== 'all' ? (
                            <button
                              type="button"
                              onClick={handleClearFilters}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                            >
                              Clear filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/app/${companySlug}/tasks/create`)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer mt-2"
                            >
                              Add task
                              <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">N</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* POPULATED FIGMA ROWS */
                    tasks.map((task, idx) => {
                      const isSelected = selectedTaskIds.includes(task.id);
                      return (
                        <tr
                          key={task.id}
                          onClick={() => fetchTaskDetails(task.id)}
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectOne(task.id, e as any)}
                              className="rounded text-[#F95716] focus:ring-[#F95716] border-slate-300 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* 2. Task Title + Avatar + Code */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${getTaskAvatarColor(
                                  task.title,
                                  idx,
                                )} shadow-2xs`}
                              >
                                {(task.title || 'T')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 group-hover:text-[#F95716] transition-colors truncate text-xs">
                                  {task.title}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                                  {task.task_code || `TSK-${String(task.id).padStart(4, '0')}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Project */}
                          {visibleColumns.Project && (
                            <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                              {task.project?.name || '—'}
                            </td>
                          )}

                          {/* 4. Description */}
                          {visibleColumns.Description && (
                            <td className="py-3 px-4">
                              <span
                                className="text-xs text-slate-500 max-w-[240px] truncate block"
                                title={task.description}
                              >
                                {task.description || 'No deliverable description provided'}
                              </span>
                            </td>
                          )}

                          {/* 5. Priority */}
                          {visibleColumns.Priority && (
                            <td className="py-3 px-4">
                              <PortfolioPriorityBadge priority={task.priority} />
                            </td>
                          )}

                          {/* 6. Status */}
                          {visibleColumns.Status && (
                            <td className="py-3 px-4">
                              <PortfolioStatusBadge status={task.status} />
                            </td>
                          )}

                          {/* 7. Deadline */}
                          {visibleColumns.Deadline && (
                            <td className="py-3 px-4">
                              {task.due_at ? (
                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{formatDeadline(task.due_at)}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          )}

                          {/* 8. Assignee */}
                          {visibleColumns.Assignee && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {task.assignee?.user ? (task.assignee.user.name || 'U')[0].toUpperCase() : 'U'}
                                </div>
                                <span className="text-xs text-slate-700 font-medium truncate max-w-[130px]">
                                  {task.assignee?.user?.name || 'Unassigned'}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* 9. Action Menu Dropdown */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <CustomActionDropdown
                              align="right"
                              title="Task Options"
                              trigger={
                                <button
                                  type="button"
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Task options"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              }
                              items={[
                                {
                                  id: 'details',
                                  label: 'View Deliverable Details',
                                  icon: <CheckSquare className="w-3.5 h-3.5 text-[#F95716]" />,
                                  onClick: () => fetchTaskDetails(task.id),
                                },
                                {
                                  id: 'transition',
                                  label: 'State Machine & Gates',
                                  icon: <Activity className="w-3.5 h-3.5 text-amber-500" />,
                                  onClick: () => {
                                    fetchTaskDetails(task.id);
                                    setActiveTab('overview');
                                  },
                                },
                                {
                                  id: 'checklists',
                                  label: 'Acceptance Checklist',
                                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />,
                                  onClick: () => {
                                    fetchTaskDetails(task.id);
                                    setActiveTab('checklist');
                                  },
                                },
                                {
                                  id: 'dependencies',
                                  label: 'Subtasks & DAG',
                                  icon: <Layers className="w-3.5 h-3.5 text-indigo-500" />,
                                  onClick: () => {
                                    fetchTaskDetails(task.id);
                                    setActiveTab('dependencies');
                                  },
                                },
                                {
                                  id: 'discussion',
                                  label: 'Discussion & Notes',
                                  icon: <MessageSquare className="w-3.5 h-3.5 text-purple-500" />,
                                  onClick: () => {
                                    fetchTaskDetails(task.id);
                                    setActiveTab('discussion');
                                  },
                                },
                                {
                                  id: 'delete',
                                  label: 'Delete Task',
                                  icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
                                  onClick: () => handleDeleteTask(task.id),
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
              totalCount={totalCount || tasks.length}
              currentCount={tasks.length}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}

        {/* =========================================================================
            BOTTOM GLOBAL STATUS & NAVIGATION FOOTER
           ========================================================================= */}
        <PortfolioFooter
          companySlug={companySlug}
          activeLink="tasks"
        />
      </div>

      {/* =========================================================================
          SLIDE-OVER TASK WORKSPACE DRAWER (IDENTICAL SPEC TO PROJECTS)
         ========================================================================= */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-xs">
                    {selectedTask.task_code}
                  </span>
                  <PortfolioStatusBadge status={selectedTask.status} />
                  <span className="text-xs text-slate-400 font-medium">
                    v{selectedTask.version}.0
                  </span>
                  {selectedTask.is_overdue && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase">
                      Overdue
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedTask.title}
                </h2>
                <p className="text-xs text-slate-500">
                  Project:{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedTask.project?.name || 'Workspace General'}
                  </span>{' '}
                  · Assignee:{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedTask.assignee?.user?.name || 'Unassigned'}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto gap-4 custom-scrollbar">
              {[
                {
                  id: 'overview',
                  label: 'Workflow & Overview',
                  icon: CheckSquare,
                },
                {
                  id: 'checklist',
                  label: 'Acceptance Checklist',
                  icon: CheckCircle2,
                },
                { id: 'dependencies', label: 'Subtasks & DAG', icon: Layers },
                {
                  id: 'discussion',
                  label: 'Discussion & Notes',
                  icon: MessageSquare,
                },
                { id: 'evidence', label: 'Files & Evidence', icon: Paperclip },
                {
                  id: 'approvals',
                  label: 'Review & Approvals',
                  icon: ShieldCheck,
                },
                { id: 'history', label: 'Audit Trail', icon: RotateCcw },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
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

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#F95716] mb-2" />
                  Loading task telemetry...
                </div>
              ) : (
                <>
                  {/* TAB: OVERVIEW & STATE MACHINE */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* State Machine Transition Card */}
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900">
                          Task State Machine & Gates
                        </h3>
                        <p className="text-xs text-slate-500">
                          Transitions enforce completion gates: completing or
                          accepting tasks requires all mandatory checklist items
                          and prerequisite dependencies to be satisfied.
                        </p>

                        <form
                          onSubmit={handleTransitionStatus}
                          className="space-y-3 max-w-md"
                        >
                          {formError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                              {formError}
                            </div>
                          )}

                          <div>
                            <CustomDropdown
                              label="Target Status"
                              required
                              value={transStatus}
                              onChange={setTransStatus}
                              options={[
                                { value: 'open', label: 'Open', description: 'Backlog / not started', colorDot: '#64748b' },
                                { value: 'ready', label: 'Ready for Dev', description: 'Specs defined & ready', colorDot: '#3b82f6' },
                                { value: 'in_progress', label: 'In Progress', description: 'Active engineering delivery', colorDot: '#f59e0b' },
                                { value: 'blocked', label: 'Blocked', description: 'Requires blocker justification', colorDot: '#ef4444' },
                                { value: 'in_review', label: 'In Review', description: 'Evidence under review', colorDot: '#8b5cf6' },
                                { value: 'completed', label: 'Completed', description: 'Gated / verification complete', colorDot: '#10b981' },
                                { value: 'accepted', label: 'Accepted', description: 'Client / stakeholder approved', colorDot: '#059669' },
                                { value: 'cancelled', label: 'Cancelled', description: 'Work discontinued', colorDot: '#94a3b8' },
                              ]}
                              searchable={false}
                              fullWidth
                              size="sm"
                            />
                          </div>

                          {transStatus === 'blocked' && (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700">
                                Blocker Reason *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Explain dependency or blocking reason..."
                                value={transReason}
                                onChange={(e) => setTransReason(e.target.value)}
                                className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                              />
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-2 text-xs font-bold bg-[#F95716] hover:bg-[#e0480c] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            Execute Transition
                          </button>
                        </form>
                      </div>

                      {/* Deliverable Metadata Card */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 bg-white">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Priority
                          </span>
                          <div className="mt-1">
                            <PortfolioPriorityBadge priority={selectedTask.priority} />
                          </div>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 bg-white">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Estimated
                          </span>
                          <span className="text-xs font-bold text-slate-900 mt-1 block">
                            {Math.round((selectedTask.estimated_minutes || 0) / 60)} hrs
                          </span>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 bg-white">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Logged Time
                          </span>
                          <span className="text-xs font-bold text-slate-900 mt-1 block">
                            {Math.round((selectedTask.actual_minutes || 0) / 60)} hrs
                          </span>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 bg-white">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Deadline
                          </span>
                          <span className="text-xs font-bold text-slate-900 mt-1 block">
                            {formatDeadline(selectedTask.due_at)}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="p-5 rounded-2xl border border-slate-200/80 bg-white space-y-2">
                        <h4 className="text-xs font-bold text-slate-700">
                          Deliverable Scope & Description
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {selectedTask.description ||
                            'No comprehensive specification or acceptance notes defined for this deliverable.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB: ACCEPTANCE CHECKLIST */}
                  {activeTab === 'checklist' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Acceptance Criteria & Quality Gates
                          </h3>
                          <p className="text-xs text-slate-500">
                            Mandatory acceptance items must be completed before
                            this task can be marked as complete.
                          </p>
                        </div>
                      </div>

                      {/* Checklists List */}
                      <div className="space-y-4">
                        {(!selectedTask.checklists ||
                          selectedTask.checklists.length === 0) && (
                          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                            No acceptance checklists defined for this task.
                          </div>
                        )}

                        {selectedTask.checklists?.map((cl) => (
                          <div
                            key={cl.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {cl.title}
                              </span>
                              {cl.is_mandatory && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  Mandatory Gate
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 divide-y divide-slate-100">
                              {cl.items?.map((item) => (
                                <div
                                  key={item.id}
                                  className="pt-2 flex items-start gap-2.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.is_completed}
                                    onChange={() =>
                                      handleToggleChecklist(item.id)
                                    }
                                    className="rounded text-[#F95716] focus:ring-[#F95716] mt-0.5 cursor-pointer"
                                  />
                                  <div className="flex-1 text-xs">
                                    <span
                                      className={
                                        item.is_completed
                                          ? 'line-through text-slate-400'
                                          : 'text-slate-700'
                                      }
                                    >
                                      {item.item_text}
                                    </span>
                                    {item.is_completed && item.completed_at && (
                                      <span className="block text-[10px] text-slate-400">
                                        Completed by{' '}
                                        {item.completed_by?.user?.name ||
                                          'Team Member'}{' '}
                                        on{' '}
                                        {new Date(
                                          item.completed_at,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Item to Checklist */}
                      <form
                        onSubmit={handleAddChecklistItem}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Add new acceptance criterion item..."
                          value={newChecklistInput}
                          onChange={(e) => setNewChecklistInput(e.target.value)}
                          className="flex-1 text-xs rounded-xl border border-slate-200 py-2 px-3"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Add Item
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB: DEPENDENCIES & DAG */}
                  {activeTab === 'dependencies' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Prerequisite Dependencies (DAG Gates)
                          </h3>
                          <p className="text-xs text-slate-500">
                            Prerequisites must be completed before this task can
                            start. Cycle validation is strictly enforced.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDependencyModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Link Dependency
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(!selectedTask.dependencies ||
                          selectedTask.dependencies.length === 0) && (
                          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                            No prerequisite dependencies linked to this task.
                          </div>
                        )}

                        {selectedTask.dependencies?.map((dep) => (
                          <div
                            key={dep.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                {dep.prerequisite_task?.task_code}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {dep.prerequisite_task?.title}
                                </p>
                                <span className="text-[10px] text-slate-400">
                                  Status: {dep.prerequisite_task?.status}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                dep.prerequisite_task?.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {dep.prerequisite_task?.status === 'completed'
                                ? 'Resolved'
                                : 'Blocking'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: DISCUSSION & NOTES */}
                  {activeTab === 'discussion' && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-slate-900">
                        Discussion & Collaborative Notes
                      </h3>

                      <div className="space-y-3">
                        {(!selectedTask.comments ||
                          selectedTask.comments.length === 0) && (
                          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                            No notes or comments logged yet.
                          </div>
                        )}

                        {selectedTask.comments?.map((c) => (
                          <div
                            key={c.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">
                                {c.author?.user?.name || 'Team Member'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(c.created_at).toLocaleString()}
                                </span>
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    c.visibility === 'client_visible'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {c.visibility}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                              {c.content}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment Form */}
                      <form onSubmit={handleAddComment} className="space-y-2">
                        <textarea
                          required
                          rows={3}
                          placeholder="Type an internal note or client update..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-200 p-3"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            type="submit"
                            disabled={formLoading}
                            className="px-4 py-2 text-xs font-bold bg-[#F95716] hover:bg-[#e0480c] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            Post Note
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* TAB: FILES & EVIDENCE */}
                  {activeTab === 'evidence' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Deliverable Evidence & Attachments
                          </h3>
                          <p className="text-xs text-slate-500">
                            Attach QA logs, screenshots, and evidence files.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAttachmentModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Attach File
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(!selectedTask.attachments ||
                          selectedTask.attachments.length === 0) && (
                          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                            No files or deliverable evidence attached.
                          </div>
                        )}

                        {selectedTask.attachments?.map((att) => (
                          <div
                            key={att.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <Paperclip className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {att.file_name}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {att.file_path}
                                </span>
                              </div>
                            </div>

                            {att.is_evidence && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Verified Evidence
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: REVIEW & APPROVALS */}
                  {activeTab === 'approvals' && (
                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900">
                          Submit for Review & Approval
                        </h3>
                        <p className="text-xs text-slate-500">
                          Assignees submit completed tasks for verification.
                          Reviewers verify criteria before approving.
                        </p>

                        <div className="space-y-3 max-w-md">
                          <textarea
                            rows={3}
                            placeholder="Enter review submission notes or evidence summary..."
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-white"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleSubmitReview}
                              disabled={formLoading}
                              className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              Submit for Review
                            </button>
                            <button
                              type="button"
                              onClick={handleApproveReview}
                              disabled={formLoading}
                              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              Approve & Complete
                            </button>
                            <button
                              type="button"
                              onClick={handleRejectReview}
                              disabled={formLoading}
                              className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              Reject Deliverable
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Approval History */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700">
                          Approval Ledger
                        </h4>
                        {selectedTask.approvals?.map((app) => (
                          <div
                            key={app.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`font-bold uppercase ${
                                  app.status === 'approved'
                                    ? 'text-emerald-700'
                                    : app.status === 'rejected'
                                    ? 'text-rose-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {app.status}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(app.submitted_at).toLocaleString()}
                              </span>
                            </div>
                            {app.evidence_notes && (
                              <p className="text-xs text-slate-600">
                                Submission: {app.evidence_notes}
                              </p>
                            )}
                            {app.review_notes && (
                              <p className="text-xs text-slate-600">
                                Review Feedback: {app.review_notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: AUDIT TRAIL */}
                  {activeTab === 'history' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900">
                        Immutable State Transition History
                      </h3>
                      <div className="space-y-2">
                        {selectedTask.status_history?.map((h) => (
                          <div
                            key={h.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-700">
                                {h.from_status} → {h.to_status}
                              </span>
                              {h.reason && (
                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                  Reason: {h.reason}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {new Date(h.created_at).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-600">
                                {h.changed_by?.user?.name || 'System'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LINK DEPENDENCY */}
      {showDependencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Link Prerequisite Task
            </h3>
            <p className="text-xs text-slate-500">
              Select a task that must be completed before this deliverable can
              start.
            </p>
            <form onSubmit={handleAddDependency} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <div>
                <CustomDropdown
                  label="Prerequisite Task"
                  required
                  placeholder="Select prerequisite task..."
                  value={depPrereqId}
                  onChange={setDepPrereqId}
                  options={tasks
                    .filter((t) => t.id !== selectedTask?.id)
                    .map((t) => ({
                      value: String(t.id),
                      label: `${t.task_code} - ${t.title}`,
                      description: `Status: ${t.status.toUpperCase()} • Priority: ${t.priority.toUpperCase()}`,
                      badge: t.task_code,
                    }))}
                  searchable={tasks.length > 5}
                  searchPlaceholder="Search task code or title..."
                  fullWidth
                  size="sm"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDependencyModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Link Dependency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH EVIDENCE */}
      {showAttachmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Attach Deliverable Evidence
            </h3>
            <form onSubmit={handleAddAttachment} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  File Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QA-Test-Run-Report.pdf"
                  value={attachName}
                  onChange={(e) => setAttachName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Storage URI / Path *
                </label>
                <input
                  type="text"
                  required
                  placeholder="storage/evidence/run-102.pdf"
                  value={attachPath}
                  onChange={(e) => setAttachPath(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkEvidence"
                  checked={attachEvidence}
                  onChange={(e) => setAttachEvidence(e.target.checked)}
                  className="rounded text-[#F95716]"
                />
                <label
                  htmlFor="chkEvidence"
                  className="text-xs text-slate-700 font-semibold cursor-pointer"
                >
                  Mark as Required Deliverable Evidence
                </label>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachmentModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Attach File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default TaskManagementPage;

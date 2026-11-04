import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FolderPlus,
  FileText,
  AlignLeft,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  Search,
  ChevronsUp,
  Equal,
  ChevronsDown,
  Lock,
  Users,
  Building2,
  Sparkles,
  Check,
  RotateCw,
  PauseCircle,
  ChevronDown,
  ArrowLeft,
  Loader2,
  Eye,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { dataPipeline } from '../lib/dataPipeline';
import { useConfirm } from '../context/ConfirmationModalContext';
import { CustomDatePicker } from '../components/ui/CustomCalendar';

interface ProjectOption {
  id: number;
  name: string;
  project_code: string;
}

interface MemberOption {
  id: number;
  user: { id: number; name: string; email: string };
  role?: string;
  designation?: string;
}

interface TaskCreatePageProps {
  initialMode?: 'project' | 'task';
}

export const TaskCreatePage: React.FC<TaskCreatePageProps> = ({ initialMode }) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { alert: alertModal } = useConfirm();

  // Mode: project or task
  const [mode, setMode] = useState<'project' | 'task'>(() => {
    if (initialMode) return initialMode;
    if (location.pathname.includes('/projects')) return 'project';
    return 'task';
  });

  // Auxiliary data
  const [projects, setProjects] = useState<ProjectOption[]>(
    () => dataPipeline.get(`projects_opt_${companySlug}`) || []
  );
  const [members, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || []
  );
  const [loadingAux, setLoadingAux] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states matching Figma Image 1 & 2
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(
    'A vibrant and engaging platform designed to showcase our latest offerings...'
  );
  const [category, setCategory] = useState<'new' | 'ongoing' | 'hold'>('new');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [visibility, setVisibility] = useState<'private' | 'members' | 'company'>('members');
  const [projectId, setProjectId] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [dueDate, setDueDate] = useState('2026-10-06');
  const [budget, setBudget] = useState('0.00');
  const [currency, setCurrency] = useState('USD ($)');
  const [estimatedHours, setEstimatedHours] = useState('4');

  // Assignees selection
  const [searchMember, setSearchMember] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([1]);

  // Fallback demo members matching Image 2
  const defaultTeamMembers = useMemo<MemberOption[]>(() => [
    {
      id: 1,
      user: { id: 1, name: 'Arslan Ghafoor', email: 'arslan@finovo.internal' },
      designation: 'Team Member',
      role: 'developer',
    },
    {
      id: 2,
      user: { id: 2, name: 'Hafiz Obaidullah', email: 'hafiz@finovo.internal' },
      designation: 'UI/UX Designer',
      role: 'designer',
    },
    {
      id: 3,
      user: { id: 3, name: 'Mona Khalil', email: 'mona@finovo.internal' },
      designation: 'Project Manager',
      role: 'manager',
    },
  ], []);

  // Fetch projects and members on load
  useEffect(() => {
    if (!companySlug) return;
    const fetchAux = async () => {
      setLoadingAux(true);
      try {
        const [projRes, memRes] = await Promise.allSettled([
          api.get(`/companies/${companySlug}/projects?per_page=100`),
          api.get(`/companies/${companySlug}/members?per_page=100&status=active`),
        ]);
        if (projRes.status === 'fulfilled' && projRes.value.data) {
          const pList = projRes.value.data.projects?.data || projRes.value.data.data || [];
          setProjects(pList);
          dataPipeline.set(`projects_opt_${companySlug}`, pList);
          if (pList.length > 0 && !projectId) {
            setProjectId(pList[0].id.toString());
          }
        }
        if (memRes.status === 'fulfilled' && memRes.value.data) {
          const mList = memRes.value.data.data || [];
          if (mList.length > 0) {
            setMembers(mList);
            dataPipeline.set(`members_${companySlug}`, mList);
            if (!managerId) setManagerId(mList[0].id.toString());
            if (selectedAssigneeIds.length === 0) {
              setSelectedAssigneeIds([mList[0].id]);
            }
          } else {
            setMembers(defaultTeamMembers);
          }
        } else {
          setMembers(defaultTeamMembers);
        }
      } catch (err) {
        setMembers(defaultTeamMembers);
      } finally {
        setLoadingAux(false);
      }
    };
    fetchAux();
  }, [companySlug]);

  const activeMembers = members.length > 0 ? members : defaultTeamMembers;

  // Keyboard shortcut listeners (Esc to cancel, Cmd+Enter / Ctrl+Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(mode === 'project' ? `/app/${companySlug}/projects` : `/app/${companySlug}/tasks`);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, title, projectId, category, priority, visibility, managerId, dueDate, budget, selectedAssigneeIds]);

  // Selected entities for live preview
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id.toString() === projectId);
  }, [projects, projectId]);

  const selectedManager = useMemo(() => {
    return activeMembers.find((m) => m.id.toString() === managerId) || activeMembers[0];
  }, [activeMembers, managerId]);

  // Filtered members for assignees search
  const filteredMembers = useMemo(() => {
    if (!searchMember.trim()) return activeMembers;
    const q = searchMember.toLowerCase();
    return activeMembers.filter(
      (m) =>
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        (m.designation && m.designation.toLowerCase().includes(q))
    );
  }, [activeMembers, searchMember]);

  // Toggle assignee selection
  const toggleAssignee = (id: number) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Required fields progress: Category is always selected (1), Title is required (2)
  const isTitleValid = title.trim().length > 0;
  const completedRequiredCount = isTitleValid ? 2 : 1;

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      await alertModal({
        title: `${mode === 'project' ? 'Project' : 'Task'} Title Required`,
        message: `Please provide a title for the new ${mode} before continuing.`,
        variant: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'project') {
        // Create Project endpoint
        const payload = {
          name: title.trim(),
          project_code: `PRJ-${Math.floor(100 + Math.random() * 900)}`,
          description: description.trim() || undefined,
          manager_membership_id: managerId ? parseInt(managerId) : activeMembers[0]?.id,
          project_type: category === 'new' ? 'web_app' : category === 'ongoing' ? 'retainer' : 'consulting',
          priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
          billing_model: 'fixed_price',
          budget_amount: parseFloat(budget || '0'),
          currency: 'USD',
          target_end_date: dueDate || undefined,
        };
        await api.post(`/companies/${companySlug}/projects`, payload);
        navigate(`/app/${companySlug}/projects`);
      } else {
        // Create Task endpoint
        const taskTypeMap: Record<string, string> = {
          new: 'feature',
          ongoing: 'bug',
          hold: 'spike',
        };

        const taskVisibilityMap: Record<string, 'internal' | 'confidential' | 'client_visible'> = {
          private: 'confidential',
          members: 'internal',
          company: 'client_visible',
        };

        const payload = {
          project_id: projectId ? parseInt(projectId) : projects[0]?.id || 1,
          title: title.trim(),
          description: description.trim() || undefined,
          task_type: taskTypeMap[category] || 'feature',
          priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
          visibility: taskVisibilityMap[visibility] || 'internal',
          assignee_membership_id: selectedAssigneeIds[0] || (managerId ? parseInt(managerId) : undefined),
          due_at: dueDate ? `${dueDate} 23:59:59` : undefined,
          estimated_minutes: Math.round((parseFloat(estimatedHours) || 4) * 60),
        };

        await api.post(`/companies/${companySlug}/tasks`, payload);
        navigate(`/app/${companySlug}/tasks`);
      }
    } catch (err: any) {
      await alertModal({
        title: `${mode === 'project' ? 'Project' : 'Task'} Creation Failed`,
        message: err.response?.data?.message || 'Could not complete creation. Please check required fields.',
        variant: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'SA';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const backTarget = mode === 'project' ? `/app/${companySlug}/projects` : `/app/${companySlug}/tasks`;

  return (
    <AppShell
      title={mode === 'project' ? 'Add New Project' : 'Add New Task'}
      subtitle={`Dedicated full-page workspace for creating ${mode === 'project' ? 'projects' : 'tasks'}`}
      actions={
        <div className="flex items-center gap-2">
          {/* Quick Switcher between Project and Task mode */}
          <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 flex items-center">
            <button
              type="button"
              onClick={() => setMode('project')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'project'
                  ? 'bg-white text-[#F95716] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setMode('task')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'task'
                  ? 'bg-white text-[#F95716] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Task
            </button>
          </div>

          <button
            onClick={() => navigate(backTarget)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      }
    >
      <div className="p-3 sm:p-5 md:p-6 lg:p-8 max-w-[1540px] mx-auto">
        {/* =========================================================================
            MAIN SPLIT-SCREEN CARD CONTAINER (MATCHES FIGMA IMAGE 1 & 2 PIXEL-PERFECTLY)
           ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col lg:flex-row">
          
          {/* =========================================================================
              LEFT PANEL: AMBIENT PEACH GRADIENT, DYNAMIC PREVIEW & REQUIREMENTS (IMAGE 1)
             ========================================================================= */}
          <div className="w-full lg:w-[350px] xl:w-[380px] shrink-0 bg-gradient-to-b from-[#FFF5ED] via-[#FFF9F5] to-[#FFF5EC] p-6 sm:p-7 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between">
            <div>
              {/* Glowing Warm Orange Squircle Icon (Image 1) */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#F95716] shadow-[0_10px_25px_-4px_rgba(249,87,22,0.4)] flex items-center justify-center text-white mb-5 transition-transform hover:scale-105">
                <FolderPlus className="w-7 h-7 stroke-[2.2]" />
              </div>

              {/* Title & Subtitle (Image 1) */}
              <h1 className="text-2xl sm:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
                Add new {mode === 'project' ? 'project' : 'task'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Set up a new {mode === 'project' ? 'project' : 'task'} and assign your team.
              </p>

              {/* LIVE PREVIEW BADGE (Image 1) */}
              <div className="flex items-center gap-1.5 mt-8 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>👁</span>
                <span>LIVE PREVIEW</span>
              </div>

              {/* DYNAMIC LIVE PREVIEW CARD (Image 1) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow">
                {/* Header Row: Squircle Avatar + Title + Subtitle */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/70 text-slate-400 flex items-center justify-center font-bold text-base shrink-0">
                    {title.trim() ? title.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {title.trim() || `Untitled ${mode}`}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {mode === 'task' ? (selectedProject?.name || 'No department') : 'No department'}
                    </p>
                  </div>
                </div>

                {/* Badges Row (Image 1) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {/* Category Pill: Blue */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                    <span>
                      {category === 'new'
                        ? `New ${mode}`
                        : category === 'ongoing'
                        ? `Ongoing ${mode}`
                        : 'On hold'}
                    </span>
                  </span>

                  {/* Priority Pill: Amber / Orange */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    priority === 'high'
                      ? 'bg-[#FFF1F2] text-[#E11D48] border-[#FFE4E6]'
                      : priority === 'medium'
                      ? 'bg-[#FFF7ED] text-[#EA580C] border-[#FFEDD5]'
                      : 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                  }`}>
                    <span>{priority === 'high' ? '⇡' : priority === 'medium' ? '=' : '⇣'}</span>
                    <span className="capitalize">{priority}</span>
                  </span>

                  {/* Visibility Pill: Purple */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF5FF] text-[#9333EA] border border-[#F3E8FF]">
                    <Users className="w-3 h-3 text-[#9333EA]" />
                    <span className="capitalize">
                      {visibility === 'members'
                        ? `${mode === 'project' ? 'Project' : 'Task'} members`
                        : visibility === 'private'
                        ? 'Private'
                        : 'Company'}
                    </span>
                  </span>
                </div>

                {/* Divider Line & Key-Value Breakdown */}
                <div className="border-t border-slate-100 pt-3.5 space-y-2.5 text-xs">
                  {/* Manager */}
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Manager
                    </span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] flex items-center justify-center font-bold">
                        {getInitials(selectedManager?.user?.name || 'SA')}
                      </span>
                      <span className="truncate max-w-[130px]">
                        {selectedManager?.user?.name || 'System SuperAdmin'}
                      </span>
                    </span>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Due
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-xs">
                      {dueDate ? dueDate.replace(/-/g, '/') : '10/06/2026'}
                    </span>
                  </div>

                  {/* Budget */}
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="text-slate-400 font-bold">$</span>
                      Budget
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-xs">
                      USD {parseFloat(budget || '0').toFixed(2)}
                    </span>
                  </div>

                  {/* Team Members Count */}
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Team
                    </span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#FFE8D6] text-[#F95716] text-[10px] flex items-center justify-center font-bold">
                        A
                      </span>
                      <span>
                        {selectedAssigneeIds.length} member{selectedAssigneeIds.length === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* REQUIRED FIELDS PROGRESS CARD (Image 1 Bottom) */}
            <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Required fields</span>
                <span className="text-slate-400 font-mono font-semibold">
                  {completedRequiredCount} / 2
                </span>
              </div>

              {/* Solid Orange Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#F95716] transition-all duration-300 rounded-full"
                  style={{ width: `${(completedRequiredCount / 2) * 100}%` }}
                />
              </div>

              {/* Checklist */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center text-white shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Category</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  {isTitleValid ? (
                    <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center text-white shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                  )}
                  <span className={isTitleValid ? 'text-slate-700' : 'text-slate-400'}>
                    {mode === 'project' ? 'Project title' : 'Task title'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              RIGHT PANEL: FORM DETAILS WITH 2-COLUMN INPUT ROSTER (IMAGE 2)
             ========================================================================= */}
          <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 lg:p-9 bg-white">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Header with Esc Badge and Close Button (Image 2 Top) */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {mode === 'project' ? 'Project details' : 'Task details'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Fill in the basics — you can change everything later.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 border border-slate-200/90 rounded-md px-2 py-0.5 bg-slate-50 shadow-2xs">
                    Esc
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(backTarget)}
                    className="w-9 h-9 rounded-full border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Form 2-Column Responsive Grid matching Image 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 pt-1">
                
                {/* ----------------- SUBCOLUMN 1 (Left Form) ----------------- */}
                <div className="space-y-5">
                  {/* Project / Task title * with Document Icon */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>{mode === 'project' ? 'Project title' : 'Task title'}</span>
                      <span className="text-[#F95716]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-orange-500">
                        <FileText className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Adventura Landingpage"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Description
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-slate-400">
                        <AlignLeft className="w-4 h-4" />
                      </span>
                      <textarea
                        rows={4}
                        placeholder="A vibrant and engaging platform designed to showcase our latest offerings..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Manager */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Manager
                    </label>
                    <div className="relative">
                      <select
                        value={managerId}
                        onChange={(e) => setManagerId(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] appearance-none shadow-2xs cursor-pointer"
                      >
                        {activeMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.user.name} · {m.designation || 'CEO'}
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                        {getInitials(selectedManager?.user?.name || 'SA')}
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Department / Project Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      {mode === 'task' ? 'Project / Department' : 'Department'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] appearance-none shadow-2xs cursor-pointer"
                      >
                        <option value="">No department assigned</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Due date & Budget Side-by-Side (Image 2) */}
                  <div className="grid grid-cols-2 gap-4">
                    <CustomDatePicker
                      label="Due date"
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="Select due date..."
                    />

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        Budget
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-slate-400 text-xs font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className="w-full pl-6 pr-20 py-2 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                        />
                        <div className="absolute right-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                          <span>USD ($)</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Soft Lavender Sparkles Callout (Image 2) */}
                  <div className="p-3.5 rounded-2xl bg-[#EEF2FF]/80 border border-[#E0E7FF] flex items-center gap-3 text-xs text-indigo-900 leading-relaxed shadow-2xs">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      {mode === 'project'
                        ? 'You can add tasks, milestones and files once the project is created.'
                        : 'You can add subtasks, checklist items and attachments once the task is created.'}
                    </span>
                  </div>
                </div>

                {/* ----------------- SUBCOLUMN 2 (Right Form) ----------------- */}
                <div className="space-y-5">
                  {/* Category * Selectable Cards (Image 2) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>Category</span>
                      <span className="text-[#F95716]">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Card 1: New project/task */}
                      <button
                        type="button"
                        onClick={() => setCategory('new')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          category === 'new'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <FolderPlus className={`w-4 h-4 ${category === 'new' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">New {mode}</span>
                      </button>

                      {/* Card 2: Ongoing project/task */}
                      <button
                        type="button"
                        onClick={() => setCategory('ongoing')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          category === 'ongoing'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <RotateCw className={`w-4 h-4 ${category === 'ongoing' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Ongoing {mode}</span>
                      </button>

                      {/* Card 3: On hold */}
                      <button
                        type="button"
                        onClick={() => setCategory('hold')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          category === 'hold'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <PauseCircle className={`w-4 h-4 ${category === 'hold' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">On hold</span>
                      </button>
                    </div>
                  </div>

                  {/* Priority Selectable Cards (Image 2) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Priority
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPriority('high')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          priority === 'high'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ChevronsUp className={`w-4 h-4 ${priority === 'high' ? 'text-[#F95716]' : 'text-rose-500'}`} />
                        <span className="text-xs font-bold">High</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPriority('medium')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          priority === 'medium'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Equal className={`w-4 h-4 ${priority === 'medium' ? 'text-[#F95716]' : 'text-amber-500'}`} />
                        <span className="text-xs font-bold">Medium</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPriority('low')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          priority === 'low'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ChevronsDown className={`w-4 h-4 ${priority === 'low' ? 'text-[#F95716]' : 'text-emerald-500'}`} />
                        <span className="text-xs font-bold">Low</span>
                      </button>
                    </div>
                  </div>

                  {/* Visibility Selectable Cards (Image 2) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Visibility
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          visibility === 'private'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Private</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisibility('members')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          visibility === 'members'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Users className={`w-4 h-4 ${visibility === 'members' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Project members</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisibility('company')}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          visibility === 'company'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className={`w-4 h-4 ${visibility === 'company' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Company</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                      <span>ⓘ</span>
                      <span>Only people assigned to this {mode} can see it.</span>
                    </p>
                  </div>

                  {/* Assignees Roster with Search and Checkboxes (Image 2) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        Assignees
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF5EE] text-[#F95716]">
                        {selectedAssigneeIds.length} selected
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                      {/* Search Team Members Input */}
                      <div className="p-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search team members..."
                          value={searchMember}
                          onChange={(e) => setSearchMember(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none placeholder-slate-400"
                        />
                      </div>

                      {/* Members Roster List matching Image 2 */}
                      <div className="max-h-[170px] overflow-y-auto divide-y divide-slate-100">
                        {filteredMembers.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">
                            No team members found
                          </div>
                        ) : (
                          filteredMembers.map((member, idx) => {
                            const isSelected = selectedAssigneeIds.includes(member.id);
                            const avatarPalette = [
                              'bg-[#FFE8D6] text-[#F95716]', // Peach A
                              'bg-sky-100 text-sky-700',     // Cyan H
                              'bg-purple-100 text-purple-700', // Purple M
                              'bg-emerald-100 text-emerald-700',
                            ];
                            const avatarClass = avatarPalette[idx % avatarPalette.length];

                            return (
                              <div
                                key={member.id}
                                onClick={() => toggleAssignee(member.id)}
                                className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                  isSelected ? 'bg-orange-50/30' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0`}>
                                    {getInitials(member.user.name)}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                      {member.user.name}
                                    </h4>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {member.designation || member.role || 'Team Member'}
                                    </p>
                                  </div>
                                </div>

                                {/* Custom Squircle Checkbox (Image 2) */}
                                <div
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-[#F95716] border-[#F95716] text-white shadow-xs'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Bar (Image 2) */}
              <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-auto">
                  <span>ⓘ</span>
                  <span>Fields marked <strong className="text-[#F95716]">*</strong> are required</span>
                </p>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(backTarget)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200/90 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F95716] hover:bg-[#e0480c] text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <span>+ Create {mode}</span>
                        <span className="bg-white/20 text-white rounded px-1.5 py-0.5 text-[10px] font-mono font-medium">
                          ⌘↵
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default TaskCreatePage;

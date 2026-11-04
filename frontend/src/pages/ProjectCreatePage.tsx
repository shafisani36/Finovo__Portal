import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderPlus,
  FileText,
  AlignLeft,
  Calendar,
  Check,
  X,
  Search,
  ChevronsUp,
  Equal,
  ChevronsDown,
  Lock,
  Users,
  Building2,
  Sparkles,
  RotateCw,
  PauseCircle,
  Loader2,
  ArrowLeft,
  Plus,
  ShieldCheck,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';
import api from '../lib/api';
import { dataPipeline } from '../lib/dataPipeline';
import { notifyProjectsUpdated } from '../lib/projectSync';
import { useConfirm } from '../context/ConfirmationModalContext';
import { CustomDropdown } from '../components/ui/CustomDropdown';
import { CustomDatePicker } from '../components/ui/CustomCalendar';
import { FinovoLogo } from '../components/ui/FinovoLogo';

interface MemberOption {
  id: number;
  user: { id: number; name: string; email: string };
  designation?: string;
  role?: string;
}

interface DepartmentOption {
  id: number;
  name: string;
}

export const ProjectCreatePage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { alert: alertModal } = useConfirm();
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auxiliary data
  const [members, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || []
  );
  const [departments, setDepartments] = useState<DepartmentOption[]>(
    () => dataPipeline.get(`departments_${companySlug}`) || []
  );
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(
    'A vibrant and engaging platform designed to showcase our latest offerings...'
  );
  const [category, setCategory] = useState<'new' | 'ongoing' | 'hold'>('new');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [visibility, setVisibility] = useState<'private' | 'members' | 'company'>('members');
  const [managerId, setManagerId] = useState<string>('');
  const [departmentName, setDepartmentName] = useState<string>('No department assigned');
  const [dueDate, setDueDate] = useState('2026-10-06');
  const [budget, setBudget] = useState('0.00');
  const [currency, setCurrency] = useState('USD');

  // Assignees selection
  const [searchMember, setSearchMember] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([1]);

  // Demo fallback members
  const defaultTeamMembers = useMemo<MemberOption[]>(
    () => [
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
    ],
    []
  );

  // Auto focus title input on mount
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Load active members & departments
  useEffect(() => {
    if (!companySlug) return;

    const loadAuxData = async () => {
      try {
        const [memRes, deptRes] = await Promise.allSettled([
          api.get(`/companies/${companySlug}/members?per_page=50&status=active`),
          api.get(`/companies/${companySlug}/departments?per_page=50`),
        ]);

        if (memRes.status === 'fulfilled' && memRes.value.data) {
          const list = memRes.value.data.data || [];
          if (list.length > 0) {
            setMembers(list);
            dataPipeline.set(`members_${companySlug}`, list, 180000);
            if (!managerId) setManagerId(list[0].id.toString());
          } else {
            setMembers(defaultTeamMembers);
          }
        } else {
          setMembers(defaultTeamMembers);
        }

        if (deptRes.status === 'fulfilled' && deptRes.value.data) {
          const dList = deptRes.value.data.data || [];
          setDepartments(dList);
          dataPipeline.set(`departments_${companySlug}`, dList, 180000);
        }
      } catch {
        setMembers(defaultTeamMembers);
      }
    };

    loadAuxData();
  }, [companySlug, defaultTeamMembers]);

  const activeMembers = members.length > 0 ? members : defaultTeamMembers;

  // Keyboard shortcut listeners (Esc to go back, Cmd/Ctrl+Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(`/app/${companySlug}/projects`);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companySlug, title, category, priority, visibility, managerId, dueDate, budget, currency, selectedAssigneeIds]);

  // Selected manager for live preview
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

  // Required fields progress: Category is pre-selected (1), Title is required (2)
  const isTitleValid = title.trim().length > 0;
  const completedRequiredCount = isTitleValid ? 2 : 1;

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      await alertModal({
        title: 'Project Title Required',
        message: 'Please provide a project title before creating the project.',
        variant: 'danger',
      });
      titleInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const statusMap: Record<string, string> = {
        new: 'planning',
        ongoing: 'active',
        hold: 'on_hold',
      };

      const payload = {
        name: title.trim(),
        description: description.trim() || undefined,
        manager_membership_id: managerId ? parseInt(managerId) : activeMembers[0]?.id,
        project_type: 'web_application',
        priority,
        status: statusMap[category] || 'planning',
        billing_model: 'fixed_price',
        budget_amount: parseFloat(budget || '0'),
        currency: currency || 'USD',
        target_end_date: dueDate || undefined,
      };

      const res = await api.post(`/companies/${companySlug}/projects`, payload);
      const createdProject = res.data.project || res.data;

      // Assign selected team members if any
      if (createdProject?.id && selectedAssigneeIds.length > 0) {
        for (const memberId of selectedAssigneeIds) {
          try {
            await api.post(`/companies/${companySlug}/projects/${createdProject.id}/members`, {
              membership_id: memberId,
              project_role: 'developer',
              allocation_percent: 100,
            });
          } catch {
            // Continue gracefully
          }
        }
      }

      // Invalidate cache and broadcast synchronization
      dataPipeline.delete(`projects_${companySlug}`);
      dataPipeline.delete(`projects_summary_${companySlug}`);
      notifyProjectsUpdated(companySlug || 'default');

      // Navigate straight back to projects table
      navigate(`/app/${companySlug}/projects`);
    } catch (err: any) {
      await alertModal({
        title: 'Project Creation Failed',
        message:
          err.response?.data?.message ||
          'Could not create the project. Please check that required fields are filled properly.',
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

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full bg-[#F8FAFC] text-slate-900 flex flex-col font-['Inter',sans-serif] selection:bg-orange-500/20 selection:text-orange-950">
      {/* Background Brand Ambient Radial Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_30%_15%,rgba(249,115,22,0.08),rgba(254,215,170,0.04)_45%,transparent_70%)] -z-10" />

      {/* =========================================================================
          TOP ENTERPRISE NAVIGATION HEADER BAR (NO SIDEBAR, FULL CANVAS)
         ========================================================================= */}
      <header className="w-full shrink-0 h-15 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-between z-30 sticky top-0 shadow-2xs">
        {/* Left: Brand Logo + Breadcrumbs */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <FinovoLogo size="sm" />
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
            <Link
              to={`/app/${companySlug}/projects`}
              className="hover:text-[#F95716] font-medium transition-colors truncate"
            >
              Projects
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900 truncate">Create Project</span>
          </nav>
        </div>

        {/* Center Badge: Telemetry Status (Hidden on small mobile) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/8 border border-orange-500/15 text-[11px] font-semibold text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F95716] animate-pulse" />
          <span>Project Provisioning Engine</span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/app/${companySlug}/projects`)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Discard and exit (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Exit</span>
            <span className="hidden xl:inline text-[10px] text-slate-400 font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200/80">
              Esc
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create Project</span>
                <span className="hidden lg:inline bg-white/20 text-white rounded px-1.5 py-0.2 text-[10px] font-mono font-medium">
                  ⌘↵
                </span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN 100vh FULL-PAGE APPLICATION CANVAS (STRICT 100vh ON DESKTOP, FLUID ON MOBILE)
         ========================================================================= */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-5 md:p-6 lg:p-6 xl:p-8 flex flex-col lg:flex-row gap-5 lg:gap-6 xl:gap-8 min-h-0 lg:overflow-hidden">
        {/* =========================================================================
            LEFT COLUMN: WARM PEACH AMBIENT PREVIEW & PROGRESS ROSTER
           ========================================================================= */}
        <aside className="w-full lg:w-[360px] xl:w-[410px] 2xl:w-[440px] shrink-0 lg:h-full flex flex-col justify-between bg-gradient-to-b from-[#FFF5ED] via-[#FFF9F5] to-[#FFF5EC] rounded-3xl border border-orange-200/70 p-5 sm:p-6 lg:p-7 shadow-xs overflow-y-auto custom-scrollbar select-none">
          <div>
            {/* Glowing Brand Squircle Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#F95716] shadow-[0_10px_25px_-4px_rgba(249,87,22,0.4)] flex items-center justify-center text-white mb-4 transition-transform hover:scale-105">
              <FolderPlus className="w-6 h-6 stroke-[2.2]" />
            </div>

            {/* Heading & Subtitle */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Add new project
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Provision a unified workspace for delivery, team allocation, and financial tracking.
            </p>

            {/* LIVE PREVIEW BADGE */}
            <div className="flex items-center gap-1.5 mt-6 mb-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>👁</span>
              <span>LIVE PROJECT PREVIEW</span>
            </div>

            {/* DYNAMIC LIVE PREVIEW CARD */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-4.5 shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
              {/* Header: Squircle Initial + Title + Department */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#F95716] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  {title.trim() ? title.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 truncate">
                    {title.trim() || 'Untitled Project'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {departmentName || 'No department assigned'}
                  </p>
                </div>
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {/* Category Pill */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  <span>
                    {category === 'new'
                      ? 'New project'
                      : category === 'ongoing'
                      ? 'Ongoing project'
                      : 'On hold'}
                  </span>
                </span>

                {/* Priority Pill */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    priority === 'high'
                      ? 'bg-[#FFF1F2] text-[#E11D48] border-[#FFE4E6]'
                      : priority === 'medium'
                      ? 'bg-[#FFF7ED] text-[#EA580C] border-[#FFEDD5]'
                      : 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                  }`}
                >
                  <span>{priority === 'high' ? '⇡' : priority === 'medium' ? '=' : '⇣'}</span>
                  <span className="capitalize">{priority} Priority</span>
                </span>

                {/* Visibility Pill */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF5FF] text-[#9333EA] border border-[#F3E8FF]">
                  <Users className="w-3 h-3 text-[#9333EA]" />
                  <span className="capitalize">
                    {visibility === 'members'
                      ? 'Members only'
                      : visibility === 'private'
                      ? 'Private'
                      : 'Company-wide'}
                  </span>
                </span>
              </div>

              {/* Divider & Metadata Table */}
              <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs">
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
                    <span className="truncate max-w-[140px]">
                      {selectedManager?.user?.name || 'System SuperAdmin'}
                    </span>
                  </span>
                </div>

                {/* Due Date */}
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Deadline
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
                    {currency} {parseFloat(budget || '0').toFixed(2)}
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
                      {selectedAssigneeIds.length}
                    </span>
                    <span>
                      {selectedAssigneeIds.length} member{selectedAssigneeIds.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* REQUIRED FIELDS PROGRESS CARD */}
          <div className="mt-5 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Required setup</span>
              <span className="text-slate-400 font-mono font-semibold">
                {completedRequiredCount} / 2 Complete
              </span>
            </div>

            {/* Solid Brand Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-[#F95716] transition-all duration-300 rounded-full"
                style={{ width: `${(completedRequiredCount / 2) * 100}%` }}
              />
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5 pt-0.5 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center text-white shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Category defined</span>
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
                  Project title provided
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* =========================================================================
            RIGHT COLUMN: COMPREHENSIVE 2-COLUMN FORM (SCROLLABLE & 100VH BOUND)
           ========================================================================= */}
        <section className="flex-1 lg:h-full bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden min-h-0">
          {/* Header inside Card */}
          <div className="px-6 py-4.5 sm:px-8 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/40">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                Project Configuration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fill in the primary attributes — milestones and tasks can be added after launch.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Multi-tenant Isolation</span>
            </div>
          </div>

          {/* Form Body - Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 custom-scrollbar">
            <form id="project-create-form" onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
              {/* 2-Column Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
                {/* ----------------- SUBCOLUMN 1: Left Form Group ----------------- */}
                <div className="space-y-4 sm:space-y-4.5">
                  {/* Project Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>Project title</span>
                      <span className="text-[#F95716]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-orange-500">
                        <FileText className="w-4 h-4" />
                      </span>
                      <span className="absolute left-9 text-slate-300 select-none">|</span>
                      <input
                        ref={titleInputRef}
                        type="text"
                        required
                        placeholder="e.g. NextGen Core Cloud Portal"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full pl-11 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Scope Description</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-slate-400">
                        <AlignLeft className="w-4 h-4" />
                      </span>
                      <textarea
                        rows={3}
                        placeholder="Comprehensive platform designed to streamline multi-regional operations..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Manager (CustomDropdown) */}
                  <CustomDropdown
                    label="Assigned Project Lead / Manager"
                    value={managerId}
                    onChange={setManagerId}
                    placeholder="Select Manager"
                    options={activeMembers.map((m) => ({
                      value: String(m.id),
                      label: `${m.user.name} · ${m.designation || 'Project Lead'}`,
                      description: m.user.email,
                    }))}
                    leadingIcon={<Users className="w-4 h-4" />}
                    searchable={activeMembers.length > 5}
                    fullWidth
                  />

                  {/* Department (CustomDropdown) */}
                  <CustomDropdown
                    label="Department"
                    value={departmentName}
                    onChange={setDepartmentName}
                    placeholder="Select Department"
                    options={[
                      { value: 'No department assigned', label: 'No department assigned' },
                      ...departments.map((d) => ({
                        value: d.name,
                        label: d.name,
                      })),
                    ]}
                    leadingIcon={<Building2 className="w-4 h-4" />}
                    searchable={departments.length > 5}
                    fullWidth
                  />

                  {/* Deadline & Budget Side-by-Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <CustomDatePicker
                      label="Target Deadline"
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="Select target deadline..."
                    />

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Total Budget</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-slate-400 text-xs font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className="w-full pl-6 pr-26 py-2 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs font-mono"
                        />
                        <div className="absolute right-1">
                          <CustomDropdown
                            size="sm"
                            variant="ghost"
                            value={currency || 'USD'}
                            onChange={(val) => setCurrency(val)}
                            options={[
                              { value: 'USD', label: 'USD ($)' },
                              { value: 'EUR', label: 'EUR (€)' },
                              { value: 'GBP', label: 'GBP (£)' },
                              { value: 'CAD', label: 'CAD ($)' },
                              { value: 'AUD', label: 'AUD ($)' },
                            ]}
                            searchable={false}
                            className="w-24"
                            triggerClassName="py-1 px-2 text-[11px] font-semibold border-slate-200/80 bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sparkles Informative Callout */}
                  <div className="p-3.5 rounded-2xl bg-[#EEF2FF]/80 border border-[#E0E7FF] flex items-center gap-2.5 text-xs text-indigo-900 leading-relaxed shadow-2xs">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      Tasks, Gantt milestones, and financial contracts can be scheduled once provisioned.
                    </span>
                  </div>
                </div>

                {/* ----------------- SUBCOLUMN 2: Right Form Group ----------------- */}
                <div className="space-y-4 sm:space-y-4.5">
                  {/* Category Selection Cards */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>Category</span>
                      <span className="text-[#F95716]">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCategory('new')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          category === 'new'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <FolderPlus className={`w-4 h-4 ${category === 'new' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">New project</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategory('ongoing')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          category === 'ongoing'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <RotateCw className={`w-4 h-4 ${category === 'ongoing' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Ongoing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategory('hold')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
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

                  {/* Priority Cards */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Priority Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPriority('high')}
                        className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
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
                        className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
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
                        className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
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

                  {/* Visibility Cards */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Workspace Visibility</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
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
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          visibility === 'members'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Users className={`w-4 h-4 ${visibility === 'members' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Members</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisibility('company')}
                        className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          visibility === 'company'
                            ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className={`w-4 h-4 ${visibility === 'company' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">Company</span>
                      </button>
                    </div>
                  </div>

                  {/* Assignees Roster with Search and Checkboxes */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">Initial Project Team</label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF5EE] text-[#F95716]">
                        {selectedAssigneeIds.length} assigned
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                      {/* Search Team Members Input */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter team members by name or role..."
                          value={searchMember}
                          onChange={(e) => setSearchMember(e.target.value)}
                          className="w-full text-xs bg-transparent focus:outline-none placeholder-slate-400"
                        />
                      </div>

                      {/* Members Roster List */}
                      <div className="max-h-[155px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                        {filteredMembers.length === 0 ? (
                          <div className="py-5 text-center text-xs text-slate-400">
                            No team members found
                          </div>
                        ) : (
                          filteredMembers.map((member, idx) => {
                            const isSelected = selectedAssigneeIds.includes(member.id);
                            const avatarPalette = [
                              'bg-[#FFE8D6] text-[#F95716]',
                              'bg-sky-100 text-sky-700',
                              'bg-purple-100 text-purple-700',
                              'bg-emerald-100 text-emerald-700',
                            ];
                            const avatarClass = avatarPalette[idx % avatarPalette.length];

                            return (
                              <div
                                key={member.id}
                                onClick={() => toggleAssignee(member.id)}
                                className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                  isSelected ? 'bg-orange-50/30' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`w-7 h-7 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0`}
                                  >
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
            </form>
          </div>

          {/* Fixed Form Bottom Action Bar */}
          <div className="shrink-0 px-6 py-4 sm:px-8 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-auto">
              <span>ⓘ</span>
              <span>
                Fields marked <strong className="text-[#F95716]">*</strong> are required for workspace provisioning.
              </span>
            </p>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => navigate(`/app/${companySlug}/projects`)}
                className="px-4 py-2 rounded-xl border border-slate-200/90 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="project-create-form"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating project...</span>
                  </>
                ) : (
                  <>
                    <span>+ Create project</span>
                    <span className="bg-white/20 text-white rounded px-1.5 py-0.5 text-[10px] font-mono font-medium">
                      ⌘↵
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProjectCreatePage;

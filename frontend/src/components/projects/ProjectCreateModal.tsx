import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ChevronDown,
  Loader2,
} from 'lucide-react';
import api from '../../lib/api';
import { dataPipeline } from '../../lib/dataPipeline';
import { notifyProjectsUpdated } from '../../lib/projectSync';
import { useConfirm } from '../../context/ConfirmationModalContext';
import { CustomDropdown } from '../ui/CustomDropdown';
import { CustomDatePicker } from '../ui/CustomCalendar';

export interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newProject: any) => void;
  isPageMode?: boolean;
}

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

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isPageMode = false,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { alert: alertModal } = useConfirm();

  // Auxiliary data
  const [members, setMembers] = useState<MemberOption[]>(
    () => dataPipeline.get(`members_${companySlug}`) || []
  );
  const [departments, setDepartments] = useState<DepartmentOption[]>(
    () => dataPipeline.get(`departments_${companySlug}`) || []
  );
  const [submitting, setSubmitting] = useState(false);

  // Form states matching Image 1 & 2
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

  // Demo fallback members matching Image 2 perfectly
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

  // Load active members & departments
  useEffect(() => {
    if (!companySlug || !isOpen) return;

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
  }, [companySlug, isOpen, defaultTeamMembers]);

  const activeMembers = members.length > 0 ? members : defaultTeamMembers;

  // Keyboard shortcut listeners (Esc to close, Cmd+Enter / Ctrl+Enter to submit)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, title, category, priority, visibility, managerId, dueDate, budget, selectedAssigneeIds]);

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

  // Required fields progress: Category is always selected (1), Title is required (2)
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
            // Member assignment error handling (continue)
          }
        }
      }

      // Invalidate cache and broadcast instant UI synchronization
      dataPipeline.delete(`projects_${companySlug}`);
      dataPipeline.delete(`projects_summary_${companySlug}`);
      notifyProjectsUpdated(companySlug || 'default');

      if (onSuccess) {
        onSuccess(createdProject);
      }
      onClose();

      if (isPageMode) {
        navigate(`/app/${companySlug}/projects`);
      }
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

  if (!isOpen) return null;

  const content = (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col lg:flex-row w-full max-w-5xl max-h-[92vh] font-['Inter',sans-serif]">
      {/* =========================================================================
          LEFT PANEL: WARM PEACH AMBIENT GRADIENT, LIVE PREVIEW & PROGRESS (IMAGE 2)
         ========================================================================= */}
      <div className="w-full lg:w-[350px] xl:w-[380px] shrink-0 bg-gradient-to-b from-[#FFF5ED] via-[#FFF9F5] to-[#FFF5EC] p-6 sm:p-7 border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between overflow-y-auto custom-scrollbar select-none">
        <div>
          {/* Glowing Warm Orange Squircle Icon (Image 2) */}
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#F95716] shadow-[0_10px_25px_-4px_rgba(249,87,22,0.4)] flex items-center justify-center text-white mb-4.5 transition-transform hover:scale-105">
            <FolderPlus className="w-6.5 h-6.5 stroke-[2.2]" />
          </div>

          {/* Heading & Subtitle */}
          <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Add new project
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Set up a new project and assign your team.
          </p>

          {/* LIVE PREVIEW BADGE */}
          <div className="flex items-center gap-1.5 mt-7 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>👁</span>
            <span>LIVE PREVIEW</span>
          </div>

          {/* DYNAMIC LIVE PREVIEW CARD (Image 2) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
            {/* Header: Squircle Initial + Title + Department */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-slate-400 flex items-center justify-center font-bold text-sm shrink-0">
                {title.trim() ? title.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 truncate">
                  {title.trim() || 'Untitled project'}
                </h3>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {departmentName || 'No department'}
                </p>
              </div>
            </div>

            {/* Badges Row (Image 2) */}
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
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${priority === 'high'
                    ? 'bg-[#FFF1F2] text-[#E11D48] border-[#FFE4E6]'
                    : priority === 'medium'
                      ? 'bg-[#FFF7ED] text-[#EA580C] border-[#FFEDD5]'
                      : 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                  }`}
              >
                <span>{priority === 'high' ? '⇡' : priority === 'medium' ? '=' : '⇣'}</span>
                <span className="capitalize">{priority}</span>
              </span>

              {/* Visibility Pill */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF5FF] text-[#9333EA] border border-[#F3E8FF]">
                <Users className="w-3 h-3 text-[#9333EA]" />
                <span className="capitalize">
                  {visibility === 'members'
                    ? 'Project members'
                    : visibility === 'private'
                      ? 'Private'
                      : 'Company'}
                </span>
              </span>
            </div>

            {/* Divider Line & Key-Value Rows */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
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

        {/* REQUIRED FIELDS PROGRESS CARD (Image 2 Bottom) */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
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
          <div className="space-y-1.5 pt-0.5 text-xs">
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
                Project title
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANEL: FORM DETAILS WITH 2-COLUMN INPUT ROSTER (IMAGE 1)
         ========================================================================= */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-7 lg:p-8 bg-white overflow-y-auto custom-scrollbar">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Header with Esc Badge and Close Button (Image 1 Top) */}
          <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                Project details
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fill in the basics — you can change everything later.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 border border-slate-200/90 rounded-md px-2 py-0.5 bg-slate-50 shadow-2xs">
                Esc
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form 2-Column Responsive Grid matching Image 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 pt-0.5">
            {/* ----------------- SUBCOLUMN 1 (Left Form) ----------------- */}
            <div className="space-y-4">
              {/* Project title * with Document Icon */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Project title</span>
                  <span className="text-[#F95716]">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-orange-500">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="absolute left-8.5 text-slate-300">|</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adventura Landingpage"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full pl-11 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Description</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">
                    <AlignLeft className="w-4 h-4" />
                  </span>
                  <textarea
                    rows={3}
                    placeholder="A vibrant and engaging platform designed to showcase our latest offerings..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Manager */}
              <CustomDropdown
                label="Manager"
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

              {/* Department */}
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

              {/* Due date & Budget Side-by-Side (Image 1) */}
              <div className="grid grid-cols-2 gap-3">
                <CustomDatePicker
                  label="Due date"
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="Select due date..."
                />

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Budget</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 text-xs font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full pl-6 pr-28 py-2 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
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
                        className="w-28"
                        triggerClassName="py-1 px-2 text-[11px] font-semibold border-slate-200/80 bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sparkles Callout (Image 1) */}
              <div className="p-3 rounded-2xl bg-[#EEF2FF]/80 border border-[#E0E7FF] flex items-center gap-2.5 text-xs text-indigo-900 leading-relaxed shadow-2xs">
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>You can add tasks, milestones and files once the project is created.</span>
              </div>
            </div>

            {/* ----------------- SUBCOLUMN 2 (Right Form) ----------------- */}
            <div className="space-y-4">
              {/* Category * Selectable Cards (Image 1) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Category</span>
                  <span className="text-[#F95716]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Card 1: New project */}
                  <button
                    type="button"
                    onClick={() => setCategory('new')}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${category === 'new'
                        ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <FolderPlus className={`w-4 h-4 ${category === 'new' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">New project</span>
                  </button>

                  {/* Card 2: Ongoing project */}
                  <button
                    type="button"
                    onClick={() => setCategory('ongoing')}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${category === 'ongoing'
                        ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <RotateCw className={`w-4 h-4 ${category === 'ongoing' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">Ongoing project</span>
                  </button>

                  {/* Card 3: On hold */}
                  <button
                    type="button"
                    onClick={() => setCategory('hold')}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${category === 'hold'
                        ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <PauseCircle className={`w-4 h-4 ${category === 'hold' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">On hold</span>
                  </button>
                </div>
              </div>

              {/* Priority Selectable Cards (Image 1) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('high')}
                    className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${priority === 'high'
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
                    className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${priority === 'medium'
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
                    className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${priority === 'low'
                        ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <ChevronsDown className={`w-4 h-4 ${priority === 'low' ? 'text-[#F95716]' : 'text-emerald-500'}`} />
                    <span className="text-xs font-bold">Low</span>
                  </button>
                </div>
              </div>

              {/* Visibility Selectable Cards (Image 1) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${visibility === 'private'
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
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${visibility === 'members'
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
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${visibility === 'company'
                        ? 'bg-[#FFF7F3] border-[#F95716] border-2 text-[#F95716] shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Building2 className={`w-4 h-4 ${visibility === 'company' ? 'text-[#F95716]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold">Company</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1">
                  <span>ⓘ</span>
                  <span>Only people assigned to this project can see it.</span>
                </p>
              </div>

              {/* Assignees Roster with Search and Squircle Checkboxes (Image 1) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Assignees</label>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF5EE] text-[#F95716]">
                    {selectedAssigneeIds.length} selected
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  {/* Search Team Members Input */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search team members..."
                      value={searchMember}
                      onChange={(e) => setSearchMember(e.target.value)}
                      className="w-full text-xs bg-transparent focus:outline-none placeholder-slate-400"
                    />
                  </div>

                  {/* Members Roster List matching Image 1 */}
                  <div className="max-h-[145px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                    {filteredMembers.length === 0 ? (
                      <div className="py-5 text-center text-xs text-slate-400">
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
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-orange-50/30' : 'hover:bg-slate-50/70'
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

                            {/* Custom Squircle Checkbox (Image 1) */}
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected
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

          {/* Bottom Footer Bar (Image 1) */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-auto">
              <span>ⓘ</span>
              <span>
                Fields marked <strong className="text-[#F95716]">*</strong> are required
              </span>
            </p>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200/90 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
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
        </form>
      </div>
    </div>
  );

  if (isPageMode) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-150">
      {content}
    </div>
  );
};

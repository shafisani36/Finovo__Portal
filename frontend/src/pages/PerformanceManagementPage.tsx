import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/layouts/AppShell';
import { useAuth } from '../context/AuthContext';
import { dataPipeline } from '../lib/dataPipeline';
import {
  Award,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Plus,
  Download,
  UserCheck,
  Compass,
  Link as LinkIcon,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  HelpCircle,
  Clock,
  Filter
} from 'lucide-react';

interface ReviewCycle {
  id: number;
  title: string;
  cycle_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reviews_count?: number;
}

interface PerformanceReviewItem {
  id: number;
  status: string;
  self_rating: string | null;
  self_summary: string | null;
  manager_rating: string | null;
  manager_summary: string | null;
  final_rating: string | null;
  quality_score: string;
  quality_flags: string[] | null;
  employee: {
    id: number;
    membership: {
      user: {
        id: number;
        name: string;
        email: string;
      };
    };
  };
  reviewer?: {
    id: number;
    membership: {
      user: {
        id: number;
        name: string;
        email: string;
      };
    };
  };
  evidence_links?: Array<{
    id: number;
    evidence_type: string;
    title: string;
    description: string;
  }>;
}

interface GoalItem {
  id: number;
  title: string;
  description: string;
  measurement_type: string;
  target_value: string;
  current_value: string;
  calculated_progress: number;
  status: string;
  employee: {
    membership: {
      user: {
        name: string;
      };
    };
  };
}

interface FrameworkItem {
  id: number;
  name: string;
  role_target: string;
  competencies: Array<{
    name: string;
    target_level: number;
    observable_criteria: string;
  }>;
}

interface DevelopmentPlanItem {
  id: number;
  title: string;
  target_competency: string;
  learning_action: string;
  status: string;
  employee: {
    membership: {
      user: {
        name: string;
      };
    };
  };
  mentor?: {
    name: string;
  };
}

interface FeedbackItem {
  id: number;
  feedback_type: string;
  badge: string;
  content: string;
  visibility: string;
  employee: {
    membership: {
      user: {
        name: string;
      };
    };
  };
  author: {
    name: string;
  };
}

interface ChecklistItem {
  id: number;
  template_name: string;
  progress_percent: number;
  status: string;
  items: Array<{
    id: number;
    title: string;
    completed: boolean;
  }>;
  employee: {
    membership: {
      user: {
        name: string;
      };
    };
  };
}

export const PerformanceManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.company?.id;

  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'goals' | 'skills' | 'plans' | 'feedback' | 'onboarding'>('overview');

  // Pipeline Cache State
  const cacheKey = `performance_overview_${companyId}`;
  const cached = dataPipeline.get<any>(cacheKey);

  const [loading, setLoading] = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);

  // Data States
  const [cycles, setCycles] = useState<ReviewCycle[]>(() => cached?.cycles ?? []);
  const [reviews, setReviews] = useState<PerformanceReviewItem[]>(() => cached?.reviews ?? []);
  const [goals, setGoals] = useState<GoalItem[]>(() => cached?.goals ?? []);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>(() => cached?.frameworks ?? []);
  const [plans, setPlans] = useState<DevelopmentPlanItem[]>(() => cached?.plans ?? []);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => cached?.feedbacks ?? []);
  const [checklists, setChecklists] = useState<ChecklistItem[]>(() => cached?.checklists ?? []);

  // Modals & Active Actions
  const [selectedReview, setSelectedReview] = useState<PerformanceReviewItem | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceType, setEvidenceType] = useState('task');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalMeasurement, setGoalMeasurement] = useState('percentage');
  const [goalTarget, setGoalTarget] = useState('100');

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackBadge, setFeedbackBadge] = useState('Architectural Innovator');

  // Selected framework for skill gap evaluation
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<number | null>(null);
  const [skillGapAnalysis, setSkillGapAnalysis] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchCoreData();
    }
  }, [companyId]);

  const fetchCoreData = async (force = false) => {
    if (!companyId) return;
    const currentCached = !force ? dataPipeline.get<any>(cacheKey) : null;
    if (currentCached) {
      setCycles(currentCached.cycles);
      setReviews(currentCached.reviews);
      setGoals(currentCached.goals);
      setFrameworks(currentCached.frameworks);
      setPlans(currentCached.plans);
      setFeedbacks(currentCached.feedbacks);
      setChecklists(currentCached.checklists);
      if (currentCached.frameworks?.length > 0 && !selectedFrameworkId) {
        setSelectedFrameworkId(currentCached.frameworks[0].id);
      }
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      const [cycRes, revRes, goalRes, frameRes, planRes, feedRes, checkRes] = await Promise.all([
        fetch(`/api/v1/companies/${companyId}/hr/cycles`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/reviews`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/goals`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/frameworks`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/development-plans`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/feedbacks`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/hr/checklists`, { credentials: 'include' }),
      ]);

      let newCycles: ReviewCycle[] = [];
      let newReviews: PerformanceReviewItem[] = [];
      let newGoals: GoalItem[] = [];
      let newFrameworks: FrameworkItem[] = [];
      let newPlans: DevelopmentPlanItem[] = [];
      let newFeedbacks: FeedbackItem[] = [];
      let newChecklists: ChecklistItem[] = [];

      if (cycRes.ok) {
        const d = await cycRes.json();
        newCycles = d.data || [];
        setCycles(newCycles);
      }
      if (revRes.ok) {
        const d = await revRes.json();
        newReviews = d.data || [];
        setReviews(newReviews);
      }
      if (goalRes.ok) {
        const d = await goalRes.json();
        newGoals = d.data || [];
        setGoals(newGoals);
      }
      if (frameRes.ok) {
        const d = await frameRes.json();
        newFrameworks = d.data || [];
        setFrameworks(newFrameworks);
        if (newFrameworks.length > 0 && !selectedFrameworkId) {
          setSelectedFrameworkId(newFrameworks[0].id);
        }
      }
      if (planRes.ok) {
        const d = await planRes.json();
        newPlans = d.data || [];
        setPlans(newPlans);
      }
      if (feedRes.ok) {
        const d = await feedRes.json();
        newFeedbacks = d.data || [];
        setFeedbacks(newFeedbacks);
      }
      if (checkRes.ok) {
        const d = await checkRes.json();
        newChecklists = d.data || [];
        setChecklists(newChecklists);
      }

      dataPipeline.set(cacheKey, {
        cycles: newCycles,
        reviews: newReviews,
        goals: newGoals,
        frameworks: newFrameworks,
        plans: newPlans,
        feedbacks: newFeedbacks,
        checklists: newChecklists,
      }, 120000);
    } catch (err) {
      console.error('Failed to load performance data', err);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  };

  const handleLinkEvidence = async () => {
    if (!selectedReview || !evidenceTitle.trim()) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/hr/reviews/${selectedReview.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          evidence_type: evidenceType,
          title: evidenceTitle,
          description: evidenceDesc,
        }),
      });
      if (res.ok) {
        setShowEvidenceModal(false);
        setEvidenceTitle('');
        setEvidenceDesc('');
        fetchCoreData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGoal = async () => {
    if (!reviews[0]?.employee?.id || !goalTitle.trim()) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/hr/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employee_id: reviews[0].employee.id,
          title: goalTitle,
          measurement_type: goalMeasurement,
          target_value: parseFloat(goalTarget) || 100,
        }),
      });
      if (res.ok) {
        setShowGoalModal(false);
        setGoalTitle('');
        fetchCoreData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGiveFeedback = async () => {
    if (!reviews[0]?.employee?.id || !feedbackContent.trim()) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/hr/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employee_id: reviews[0].employee.id,
          feedback_type: 'recognition',
          badge: feedbackBadge,
          content: feedbackContent,
          visibility: 'public',
        }),
      });
      if (res.ok) {
        setShowFeedbackModal(false);
        setFeedbackContent('');
        fetchCoreData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleChecklist = async (checklistId: number, itemId: number, currentCompleted: boolean) => {
    try {
      await fetch(`/api/v1/companies/${companyId}/hr/checklists/${checklistId}/toggle-item`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_id: itemId,
          completed: !currentCompleted,
        }),
      });
      fetchCoreData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateSkills = async (frameworkId: number) => {
    if (!reviews[0]?.employee?.id) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/hr/skill-gaps/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employee_id: reviews[0].employee.id,
          framework_id: frameworkId,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setSkillGapAnalysis(d.data?.analysis || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppShell
      title="HR, Performance & Growth Intelligence"
      subtitle="Evidence-based performance cycles, skill gap engine, OKRs and continuous development"
      actions={
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/companies/${companyId}/hr/export`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Audited Data
          </a>
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 mb-6 gap-2 overflow-x-auto text-xs font-bold">
        {[
          { key: 'overview', label: 'HR Overview & Guard', icon: LayoutDashboardIcon },
          { key: 'reviews', label: 'Reviews & Evidence Passport', icon: Award },
          { key: 'goals', label: 'Goals & OKRs', icon: Target },
          { key: 'skills', label: 'Skill-Gap & Career Path Engine', icon: Compass },
          { key: 'plans', label: 'Development Plans & Mentorship', icon: TrendingUp },
          { key: 'feedback', label: 'Recognition & Feedback', icon: Sparkles },
          { key: 'onboarding', label: 'Onboarding & Checklists', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                if (tab.key === 'skills' && selectedFrameworkId) {
                  handleEvaluateSkills(selectedFrameworkId);
                }
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#F95716] text-[#F95716]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isValidating && cycles.length > 0 && (
        <div className="h-0.5 -mt-6 mb-4 bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-[pulse_1s_infinite] w-full" />
        </div>
      )}

      {(loading && cycles.length === 0 && reviews.length === 0) ? (
        <div className="p-12 text-center text-slate-400">Loading performance intelligence data...</div>
      ) : (
        <>
          {/* TAB 1: HR OVERVIEW & FAIRNESS GUARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Review Cycles</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900">{cycles.length}</span>
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Reviews Managed</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900">{reviews.length}</span>
                    <Award className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Evidence Passport Quality</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-emerald-600">92.4%</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Growth OKRs</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900">{goals.length}</span>
                    <Target className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Fairness & Context Review Guard Banner */}
              <div className="p-5 rounded-2xl bg-linear-to-r from-orange-50 to-amber-50 border border-orange-200/70 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">Fairness & Context Review Guard Active</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Finovo M11 automatically inspects every review cycle to ensure assessments are supported by verifiable work evidence from M04/M05 deliverables, avoids recency bias, and prevents forced distribution curves. Assessments remain 100% transparent and explainable.
                  </p>
                </div>
              </div>

              {/* Active Cycles Overview */}
              <div className="rounded-xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Current Performance Cycles</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {cycles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">No review cycles configured yet.</div>
                  ) : (
                    cycles.map((cycle) => (
                      <div key={cycle.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{cycle.title}</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Period: {cycle.start_date} to {cycle.end_date} • {cycle.reviews_count ?? 0} Employees Assigned
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {cycle.status}
                          </span>
                          <button
                            onClick={() => setActiveTab('reviews')}
                            className="text-xs font-semibold text-[#F95716] hover:underline"
                          >
                            View Reviews &rarr;
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REVIEWS & EVIDENCE PASSPORT */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Performance Reviews & Evidence Passports</h3>
                <span className="text-xs text-slate-400">{reviews.length} total reviews in cycle</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{rev.employee.membership.user.name}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-600">
                            {rev.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Manager: {rev.reviewer?.membership.user.name || 'Unassigned'} • Quality Score: {rev.quality_score}%
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {rev.final_rating && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Final Rating</span>
                            <div className="text-sm font-bold text-slate-900">{rev.final_rating} / 5.0</div>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReview(rev);
                            setShowEvidenceModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-[#F95716] border border-orange-200 hover:bg-orange-100/70 transition"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Attach Evidence ({rev.evidence_links?.length || 0})
                        </button>
                      </div>
                    </div>

                    {/* Quality Flags */}
                    {rev.quality_flags && rev.quality_flags.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                        {rev.quality_flags.map((flag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-50 text-slate-600 border border-slate-200/60"
                          >
                            <Sparkles className="w-3 h-3 text-orange-500" />
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: GOALS & OKRS */}
          {activeTab === 'goals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Objectives & Key Results (OKRs)</h3>
                  <p className="text-xs text-slate-400">Calculated progress based on measurement formula (numeric, milestone, percentage)</p>
                </div>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Goal
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{g.title}</h4>
                        <span className="text-[10px] text-slate-400">{g.employee.membership.user.name}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-50 text-blue-700">
                        {g.measurement_type}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Progress</span>
                        <span>{g.calculated_progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#F95716] h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, g.calculated_progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SKILL-GAP ENGINE */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Dynamic Skill-Gap & Career Path Engine</h3>
                    <p className="text-xs text-slate-400">Compares assessed competencies against target role frameworks</p>
                  </div>
                  {frameworks.length > 0 && (
                    <select
                      value={selectedFrameworkId || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedFrameworkId(id);
                        handleEvaluateSkills(id);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                      {frameworks.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.role_target})</option>
                      ))}
                    </select>
                  )}
                </div>

                {skillGapAnalysis.length > 0 ? (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    {skillGapAnalysis.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{item.competency_name}</span>
                          <span className="text-xs font-semibold text-slate-600">
                            Current Level: {item.current_level} / Target: {item.target_level} (Gap: {item.gap})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">{item.observable_criteria}</p>
                        <div className="pt-2 flex flex-wrap gap-2">
                          {item.recommended_actions?.map((act: string, aIdx: number) => (
                            <span key={aIdx} className="px-2.5 py-1 text-[10px] font-semibold rounded bg-white text-orange-700 border border-orange-200">
                              {act}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Select a framework above to run real-time skill-gap analysis.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DEVELOPMENT PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Career Development Plans & Mentorship</h3>
                <span className="text-xs text-slate-400">{plans.length} active plans</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{p.title}</h4>
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-50 text-emerald-700">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{p.learning_action}</p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Owner: {p.employee.membership.user.name}</span>
                      <span>Mentor: {p.mentor?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: FEEDBACK & RECOGNITION */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Structured Feedback & Recognition Badges</h3>
                  <p className="text-xs text-slate-400">Positive reinforcement and peer observations tied to work context</p>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Give Recognition
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {feedbacks.map((f) => (
                  <div key={f.id} className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        {f.badge}
                      </span>
                      <span className="text-[10px] text-slate-400">{f.visibility}</span>
                    </div>
                    <p className="text-xs text-slate-700 italic">"{f.content}"</p>
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                      <span>For: {f.employee.membership.user.name}</span>
                      <span>From: {f.author.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: ONBOARDING & CHECKLISTS */}
          {activeTab === 'onboarding' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Onboarding & Offboarding Checklists</h3>
                <span className="text-xs text-slate-400">{checklists.length} checklists active</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {checklists.map((chk) => (
                  <div key={chk.id} className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{chk.template_name}</h4>
                        <span className="text-[11px] text-slate-400">Employee: {chk.employee.membership.user.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">{chk.progress_percent}% Complete</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {chk.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleChecklist(chk.id, item.id, item.completed)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {}}
                            className="rounded text-[#F95716] focus:ring-[#F95716]"
                          />
                          <span className={`text-xs ${item.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: ATTACH EVIDENCE */}
      {showEvidenceModal && selectedReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Attach Performance Passport Evidence</h3>
            <p className="text-xs text-slate-500">
              Link authorized work deliverables (M05 tasks, milestones, verified training) to support this review.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                >
                  <option value="task">M05 Task Deliverable</option>
                  <option value="project">M04 Project Milestone</option>
                  <option value="training">Verified Training Course</option>
                  <option value="feedback">Documented Feedback</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. PRJ-M09 Multi-Tenant Security Gate"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Description / Context</label>
                <textarea
                  placeholder="Describe verifiable outcomes..."
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 h-20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkEvidence}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600"
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GOAL */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create Objective / Key Result</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Increase Code Coverage to 90%"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Measurement Type</label>
                <select
                  value={goalMeasurement}
                  onChange={(e) => setGoalMeasurement(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                >
                  <option value="percentage">Percentage (0 - 100%)</option>
                  <option value="numeric">Numeric Metric</option>
                  <option value="milestone">Milestone Checkpoints</option>
                  <option value="qualitative">Qualitative Objective</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGoal}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GIVE RECOGNITION */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Give Recognition</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Badge</label>
                <select
                  value={feedbackBadge}
                  onChange={(e) => setFeedbackBadge(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                >
                  <option value="Architectural Innovator">Architectural Innovator</option>
                  <option value="Star Contributor">Star Contributor</option>
                  <option value="Team Player">Team Player</option>
                  <option value="Customer Champion">Customer Champion</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Feedback Note</label>
                <textarea
                  placeholder="Share observable achievements..."
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleGiveFeedback}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600"
              >
                Award Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

// Simple LayoutDashboardIcon for tab
const LayoutDashboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

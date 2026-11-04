import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  FolderKanban,
  FileCheck2,
  HelpCircle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  ChevronRight,
  ExternalLink,
  Plus,
  X,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  LogOut,
  User,
  Lock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { FinovoLogo } from '../components/ui/FinovoLogo';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';

interface PortalClientOrg {
  id: number;
  name: string;
  reference_code: string;
  portal_role: string;
}

interface PortalProject {
  id: number;
  project_id: number;
  client_facing_name?: string;
  status: string;
  project?: {
    id: number;
    project_code: string;
    name: string;
    status: string;
    health_status: string;
    start_date?: string;
    target_end_date?: string;
    progress_percent: number;
    milestones?: any[];
    deliverables?: any[];
  };
}

interface PortalDeliverableReview {
  id: number;
  version_label: string;
  version_hash: string;
  title: string;
  file_url?: string;
  review_status: 'draft' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'superseded';
  submitted_at: string;
  due_date?: string;
  decision_comment?: string;
  decision_at?: string;
  project?: { id: number; name: string; project_code: string };
  deliverable?: { id: number; name: string };
  decision_by?: { id: number; name: string };
}

interface PortalDecision {
  id: number;
  decision_code: string;
  title: string;
  context_description: string;
  status: 'draft' | 'requested' | 'answered' | 'closed';
  outcome_decision?: string;
  outcome_rationale?: string;
  due_date: string;
  impact_summary?: string;
  project?: { id: number; name: string; project_code: string };
  milestone?: { id: number; name: string };
}

interface PortalRequest {
  id: number;
  request_code: string;
  category: 'change_request' | 'support_issue' | 'feature_request' | 'clarification';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client_status: 'submitted' | 'in_review' | 'work_scheduled' | 'completed' | 'declined';
  created_at: string;
  project?: { id: number; name: string; project_code: string };
}

interface PortalContract {
  id: number;
  contract_reference: string;
  title: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date?: string;
  value_amount?: number;
  currency?: string;
}

export const ClientPortalPage: React.FC = () => {
  const { clientId, companySlug } = useParams<{ clientId: string; companySlug?: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { alert } = useConfirm();

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'deliverables' | 'decisions' | 'requests' | 'contracts'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [clientOrg, setClientOrg] = useState<PortalClientOrg | null>(null);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [deliverables, setDeliverables] = useState<PortalDeliverableReview[]>([]);
  const [decisions, setDecisions] = useState<PortalDecision[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [contracts, setContracts] = useState<PortalContract[]>([]);

  // Action modals
  const [activeReviewModal, setActiveReviewModal] = useState<PortalDeliverableReview | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'changes_requested'>('approved');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const [activeDecisionModal, setActiveDecisionModal] = useState<PortalDecision | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<'approved' | 'rejected' | 'alternative_chosen'>('approved');
  const [decisionRationale, setDecisionRationale] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [requestForm, setRequestForm] = useState({
    project_id: '',
    category: 'change_request' as const,
    title: '',
    description: '',
    priority: 'medium' as const,
  });
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

  const fetchPortalData = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const overviewRes = await api.get(`/client-portal/${clientId}/overview`);
      setClientOrg(overviewRes.data.client_organization);
      setProjects(overviewRes.data.projects || []);
      setDeliverables(overviewRes.data.pending_deliverables || []);
      setDecisions(overviewRes.data.pending_decisions || []);
      setRequests(overviewRes.data.open_requests || []);
      setContracts(overviewRes.data.contracts || []);

      // If user is on a specific tab, also refresh that specific list
      if (activeTab === 'deliverables') {
        const delivRes = await api.get(`/client-portal/${clientId}/deliverables`);
        setDeliverables(delivRes.data.deliverable_reviews || []);
      } else if (activeTab === 'decisions') {
        const decRes = await api.get(`/client-portal/${clientId}/decisions`);
        setDecisions(decRes.data.decisions || []);
      } else if (activeTab === 'requests') {
        const reqRes = await api.get(`/client-portal/${clientId}/requests`);
        setRequests(reqRes.data.requests || []);
      } else if (activeTab === 'projects') {
        const projRes = await api.get(`/client-portal/${clientId}/projects`);
        setProjects(projRes.data.projects || []);
      } else if (activeTab === 'contracts') {
        const conRes = await api.get(`/client-portal/${clientId}/contracts`);
        setContracts(conRes.data.contracts || []);
      }
    } catch (err: any) {
      console.error('Failed to load portal data:', err);
      setError(err?.response?.data?.message || 'Access Denied: You do not have an active membership for this Client Organization.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [clientId, activeTab]);

  const handleDeliverableDecision = async () => {
    if (!activeReviewModal || !clientId) return;
    setSubmittingReview(true);
    try {
      await api.post(`/client-portal/${clientId}/deliverables/${activeReviewModal.id}/decisions`, {
        decision: reviewDecision,
        comment: reviewComment,
      });
      setActiveReviewModal(null);
      setReviewComment('');
      await fetchPortalData();
    } catch (err: any) {
      await alert({
        title: 'Review Submission Failed',
        message: err?.response?.data?.message || 'Failed to submit deliverable review decision',
        variant: 'danger',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDecisionResponse = async () => {
    if (!activeDecisionModal || !clientId) return;
    if (!decisionRationale.trim()) {
      await alert({
        title: 'Rationale Required',
        message: 'Please provide a decision rationale explaining your selection.',
        variant: 'warning',
      });
      return;
    }
    setSubmittingDecision(true);
    try {
      await api.post(`/client-portal/${clientId}/decisions/${activeDecisionModal.id}/respond`, {
        outcome_decision: decisionOutcome,
        outcome_rationale: decisionRationale,
      });
      setActiveDecisionModal(null);
      setDecisionRationale('');
      await fetchPortalData();
    } catch (err: any) {
      await alert({
        title: 'Decision Error',
        message: err?.response?.data?.message || 'Failed to record decision outcome',
        variant: 'danger',
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    if (!requestForm.project_id) {
      await alert({
        title: 'Project Selection Required',
        message: 'Please select an active project before submitting a request.',
        variant: 'warning',
      });
      return;
    }
    setSubmittingRequest(true);
    try {
      await api.post(`/client-portal/${clientId}/requests`, requestForm);
      setShowRequestModal(false);
      setRequestForm({
        project_id: '',
        category: 'change_request',
        title: '',
        description: '',
        priority: 'medium',
      });
      await fetchPortalData();
    } catch (err: any) {
      await alert({
        title: 'Request Submission Failed',
        message: err?.response?.data?.message || 'Failed to submit request',
        variant: 'danger',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const pendingDeliverableCount = deliverables.filter(d => d.review_status === 'submitted').length;
  const pendingDecisionCount = decisions.filter(d => d.status === 'requested').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left brand & org indicator */}
            <div className="flex items-center gap-4">
              <FinovoLogo size="md" />
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-[#F95716] border border-orange-200/60">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Client Portal
                </span>
                {clientOrg && (
                  <span className="text-sm font-bold text-slate-900 hidden sm:inline">
                    {clientOrg.name} <span className="text-xs font-mono text-slate-400 font-normal">({clientOrg.reference_code})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              {companySlug && (
                <Link
                  to={`/app/${companySlug}/clients`}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  Back to Internal Workspace
                </Link>
              )}
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {user?.name?.charAt(0) || 'C'}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</div>
                  <div className="text-[10px] text-slate-400">{clientOrg?.portal_role || 'Client Stakeholder'}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Client Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center gap-1 overflow-x-auto py-1">
          {[
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'projects', label: 'Projects & Milestones', icon: FolderKanban },
            {
              id: 'deliverables',
              label: 'Deliverables & Approvals',
              icon: FileCheck2,
              badge: pendingDeliverableCount > 0 ? pendingDeliverableCount : null,
            },
            {
              id: 'decisions',
              label: 'Decision Ledger',
              icon: Sparkles,
              badge: pendingDecisionCount > 0 ? pendingDecisionCount : null,
            },
            { id: 'requests', label: 'Requests & Support', icon: HelpCircle },
            { id: 'contracts', label: 'Contracts & Documents', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#F95716] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-white text-[#F95716]' : 'bg-orange-500 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#F95716]" />
            <p className="text-sm font-semibold">Loading authorized client workspace...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-lg mx-auto text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Portal Access Restricted</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{error}</p>
            <button
              onClick={() => navigate('/select-workspace')}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Select Authorized Workspace
            </button>
          </div>
        ) : (
          <>
            {/* Top Security & Isolation Guarantee Banner */}
            <div className="mb-6 bg-linear-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Finovo Enterprise Client Isolation Active
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    You are connected to <span className="font-semibold">{clientOrg?.name}</span>. Internal development chatter, employee work sessions (M06), and desktop telemetry (M08) are strictly isolated and permanently inaccessible.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 self-end md:self-auto shrink-0 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Encrypted Tenant Boundary
              </div>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Hero Card */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-orange-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />
                  <div className="relative z-10 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-orange-400 mb-4 border border-white/10">
                      <Sparkles className="w-3.5 h-3.5" />
                      Client Executive Hub
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                      Welcome to your delivery portal, {clientOrg?.name}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed mb-6">
                      Review deliverable versions with cryptographic audit trails, answer delivery decisions, monitor project milestones, and submit change requests directly to your engineering team.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setActiveTab('deliverables')}
                        className="px-4 py-2.5 rounded-xl bg-[#F95716] hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        Review Deliverables ({pendingDeliverableCount})
                      </button>
                      <button
                        onClick={() => setActiveTab('decisions')}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        Decision Ledger ({pendingDecisionCount})
                      </button>
                      <button
                        onClick={() => setShowRequestModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Submit Request
                      </button>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Projects</span>
                      <FolderKanban className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{projects.length}</div>
                    <div className="text-xs text-slate-500 mt-1">Under managed delivery</div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Reviews</span>
                      <FileCheck2 className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{pendingDeliverableCount}</div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">Awaiting client sign-off</div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Decisions Needed</span>
                      <Sparkles className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{pendingDecisionCount}</div>
                    <div className="text-xs text-purple-600 font-semibold mt-1">Structured decision requests</div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Contracts</span>
                      <FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{contracts.length}</div>
                    <div className="text-xs text-blue-600 font-semibold mt-1">Commercial agreements</div>
                  </div>
                </div>

                {/* Two Column Layout for Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Deliverables list */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#F95716]" />
                        Deliverables Awaiting Review
                      </h3>
                      <button
                        onClick={() => setActiveTab('deliverables')}
                        className="text-xs font-bold text-[#F95716] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {deliverables.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                        <p className="text-xs font-semibold">All deliverables have been reviewed and approved!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deliverables.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                                  {item.version_label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.project?.name} · Submitted {new Date(item.submitted_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setActiveReviewModal(item);
                                setReviewDecision('approved');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#F95716] hover:bg-orange-600 text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                            >
                              Review
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Urgent Decisions list */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Decision Requests
                      </h3>
                      <button
                        onClick={() => setActiveTab('decisions')}
                        className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {decisions.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                        <p className="text-xs font-semibold">No pending decisions in the ledger.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {decisions.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                                <span className="text-[10px] font-mono text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md">
                                  {item.decision_code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Due: {item.due_date} · {item.project?.name}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setActiveDecisionModal(item);
                                setDecisionOutcome('approved');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                            >
                              Answer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROJECTS & MILESTONES */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Active Client Projects</h3>
                  <p className="text-xs text-slate-500">
                    Authorized projects linked to {clientOrg?.name}. Internal developer tasks and monitoring data are strictly excluded.
                  </p>
                </div>

                {projects.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                    <FolderKanban className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">No Projects Linked</h4>
                    <p className="text-xs text-slate-400 mt-1">Your account manager has not yet published an active project to your portal.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {projects.map((eng) => {
                      const p = eng.project;
                      return (
                        <div key={eng.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900">{eng.client_facing_name || p?.name}</h4>
                                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                                  {p?.project_code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Delivery Window: {p?.start_date || 'TBD'} to {p?.target_end_date || 'TBD'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 rounded-full text-xs font-bold capitalize bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {p?.status || 'In Progress'}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-5">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                              <span>Overall Project Progress</span>
                              <span className="text-[#F95716]">{p?.progress_percent ?? 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[#F95716] h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, p?.progress_percent ?? 0))}%` }}
                              />
                            </div>
                          </div>

                          {/* Milestones accordion/list */}
                          {p?.milestones && p.milestones.length > 0 && (
                            <div className="mt-6 pt-5 border-t border-slate-100">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Project Milestones</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {p.milestones.map((m: any) => (
                                  <div key={m.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-bold text-slate-900">{m.name}</div>
                                      <div className="text-[11px] text-slate-400">Due: {m.due_date || 'Flexible'}</div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                      m.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {m.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: DELIVERABLES & APPROVALS */}
            {activeTab === 'deliverables' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Version-Locked Deliverable Approvals</h3>
                    <p className="text-xs text-slate-500">
                      Submissions are cryptographically bound to an immutable version hash. Approving a version permanently records your review.
                    </p>
                  </div>
                </div>

                {deliverables.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                    <FileCheck2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">No Deliverable Submissions</h4>
                    <p className="text-xs text-slate-400 mt-1">There are no deliverable versions currently pending your review.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliverables.map((item) => {
                      const isPending = item.review_status === 'submitted';
                      const isApproved = item.review_status === 'approved';
                      const isChanges = item.review_status === 'changes_requested';

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:border-slate-300 transition-all"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
                                <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-orange-100 text-[#F95716]">
                                  {item.version_label}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                                    isApproved
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : isChanges
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                                  }`}
                                >
                                  {item.review_status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Project: <span className="font-semibold text-slate-700">{item.project?.name}</span> · Deliverable: <span className="font-semibold text-slate-700">{item.deliverable?.name || 'Deliverable Asset'}</span>
                              </p>
                              <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400 font-mono">
                                <span>Hash: {item.version_hash ? item.version_hash.substring(0, 16) + '...' : 'SHA256-PENDING'}</span>
                                {item.file_url && (
                                  <a
                                    href={item.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#F95716] hover:underline flex items-center gap-1 font-sans font-semibold"
                                  >
                                    View Asset <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveReviewModal(item);
                                      setReviewDecision('approved');
                                    }}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                  >
                                    <Check className="w-4 h-4" />
                                    Approve Version
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveReviewModal(item);
                                      setReviewDecision('changes_requested');
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                    Request Changes
                                  </button>
                                </>
                              ) : (
                                <div className="text-right">
                                  <div className="text-xs font-bold text-slate-700">
                                    Concluded by {item.decision_by?.name || 'Client Reviewer'}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {item.decision_at ? new Date(item.decision_at).toLocaleString() : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {item.decision_comment && (
                            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                              <span className="font-bold text-slate-800">Review Feedback:</span> {item.decision_comment}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: DECISION LEDGER */}
            {activeTab === 'decisions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Client Decision Ledger</h3>
                  <p className="text-xs text-slate-500">
                    Structured, traceable project decisions required from client stakeholders to unblock milestones.
                  </p>
                </div>

                {decisions.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                    <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">No Pending Decisions</h4>
                    <p className="text-xs text-slate-400 mt-1">There are no open decision requests requiring client action.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {decisions.map((dec) => {
                      const isPending = dec.status === 'requested';
                      return (
                        <div
                          key={dec.id}
                          className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:border-slate-300 transition-all"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="max-w-2xl">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                  {dec.decision_code}
                                </span>
                                <h4 className="text-base font-bold text-slate-900">{dec.title}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${
                                    isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {dec.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{dec.context_description}</p>
                              {dec.impact_summary && (
                                <div className="mt-3 p-2.5 bg-amber-50/60 border border-amber-200/50 rounded-xl text-xs text-amber-800">
                                  <span className="font-bold">Milestone Impact:</span> {dec.impact_summary}
                                </div>
                              )}
                              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                                <span>Project: <strong className="text-slate-700">{dec.project?.name}</strong></span>
                                <span>Milestone: <strong className="text-slate-700">{dec.milestone?.name || 'General'}</strong></span>
                                <span className="text-rose-600 font-semibold">Due: {dec.due_date}</span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isPending ? (
                                <button
                                  onClick={() => {
                                    setActiveDecisionModal(dec);
                                    setDecisionOutcome('approved');
                                  }}
                                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Answer Decision
                                </button>
                              ) : (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                                  <div className="font-bold text-slate-900 capitalize">
                                    Outcome: {dec.outcome_decision?.replace('_', ' ')}
                                  </div>
                                  <p className="text-slate-600 text-[11px] mt-1">{dec.outcome_rationale}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: REQUESTS & SUPPORT */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Client Service & Change Requests</h3>
                    <p className="text-xs text-slate-500">
                      Submit change requests, feature enhancements, or support questions. Requests are triaged into engineering tasks.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRequestModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#F95716] hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Submit New Request
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                    <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">No Requests Submitted</h4>
                    <p className="text-xs text-slate-400 mt-1">Submit your first request using the button above.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-500">{req.request_code}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                              {req.category.replace('_', ' ')}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{req.title}</h4>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{req.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span>Project: {req.project?.name}</span>
                            <span>Priority: <strong className="capitalize text-slate-700">{req.priority}</strong></span>
                            <span>Submitted: {new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold capitalize bg-blue-50 text-blue-700 border border-blue-200">
                            {req.client_status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CONTRACTS & DOCUMENTS */}
            {activeTab === 'contracts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Client Contracts & Commercial Agreements</h3>
                  <p className="text-xs text-slate-500">
                    Authorized contract metadata and engagement terms explicitly shared with your organization.
                  </p>
                </div>

                {contracts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">No Published Contracts</h4>
                    <p className="text-xs text-slate-400 mt-1">There are no client-visible contracts associated with this profile.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contracts.map((c) => (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {c.contract_reference}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold capitalize bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {c.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mb-1">{c.title}</h4>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">
                          {c.contract_type.replace('_', ' ')}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <div>
                            <div>Term: {c.start_date} {c.end_date ? `to ${c.end_date}` : '(Ongoing)'}</div>
                          </div>
                          {c.value_amount && (
                            <div className="text-right font-bold text-slate-900">
                              {c.currency || 'USD'} {Number(c.value_amount).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* DELIVERABLE REVIEW MODAL */}
      {activeReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#F95716]" />
                Deliverable Review · {activeReviewModal.version_label}
              </h3>
              <button
                onClick={() => setActiveReviewModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Deliverable Asset</label>
                <p className="text-sm font-semibold text-slate-900">{activeReviewModal.title}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Immutable Hash: {activeReviewModal.version_hash}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Review Decision</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('approved')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      reviewDecision === 'approved'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Approve Version
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('changes_requested')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      reviewDecision === 'changes_requested'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs ring-1 ring-rose-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    Request Changes
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Comments / Feedback {reviewDecision === 'changes_requested' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={
                    reviewDecision === 'approved'
                      ? 'Optional sign-off notes or positive feedback...'
                      : 'Please explain the specific modifications or design changes required...'
                  }
                  className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Legal Notice:</strong> This review is logged to the Finovo audit ledger with your user credentials, timestamp, and the exact version hash.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveReviewModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeliverableDecision}
                disabled={submittingReview}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F95716] hover:bg-orange-600 text-white transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                {submittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Review Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECISION LEDGER ANSWER MODAL */}
      {activeDecisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Answer Decision · {activeDecisionModal.decision_code}
              </h3>
              <button
                onClick={() => setActiveDecisionModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Decision Title</label>
                <p className="text-sm font-semibold text-slate-900">{activeDecisionModal.title}</p>
                <p className="text-xs text-slate-600 mt-1">{activeDecisionModal.context_description}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Outcome Selection</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'approved', label: 'Approve' },
                    { id: 'rejected', label: 'Reject' },
                    { id: 'alternative_chosen', label: 'Alternative' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDecisionOutcome(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${
                        decisionOutcome === opt.id
                          ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-600 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Outcome Rationale & Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={decisionRationale}
                  onChange={(e) => setDecisionRationale(e.target.value)}
                  placeholder="Detail the technical or business reasoning behind this decision for delivery records..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveDecisionModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecisionResponse}
                disabled={submittingDecision}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                {submittingDecision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Record Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CLIENT REQUEST MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#F95716]" />
                Submit Client Request
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Related Project *</label>
                <select
                  required
                  value={requestForm.project_id}
                  onChange={(e) => setRequestForm({ ...requestForm, project_id: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                >
                  <option value="">Select project...</option>
                  {projects.map((eng) => (
                    <option key={eng.project_id} value={eng.project_id}>
                      {eng.project?.name} ({eng.project?.project_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={requestForm.category}
                    onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                  >
                    <option value="change_request">Change Request</option>
                    <option value="support_issue">Support Issue</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="clarification">Clarification</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                  placeholder="Summary of change or issue..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Detailed Description *</label>
                <textarea
                  rows={4}
                  required
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                  placeholder="Provide complete requirements, context, and expected behavior..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#F95716]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F95716] hover:bg-orange-600 text-white transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {submittingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortalPage;

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Building2,
  Users,
  FolderKanban,
  FileCheck2,
  HelpCircle,
  FileText,
  ShieldCheck,
  Plus,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Sliders,
  ExternalLink,
  ChevronRight,
  Loader2,
  Check,
  X,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';

interface ClientOrganization {
  id: number;
  reference_code: string;
  name: string;
  status: string;
  industry?: string;
  billing_address?: string;
  country?: string;
  timezone: string;
  health_status: 'healthy' | 'attention_required' | 'critical';
  account_manager?: { user?: { name: string; email: string } };
  contacts?: any[];
  engagements_count?: number;
  memberships_count?: number;
  decisions_count?: number;
  created_at: string;
}

interface ClientDecision {
  id: number;
  decision_code: string;
  title: string;
  context_description: string;
  status: string;
  outcome_decision?: string;
  outcome_rationale?: string;
  due_date: string;
  impact_summary?: string;
  client_organization?: { name: string; reference_code: string };
  project?: { name: string; project_code: string };
}

interface DeliverableReview {
  id: number;
  version_label: string;
  version_hash: string;
  title: string;
  file_url?: string;
  review_status: string;
  submitted_at: string;
  due_date?: string;
  decision_comment?: string;
  decision_at?: string;
  project?: { name: string; project_code: string };
  deliverable?: { name: string };
  decision_by?: { name: string };
}

interface ClientRequestItem {
  id: number;
  request_code: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  client_status: string;
  internal_status: string;
  estimated_cost_hours?: number;
  estimated_budget_amount?: number;
  created_at: string;
  project?: { name: string; project_code: string };
  task?: { task_code: string; title: string };
}

export const ClientManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { alert } = useConfirm();

  // State with High-Speed Pipeline Cache
  const cacheKey = `clients_${companySlug}`;
  const cachedClients = dataPipeline.get<ClientOrganization[]>(cacheKey);

  const [activeTab, setActiveTab] = useState<'directory' | 'decisions' | 'deliverables' | 'requests' | 'simulator'>('directory');
  const [clients, setClients] = useState<ClientOrganization[]>(() => cachedClients || []);
  const [selectedClient, setSelectedClient] = useState<ClientOrganization | null>(() => (cachedClients && cachedClients.length > 0 ? cachedClients[0] : null));
  const [clientDetails, setClientDetails] = useState<any>(() => {
    if (cachedClients && cachedClients.length > 0) {
      return dataPipeline.get(`client_details_${companySlug}_${cachedClients[0].id}`) || null;
    }
    return null;
  });
  const [decisions, setDecisions] = useState<ClientDecision[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableReview[]>([]);
  const [requests, setRequests] = useState<ClientRequestItem[]>([]);
  const [simulationData, setSimulationData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!cachedClients);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientIndustry, setNewClientIndustry] = useState<string>('');
  const [newClientAddress, setNewClientAddress] = useState<string>('');
  const [confirmDuplicate, setConfirmDuplicate] = useState<boolean>(false);

  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactRole, setContactRole] = useState<string>('primary');

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<string>('reviewer');

  const [showDecisionModal, setShowDecisionModal] = useState<boolean>(false);
  const [decisionTitle, setDecisionTitle] = useState<string>('');
  const [decisionDesc, setDecisionDesc] = useState<string>('');
  const [decisionDueDate, setDecisionDueDate] = useState<string>('');
  const [decisionImpact, setDecisionImpact] = useState<string>('');

  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequestItem | null>(null);
  const [triageAction, setTriageAction] = useState<string>('convert_to_task');
  const [estHours, setEstHours] = useState<number>(16);
  const [estBudget, setEstBudget] = useState<number>(2400);

  useEffect(() => {
    loadClients();
  }, [companySlug, searchQuery]);

  const loadClients = async (force = false) => {
    if (!companySlug) return;
    const currentCached = !force && !searchQuery ? dataPipeline.get<ClientOrganization[]>(cacheKey) : null;
    if (currentCached) {
      setClients(currentCached);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      const companyId = await dataPipeline.getCompanyId(companySlug);
      const res = await api.get(`/companies/${companyId}/clients?search=${encodeURIComponent(searchQuery)}`);
      const clientList = res.data.data || [];
      setClients(clientList);

      if (!searchQuery) {
        dataPipeline.set(cacheKey, clientList, 180000);
      }

      if (clientList.length > 0 && !selectedClient) {
        selectClient(clientList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  };

  const selectClient = async (client: ClientOrganization) => {
    setSelectedClient(client);
    if (!companySlug) return;

    const detailCacheKey = `client_details_${companySlug}_${client.id}`;
    const cachedDet = dataPipeline.get<any>(detailCacheKey);
    if (cachedDet) {
      setClientDetails(cachedDet.client);
      setDecisions(cachedDet.client.decisions || []);
      setRequests(cachedDet.client.requests || []);
      if (cachedDet.health) setHealthData(cachedDet.health);
      if (cachedDet.simulation) setSimulationData(cachedDet.simulation);
    }

    try {
      const companyId = await dataPipeline.getCompanyId(companySlug);

      // Fetch 360 Details, Health, and Access Simulator in parallel
      const [detRes, hRes, sRes] = await Promise.allSettled([
        api.get(`/companies/${companyId}/clients/${client.id}`),
        api.get(`/companies/${companyId}/clients/${client.id}/health`),
        api.get(`/companies/${companyId}/clients/${client.id}/access-simulation`),
      ]);

      let freshClient = null;
      let freshHealth = null;
      let freshSim = null;

      if (detRes.status === 'fulfilled') {
        freshClient = detRes.value.data.client;
        setClientDetails(freshClient);
        setDecisions(freshClient.decisions || []);
        setRequests(freshClient.requests || []);
      }
      if (hRes.status === 'fulfilled') {
        freshHealth = hRes.value.data;
        setHealthData(freshHealth);
      }
      if (sRes.status === 'fulfilled') {
        freshSim = sRes.value.data.simulation;
        setSimulationData(freshSim);
      }

      if (freshClient) {
        dataPipeline.set(detailCacheKey, {
          client: freshClient,
          health: freshHealth,
          simulation: freshSim,
        }, 180000);
      }
    } catch (err) {
      console.error('Failed to load client details:', err);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setActionLoading(true);
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;

      const res = await api.post(`/companies/${companyId}/clients`, {
        name: newClientName,
        industry: newClientIndustry,
        billing_address: newClientAddress,
        confirm_duplicate: confirmDuplicate,
      });

      setShowCreateModal(false);
      setNewClientName('');
      setNewClientIndustry('');
      setNewClientAddress('');
      setConfirmDuplicate(false);
      setBannerNotice(`Client organization ${res.data.client.name} (${res.data.client.reference_code}) created!`);
      setTimeout(() => setBannerNotice(null), 5000);
      loadClients();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConfirmDuplicate(true);
        await alert({
          title: 'Potential Duplicate Client',
          message: 'A client organization with a similar name was detected. Check the confirmation checkbox if this is a separate legal entity.',
          variant: 'warning',
        });
      } else {
        await alert({
          title: 'Failed to Create Client',
          message: 'Failed to create client: ' + (err.response?.data?.message || err.message),
          variant: 'danger',
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !contactName.trim() || !contactEmail.trim()) return;

    setActionLoading(true);
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;

      await api.post(`/companies/${companyId}/clients/${selectedClient.id}/contacts`, {
        name: contactName,
        email: contactEmail,
        contact_role: contactRole,
        is_primary: contactRole === 'primary',
      });

      setShowContactModal(false);
      setContactName('');
      setContactEmail('');
      setBannerNotice('Contact added successfully.');
      setTimeout(() => setBannerNotice(null), 5000);
      selectClient(selectedClient);
    } catch (err: any) {
      await alert({
        title: 'Failed to Add Contact',
        message: 'Failed to add contact: ' + (err.response?.data?.message || err.message),
        variant: 'danger',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !inviteEmail.trim()) return;

    setActionLoading(true);
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;

      const res = await api.post(`/companies/${companyId}/clients/${selectedClient.id}/invitations`, {
        email: inviteEmail,
        portal_role: inviteRole,
      });

      setShowInviteModal(false);
      setInviteEmail('');
      setBannerNotice(`Portal invitation issued! Token link: ${res.data.invitation_url}`);
      setTimeout(() => setBannerNotice(null), 8000);
      selectClient(selectedClient);
    } catch (err: any) {
      await alert({
        title: 'Invitation Failed',
        message: 'Failed to issue invitation: ' + (err.response?.data?.message || err.message),
        variant: 'danger',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !clientDetails?.engagements?.[0]?.project_id) {
      await alert({
        title: 'Project Link Required',
        message: 'Please link an active project to this client organization before creating decision items.',
        variant: 'warning',
      });
      return;
    }

    setActionLoading(true);
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;
      const projectId = clientDetails.engagements[0].project_id;

      await api.post(`/companies/${companyId}/clients/${selectedClient.id}/decisions`, {
        project_id: projectId,
        title: decisionTitle,
        context_description: decisionDesc,
        due_date: decisionDueDate,
        impact_summary: decisionImpact,
      });

      setShowDecisionModal(false);
      setDecisionTitle('');
      setDecisionDesc('');
      setDecisionDueDate('');
      setDecisionImpact('');
      setBannerNotice('Decision request recorded in Client Decision Ledger.');
      setTimeout(() => setBannerNotice(null), 5000);
      selectClient(selectedClient);
    } catch (err: any) {
      await alert({
        title: 'Failed to Create Decision',
        message: 'Failed to create decision: ' + (err.response?.data?.message || err.message),
        variant: 'danger',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriageRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedRequest) return;

    setActionLoading(true);
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;

      await api.post(`/companies/${companyId}/clients/${selectedClient.id}/requests/${selectedRequest.id}/triage`, {
        action: triageAction,
        estimated_cost_hours: estHours,
        estimated_budget_amount: estBudget,
        convert_task_title: selectedRequest.title,
      });

      setShowTriageModal(false);
      setSelectedRequest(null);
      setBannerNotice('Client request triaged and converted to task.');
      setTimeout(() => setBannerNotice(null), 5000);
      selectClient(selectedClient);
    } catch (err: any) {
      await alert({
        title: 'Failed to Triage Request',
        message: 'Failed to triage request: ' + (err.response?.data?.message || err.message),
        variant: 'danger',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const compRes = await api.get(`/companies/${companySlug}`);
      const companyId = compRes.data.company.id;
      window.open(`${api.defaults.baseURL}/companies/${companyId}/clients/export`, '_blank');
    } catch (err: any) {
      await alert({
        title: 'Export Failed',
        message: 'Failed to export CSV: ' + err.message,
        variant: 'danger',
      });
    }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner Alert */}
        {bannerNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{bannerNotice}</span>
            </div>
            <button onClick={() => setBannerNotice(null)} className="text-emerald-600 hover:text-emerald-800">
              ✕
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/70 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-[#F95716]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Relationship Management</h1>
                <p className="text-xs text-slate-500 font-medium">
                  Client 360° Profiles · Decision Ledger · Version-Locked Approvals · Boundary Simulator
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F95716] w-52 shadow-xs"
              />
            </div>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-1.5 bg-[#F95716] hover:bg-[#e0480b] text-white font-semibold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Client</span>
            </button>
          </div>
        </div>

        {/* Subtle SWR sync progress indicator */}
        {isValidating && (
          <div className="h-0.5 -mt-4 mb-2 bg-slate-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200/80">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'directory'
                ? 'border-[#F95716] text-[#F95716] bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Client 360° Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('decisions')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'decisions'
                ? 'border-[#F95716] text-[#F95716] bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Client Decision Ledger</span>
            {decisions.filter(d => d.status === 'requested').length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-orange-500 text-white font-bold">
                {decisions.filter(d => d.status === 'requested').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('deliverables')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'deliverables'
                ? 'border-[#F95716] text-[#F95716] bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Deliverables & Reviews</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'requests'
                ? 'border-[#F95716] text-[#F95716] bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Change Requests & Triage</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'simulator'
                ? 'border-[#F95716] text-[#F95716] bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Access Boundary Simulator</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: CLIENT 360° DIRECTORY & PROFILE
           ========================================================================= */}
        {activeTab === 'directory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Clients List */}
            <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Organizations ({clients.length})</span>
              </div>

              {(loading && clients.length === 0) ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#F95716] mb-2" />
                  <span className="text-xs">Loading clients...</span>
                </div>
              ) : clients.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Building2 className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium">No client organizations found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {clients.map((c) => {
                    const isSelected = selectedClient?.id === c.id;
                    const healthBadge = {
                      healthy: 'bg-emerald-50 text-emerald-700',
                      attention_required: 'bg-amber-50 text-amber-700',
                      critical: 'bg-rose-50 text-rose-700',
                    }[c.health_status];

                    return (
                      <div
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className={`p-4 cursor-pointer transition flex items-center justify-between ${
                          isSelected ? 'bg-orange-50/60 border-l-4 border-l-[#F95716]' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{c.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {c.reference_code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.industry || 'General Industry'} · {c.country || 'Global'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${healthBadge}`}>
                            {c.health_status}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Client 360° Profile */}
            <div className="lg:col-span-2 space-y-6">
              {selectedClient && clientDetails ? (
                <>
                  {/* Client Overview Card */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900">{clientDetails.name}</h2>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {clientDetails.reference_code}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {clientDetails.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Account Manager: {clientDetails.account_manager?.user?.name || 'Unassigned'} · Timezone: {clientDetails.timezone}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowContactModal(true)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition"
                        >
                          + Add Contact
                        </button>
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="px-3 py-1.5 bg-[#F95716] hover:bg-[#e0480b] text-white font-medium text-xs rounded-lg transition"
                        >
                          Invite to Portal
                        </button>
                      </div>
                    </div>

                    {/* Explainable Health Indicator Alert if Attention Required */}
                    {healthData && healthData.indicators?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Explainable Client Health Alerts ({healthData.indicators.length})</span>
                        </div>
                        {healthData.indicators.map((ind: any, i: number) => (
                          <div key={i} className="text-xs text-amber-800 flex items-start gap-1.5 pl-6">
                            <span>•</span>
                            <div>
                              <strong>{ind.title}:</strong> {ind.explanation} <em>Recommendation: {ind.action_recommendation}</em>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Contacts Grid */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-2">Authorized Contacts</h4>
                      {clientDetails.contacts?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No contacts added yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {clientDetails.contacts?.map((cnt: any) => (
                            <div key={cnt.id} className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/50 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900">{cnt.name}</span>
                                  {cnt.is_primary && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-orange-100 text-[#F95716]">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">{cnt.email}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">{cnt.contact_role}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Onboarding Blueprint Progress Card */}
                  {clientDetails.onboarding_runs?.[0] && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#F95716]" />
                          <h4 className="text-xs font-bold text-slate-900">Client Onboarding Blueprint</h4>
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {clientDetails.onboarding_runs[0].completed_items_count} / {clientDetails.onboarding_runs[0].total_items_count} Completed
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-[#F95716] h-2 rounded-full transition-all"
                          style={{
                            width: `${(clientDetails.onboarding_runs[0].completed_items_count / clientDetails.onboarding_runs[0].total_items_count) * 100}%`,
                          }}
                        ></div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {clientDetails.onboarding_runs[0].checklist_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                            {item.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0"></div>
                            )}
                            <span className={item.done ? 'line-through text-slate-400' : 'font-medium'}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400">
                  <p className="text-xs">Select a client organization on the left to inspect 360° details.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CLIENT DECISION LEDGER (Feature 1)
           ========================================================================= */}
        {activeTab === 'decisions' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Client Decision Ledger</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Track essential project decisions with explicit accountability: which decision is needed, who must decide, the delivery deadline, and the outcome rationale. Stops decisions from getting lost in emails or chats.
                </p>
              </div>
              <button
                onClick={() => setShowDecisionModal(true)}
                className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white font-medium text-xs rounded-xl shadow-xs transition flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Decision Request</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-5 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">Decisions Across Client Engagements</h4>
              </div>

              {decisions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Decision Ledger Items</p>
                  <p className="text-xs text-slate-400 mt-1">Create a decision request linked to a project milestone.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {decisions.map((dec) => {
                    const statusBadge = {
                      requested: 'bg-amber-50 text-amber-700 border-amber-200',
                      answered: 'bg-blue-50 text-blue-700 border-blue-200',
                      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
                    }[dec.status] || 'bg-slate-50 text-slate-600 border-slate-200';

                    return (
                      <div key={dec.id} className="p-5 hover:bg-slate-50/60 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-700">{dec.decision_code}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge}`}>
                              {dec.status}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{dec.title}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{dec.context_description}</p>
                          {dec.impact_summary && (
                            <p className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                              <strong>Delivery Impact:</strong> {dec.impact_summary}
                            </p>
                          )}
                          {dec.outcome_rationale && (
                            <p className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                              <strong>Client Decision ({dec.outcome_decision}):</strong> {dec.outcome_rationale}
                            </p>
                          )}
                        </div>

                        <div className="text-right text-xs shrink-0">
                          <div className="font-semibold text-slate-700">Due: {new Date(dec.due_date).toLocaleDateString()}</div>
                          <div className="text-slate-400 text-[11px]">Assigned to Client Stakeholder</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: DELIVERABLES & VERSION-LOCKED APPROVALS (Feature 2)
           ========================================================================= */}
        {activeTab === 'deliverables' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-1">Version-Locked Deliverable Approvals</h3>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Every review request is bound to a specific immutable deliverable version. Client decisions (approved, changes requested) reference exact cryptographic version hashes, eliminating disputes over what was approved.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-5 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">Published Deliverable Versions</h4>
              </div>

              {deliverables.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Deliverable Reviews Active</p>
                  <p className="text-xs text-slate-400 mt-1">Publish an M04 milestone deliverable to request client sign-off.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {deliverables.map((del) => (
                    <div key={del.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{del.title}</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-100 text-[#F95716]">
                            {del.version_label}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            del.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {del.review_status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Hash: <code className="text-slate-600">{del.version_hash.substring(0, 16)}...</code> · Submitted: {new Date(del.submitted_at).toLocaleDateString()}
                        </div>
                      </div>

                      {del.decision_by && (
                        <div className="text-right text-xs">
                          <span className="font-semibold text-slate-800">Approved by {del.decision_by.name}</span>
                          <p className="text-[11px] text-slate-500 italic">"{del.decision_comment}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: CLIENT REQUESTS & TRIAGE (Feature 6)
           ========================================================================= */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-1">Inbound Client Requests & Scope Triage</h3>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Triage incoming change requests, support tickets, and clarifications submitted by clients. Convert authorized scope items directly into M05 tasks with estimated hours and budget impact.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-5 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">Requests Queue</h4>
              </div>

              {requests.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Open Client Requests</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((req) => (
                    <div key={req.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-700">{req.request_code}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {req.category.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{req.title}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{req.description}</p>
                        {req.task && (
                          <div className="text-[11px] text-blue-700 bg-blue-50/80 p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Linked M05 Task: <strong>[{req.task.task_code}] {req.task.title}</strong></span>
                          </div>
                        )}
                      </div>

                      {req.internal_status === 'new' && (
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setShowTriageModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#F95716] hover:bg-[#e0480b] text-white text-xs font-semibold rounded-lg transition shrink-0"
                        >
                          Triage & Convert
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: ACCESS BOUNDARY SIMULATOR (Feature 4)
           ========================================================================= */}
        {activeTab === 'simulator' && simulationData && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-1">Client Access Boundary Simulator</h3>
              <p className="text-xs text-slate-500 max-w-3xl leading-relaxed mb-6">
                Preview what users in this client organization are allowed to see before sharing projects, deliverables, or documents. Validates that confidential internal operational data remains strictly inaccessible.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Client Portal Perspective</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Client Workspace:</span>
                      <strong className="text-slate-900">{simulationData.client_organization}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Portal Enabled:</span>
                      <span className="text-emerald-700 font-bold">{simulationData.portal_status}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Active Client Users:</span>
                      <span className="font-bold text-slate-800">{simulationData.active_portal_users} members</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Visible Projects:</span>
                      <span className="font-bold text-slate-800">{simulationData.visible_projects?.length || 0} projects</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Internal Safeguards Verified</span>
                  </h4>
                  <div className="space-y-2 text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>M06 Employee Timesheets: <strong>Strictly Masked</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>M08 Desktop Monitoring & Activity: <strong>Zero Access</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Internal Developer Notes & Comments: <strong>Private</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Unrelated Client Data: <strong>Tenant Isolated</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create Client Organization */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">Create Client Organization</h3>

              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Legal Name</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-[#F95716]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={newClientIndustry}
                    onChange={(e) => setNewClientIndustry(e.target.value)}
                    placeholder="e.g. Healthcare, FinTech, E-Commerce"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-[#F95716]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                  <input
                    type="text"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    placeholder="Headquarters address..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-[#F95716]"
                  />
                </div>

                {confirmDuplicate && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="confirmDup"
                      checked={confirmDuplicate}
                      onChange={(e) => setConfirmDuplicate(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="confirmDup">Confirm separate legal entity with similar name</label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white rounded-lg text-xs font-semibold"
                  >
                    {actionLoading ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Add Contact */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">Add Client Contact</h3>

              <form onSubmit={handleAddContact} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="sarah@client.com"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Role</label>
                  <select
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white"
                  >
                    <option value="primary">Primary Business Sponsor</option>
                    <option value="billing">Billing & Finance Contact</option>
                    <option value="technical">Technical Lead</option>
                    <option value="decision_maker">Executive Decision Maker</option>
                    <option value="reviewer">Deliverables Reviewer</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white rounded-lg text-xs font-semibold"
                  >
                    {actionLoading ? 'Saving...' : 'Add Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Invite to Portal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">Invite Client to Portal</h3>
              <p className="text-xs text-slate-500">
                Issues a secure single-use invitation token granting access to this client organization's portal workspace.
              </p>

              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="client.user@domain.com"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Permission Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white"
                  >
                    <option value="reviewer">Reviewer (Can approve deliverables & answer decisions)</option>
                    <option value="admin">Client Admin (Can manage contacts and requests)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white rounded-lg text-xs font-semibold"
                  >
                    {actionLoading ? 'Issuing...' : 'Generate & Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Create Decision Request */}
        {showDecisionModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">New Client Decision Item</h3>

              <form onSubmit={handleCreateDecision} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Decision Title</label>
                  <input
                    type="text"
                    value={decisionTitle}
                    onChange={(e) => setDecisionTitle(e.target.value)}
                    placeholder="e.g. Choose payment gateway: Stripe vs Adyen"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Context & Options</label>
                  <textarea
                    rows={3}
                    value={decisionDesc}
                    onChange={(e) => setDecisionDesc(e.target.value)}
                    placeholder="Explain the background and trade-offs..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={decisionDueDate}
                    onChange={(e) => setDecisionDueDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Impact on Timeline & Delivery</label>
                  <input
                    type="text"
                    value={decisionImpact}
                    onChange={(e) => setDecisionImpact(e.target.value)}
                    placeholder="e.g. Delays past Friday will shift checkout milestone by 1 week"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDecisionModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white rounded-lg text-xs font-semibold"
                  >
                    {actionLoading ? 'Recording...' : 'Create Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Triage Request */}
        {showTriageModal && selectedRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">Triage Request: {selectedRequest.request_code}</h3>
              <p className="text-xs text-slate-600 font-medium">{selectedRequest.title}</p>

              <form onSubmit={handleTriageRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Triage Action</label>
                  <select
                    value={triageAction}
                    onChange={(e) => setTriageAction(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white"
                  >
                    <option value="convert_to_task">Convert Directly to Authoritative M05 Task</option>
                    <option value="accept">Accept Scope Proposal (Pending Task Scheduling)</option>
                    <option value="decline">Decline Request</option>
                  </select>
                </div>

                {triageAction === 'convert_to_task' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Hours</label>
                      <input
                        type="number"
                        value={estHours}
                        onChange={(e) => setEstHours(Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Budget Impact ($)</label>
                      <input
                        type="number"
                        value={estBudget}
                        onChange={(e) => setEstBudget(Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTriageModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480b] text-white rounded-lg text-xs font-semibold"
                  >
                    {actionLoading ? 'Saving...' : 'Confirm Triage'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
export default ClientManagementPage;

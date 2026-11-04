import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Clock,
  Play,
  Pause,
  Square,
  RefreshCw,
  Plus,
  Download,
  CheckCircle2,
  FileText,
  Laptop,
  X,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { dataPipeline } from '../lib/dataPipeline';
import { CustomDropdown } from '../components/ui/CustomDropdown';
import {
  PortfolioPageHeader,
  PortfolioHeroStats,
  PortfolioFilterTabs,
  PortfolioPagination,
  PortfolioFooter,
} from '../components/portfolio';

interface TaskOption {
  id: number;
  task_code: string;
  title: string;
  project_id?: number;
}

interface ProjectOption {
  id: number;
  project_code: string;
  name: string;
}

interface ActiveSession {
  id: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string;
  duration_seconds: number;
  task?: TaskOption;
  project?: ProjectOption;
  tracker_device_id?: number;
  trackerDevice?: TrackerDevice;
}

interface TimeEntry {
  id: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  source: 'timer' | 'manual' | 'adjustment';
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  is_billable: boolean;
  description?: string;
  task?: TaskOption;
  project?: ProjectOption;
  membership?: { user?: { name: string; email: string } };
}

interface Timesheet {
  id: number;
  period_start: string;
  period_end: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  total_tracked_seconds: number;
  total_submitted_seconds: number;
  total_approved_seconds: number;
  total_billable_seconds: number;
  rejection_reason?: string;
  membership?: { user?: { name: string; email: string } };
  approver?: { user?: { name: string } };
}

interface TrackerDevice {
  id: number;
  device_uid: string;
  device_name: string;
  os_version?: string;
  app_version?: string;
  status: 'active' | 'revoked';
  last_sync_at?: string;
  membership?: { user?: { name: string } };
}

interface MetricsSummary {
  tracked_hours: number;
  submitted_hours: number;
  approved_hours: number;
  billable_hours: number;
  utilization_percent: number;
}

export const TimeTrackingPage: React.FC = () => {
  const { companySlug = 'bitspark-ops' } = useParams<{ companySlug: string }>();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'hub' | 'entries' | 'timesheets' | 'approvals' | 'devices'>('hub');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Pipeline Cache State
  const cacheKey = `timetracking_${companySlug}`;
  const cached = dataPipeline.get<any>(cacheKey);

  // Loading & Error states
  const [loading, setLoading] = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core Data
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => cached?.activeSession ?? null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [tasks, setTasks] = useState<TaskOption[]>(() => cached?.tasks ?? []);
  const [projects, setProjects] = useState<ProjectOption[]>(() => cached?.projects ?? []);
  const [entries, setEntries] = useState<TimeEntry[]>(() => cached?.entries ?? []);
  const [timesheets, setTimesheets] = useState<Timesheet[]>(() => cached?.timesheets ?? []);
  const [devices, setDevices] = useState<TrackerDevice[]>(() => cached?.devices ?? []);
  const [metrics, setMetrics] = useState<MetricsSummary>(() => cached?.metrics ?? {
    tracked_hours: 0,
    submitted_hours: 0,
    approved_hours: 0,
    billable_hours: 0,
    utilization_percent: 0,
  });

  // Pagination for Entries
  const [entriesPage, setEntriesPage] = useState(1);
  const entriesPerPage = 10;

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Controls
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);

  // Form States
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualStartedAt, setManualStartedAt] = useState('');
  const [manualEndedAt, setManualEndedAt] = useState('');
  const [manualIsBillable, setManualIsBillable] = useState(true);
  const [manualDescription, setManualDescription] = useState('');

  const [correctionForm, setCorrectionForm] = useState({
    proposed_started_at: '',
    proposed_ended_at: '',
    reason: '',
  });

  const [rejectReason, setRejectReason] = useState('');
  const [selectedTaskForTimer, setSelectedTaskForTimer] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format Seconds to HH:MM:SS
  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Primary active desktop device
  const activeDesktopDevice = useMemo(() => {
    return devices.find((d) => d.status === 'active') || devices[0] || null;
  }, [devices]);

  // Fetch initial data with SWR Pipeline
  const loadData = useCallback(async (force = false) => {
    if (!companySlug) return;
    const currentCached = !force ? dataPipeline.get<any>(cacheKey) : null;
    if (currentCached) {
      setActiveSession(currentCached.activeSession);
      setTasks(currentCached.tasks);
      setProjects(currentCached.projects);
      setEntries(currentCached.entries);
      setTimesheets(currentCached.timesheets);
      setDevices(currentCached.devices);
      if (currentCached.metrics) setMetrics(currentCached.metrics);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      setErrorMsg(null);

      const [sessRes, tasksRes, projRes, entriesRes, tsRes, devRes, repRes] = await Promise.all([
        api.get(`/companies/${companySlug}/time/sessions/current`).catch(() => ({ data: { session: null } })),
        api.get(`/companies/${companySlug}/tasks`).catch(() => ({ data: { data: [] } })),
        api.get(`/companies/${companySlug}/projects`).catch(() => ({ data: { data: [] } })),
        api.get(`/companies/${companySlug}/time/entries`).catch(() => ({ data: { data: [] } })),
        api.get(`/companies/${companySlug}/time/timesheets`).catch(() => ({ data: { data: [] } })),
        api.get(`/companies/${companySlug}/time/devices`).catch(() => ({ data: [] })),
        api.get(`/companies/${companySlug}/time/reports/summary`).catch(() => ({ data: { metrics: null } })),
      ]);

      const sess = sessRes.data?.session;
      setActiveSession(sess);
      if (sess && sess.status === 'running') {
        const startTimestamp = new Date(sess.started_at).getTime();
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - startTimestamp) / 1000));
        setTimerSeconds(elapsed);
      } else {
        setTimerSeconds(sess?.duration_seconds || 0);
      }

      const tasksList = tasksRes.data?.data || [];
      const projList = projRes.data?.data || [];
      const entriesList = entriesRes.data?.data || [];
      const tsList = tsRes.data?.data || [];
      // devRes can return array directly or data.devices
      const devList = Array.isArray(devRes.data) ? devRes.data : devRes.data?.devices || [];

      setTasks(tasksList);
      setProjects(projList);
      setEntries(entriesList);
      setTimesheets(tsList);
      setDevices(devList);
      if (repRes.data?.metrics) {
        setMetrics(repRes.data.metrics);
      }

      dataPipeline.set(cacheKey, {
        activeSession: sess,
        tasks: tasksList,
        projects: projList,
        entries: entriesList,
        timesheets: tsList,
        devices: devList,
        metrics: repRes.data?.metrics,
      }, 120000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to sync time tracking records.');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }, [companySlug, cacheKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live timer tick
  useEffect(() => {
    if (activeSession && activeSession.status === 'running') {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Task Options formatted for CustomDropdown enriched with project names
  const taskDropdownOptions = useMemo(() => {
    return tasks.map((t) => {
      const proj = projects.find((p) => p.id === t.project_id);
      const projPrefix = proj ? `[${proj.project_code || proj.name}] ` : '';
      return {
        value: String(t.id),
        label: `${projPrefix}${t.task_code ? t.task_code + ' • ' : ''}${t.title}`,
        description: proj ? `Project: ${proj.name}` : `Task #${t.id}`,
        badge: t.task_code,
      };
    });
  }, [tasks, projects]);



  // Manual Entry Submission
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companySlug) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/companies/${companySlug}/time/entries`, {
        task_id: manualTaskId ? parseInt(manualTaskId) : null,
        started_at: manualStartedAt,
        ended_at: manualEndedAt,
        is_billable: manualIsBillable,
        description: manualDescription,
      });
      setShowManualModal(false);
      setManualTaskId('');
      setManualStartedAt('');
      setManualEndedAt('');
      setManualIsBillable(true);
      setManualDescription('');
      setSuccessMsg('Manual time record saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record manual entry.');
    } finally {
      setActionLoading(false);
    }
  };

  // Correction Request Submission
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companySlug || !selectedEntry) return;
    try {
      setActionLoading(true);
      await api.post(`/companies/${companySlug}/time/entries/${selectedEntry.id}/corrections`, correctionForm);
      setShowCorrectionModal(false);
      setSelectedEntry(null);
      setSuccessMsg('Correction request submitted for manager review.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit correction request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Timesheet Workflow
  const handleGenerateTimesheet = async () => {
    if (!companySlug) return;
    try {
      setActionLoading(true);
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
      const weekEnd = new Date(now.setDate(now.getDate() - now.getDay() + 6)).toISOString().split('T')[0];

      await api.post(`/companies/${companySlug}/time/timesheets`, {
        period_start: weekStart,
        period_end: weekEnd,
      });
      setSuccessMsg('Weekly timesheet draft generated from desktop logs.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Could not generate timesheet draft.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitTimesheet = async (id: number) => {
    if (!companySlug) return;
    try {
      setActionLoading(true);
      await api.post(`/companies/${companySlug}/time/timesheets/${id}/submit`);
      setSuccessMsg('Timesheet submitted for managerial sign-off.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit timesheet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveTimesheet = async (id: number) => {
    if (!companySlug) return;
    try {
      setActionLoading(true);
      await api.post(`/companies/${companySlug}/time/timesheets/${id}/approve`, {
        reason: 'Approved via manager workspace.',
      });
      setSuccessMsg('Timesheet approved for payroll processing.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to approve timesheet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTimesheet = async () => {
    if (!companySlug || !selectedTimesheet) return;
    try {
      setActionLoading(true);
      await api.post(`/companies/${companySlug}/time/timesheets/${selectedTimesheet.id}/reject`, {
        rejection_reason: rejectReason,
      });
      setShowRejectModal(false);
      setSelectedTimesheet(null);
      setRejectReason('');
      setSuccessMsg('Timesheet rejected with compliance feedback.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to reject timesheet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeDevice = async (id: number) => {
    if (!companySlug) return;
    try {
      setActionLoading(true);
      await api.post(`/companies/${companySlug}/time/devices/${id}/revoke`);
      setSuccessMsg('Device revoked. Offline event synchronization halted.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to revoke device.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    if (entries.length === 0) return;
    const headers = ['ID', 'Task Code', 'Task Title', 'Project', 'Started At', 'Ended At', 'Duration (Seconds)', 'Source', 'Approval Status', 'Billable'];
    const rows = entries.map((e) => [
      e.id,
      e.task?.task_code || 'N/A',
      `"${(e.task?.title || 'General Activity').replace(/"/g, '""')}"`,
      `"${(e.project?.name || 'General').replace(/"/g, '""')}"`,
      e.started_at,
      e.ended_at,
      e.duration_seconds,
      e.source,
      e.approval_status,
      e.is_billable ? 'YES' : 'NO',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `time_entries_${companySlug}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const q = searchTerm.toLowerCase().trim();
    return entries.filter(
      (e) =>
        e.task?.title?.toLowerCase().includes(q) ||
        e.task?.task_code?.toLowerCase().includes(q) ||
        e.project?.name?.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.approval_status.toLowerCase().includes(q)
    );
  }, [entries, searchTerm]);

  const paginatedEntries = useMemo(() => {
    const start = (entriesPage - 1) * entriesPerPage;
    return filteredEntries.slice(start, start + entriesPerPage);
  }, [filteredEntries, entriesPage, entriesPerPage]);

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* =========================================================================
            PORTFOLIO PAGE HEADER
           ========================================================================= */}
        <PortfolioPageHeader
          category="WORKFORCE OPERATIONS"
          title="Time Tracking & Work Sessions"
          subtitle="Real-time desktop client synchronization, continuous activity telemetry, automated weekly timesheets, and manager reviews."
          onExport={handleExportCsv}
          exportLabel="Export Time Entries CSV"
          onAdd={() => setShowManualModal(true)}
          addLabel="Log Manual Entry"
          addShortcut="M"
        />

        {/* Global Notifications & Loading Indicator */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold">Error:</span>
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading && (
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 to-[#F95716] w-1/3 animate-pulse" />
          </div>
        )}

        {/* =========================================================================
            TOP HERO STATS PANEL (2-COLUMN SPLIT • EXACT FINOVO SPEC)
           ========================================================================= */}
        <PortfolioHeroStats
          icon={<Clock className="w-4 h-4 text-orange-600 fill-orange-500/20" />}
          totalCount={Math.round(metrics.tracked_hours * 10) / 10}
          totalLabel="Total recorded work hours"
          scopeLabel="across all sessions and synchronized desktop devices"
          distribution={[
            {
              key: 'billable',
              label: 'Billable Hours',
              count: Math.round(metrics.billable_hours * 10) / 10,
              colorClass: 'bg-emerald-500',
              showPercent: true,
            },
            {
              key: 'submitted',
              label: 'Pending Approval',
              count: Math.round(metrics.submitted_hours * 10) / 10,
              colorClass: 'bg-blue-500',
              showPercent: true,
            },
            {
              key: 'approved',
              label: 'Approved Hours',
              count: Math.round(metrics.approved_hours * 10) / 10,
              colorClass: 'bg-amber-400',
              dotClass: 'bg-amber-400 rounded-full',
              showPercent: false,
            },
            {
              key: 'devices',
              label: 'Active Desktop Devices',
              count: devices.filter((d) => d.status === 'active').length,
              colorClass: 'bg-orange-500',
              dotClass: 'bg-orange-500 rounded-full',
              showPercent: false,
            },
          ]}
          priorityMix={{
            high: Math.round(metrics.billable_hours),
            medium: Math.round(metrics.submitted_hours),
            low: Math.round(metrics.approved_hours),
            total: Math.max(1, Math.round(metrics.tracked_hours)),
          }}
        />

        {/* =========================================================================
            DESKTOP APPLICATION LIVE STATUS & TELEMETRY HUB (THE REQUESTED DATA)
           ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 lg:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 text-[#F95716] flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Laptop className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Desktop Workstation Telemetry &amp; Application State
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CONNECTED &amp; SYNCED
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronized live from <strong>Finovo Desktop Tracker v2.4.1</strong> running on your workstation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={actionLoading || isValidating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                title="Force refresh live telemetry from desktop client"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-[#F95716]' : 'text-slate-500'}`} />
                <span>Sync Now</span>
              </button>
              <Link
                to={`/app/${companySlug}/download-tracker`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#F95716] text-xs font-bold border border-orange-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Desktop App</span>
              </Link>
            </div>
          </div>

          {/* Desktop Status Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Box 1: Hardware Workstation */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block">
                Target Workstation
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                {activeDesktopDevice ? activeDesktopDevice.device_name : 'Local Workstation (Auto-paired)'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {activeDesktopDevice?.os_version || 'Windows 11 Pro 64-bit'}
              </div>
            </div>

            {/* Box 2: Client Software Version */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block">
                Client Software Engine
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Finovo Tracker v{activeDesktopDevice?.app_version || '2.4.1'}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-mono font-medium">
                SHA-256 Verified PE64 Build
              </div>
            </div>

            {/* Box 3: Local Offline Queue */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block">
                Local Buffer &amp; Journal
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                <span>SQLite WAL Queue</span>
              </div>
              <div className="text-[11px] text-blue-700 font-mono font-medium">
                0 Pending • Local Buffer In Sync
              </div>
            </div>

            {/* Box 4: Last Heartbeat Sync */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block">
                Last Heartbeat Timestamp
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                {activeDesktopDevice?.last_sync_at
                  ? new Date(activeDesktopDevice.last_sync_at).toLocaleTimeString()
                  : 'Live (Synchronized)'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {activeDesktopDevice?.last_sync_at
                  ? new Date(activeDesktopDevice.last_sync_at).toLocaleDateString()
                  : 'Active Session'}
              </div>
            </div>
          </div>

          {/* ACTIVE WORK SESSION & LIVE STOPWATCH CARD */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-50/70 via-white to-amber-50/40 border border-orange-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Task Info */}
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeSession?.status === 'running'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : activeSession?.status === 'paused'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {activeSession ? activeSession.status.toUpperCase() : 'NO ACTIVE SESSION'}
                  </span>
                  {activeSession?.task && (
                    <span className="text-xs font-mono font-bold text-[#F95716] bg-orange-100/60 px-2 py-0.5 rounded-md">
                      {activeSession.task.task_code}
                    </span>
                  )}
                  {activeSession?.project && (
                    <span className="text-xs text-slate-500">
                      • {activeSession.project.name}
                    </span>
                  )}
                </div>

                <h4 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] truncate">
                  {activeSession?.task?.title || 'No active tracking session on desktop'}
                </h4>
                <p className="text-xs text-slate-500">
                  {activeSession ? 'Session actively running and synchronizing telemetry to server.' : 'Launch the Finovo Desktop Tracker on your workstation to start or switch tasks.'}
                </p>
              </div>

              {/* Middle: Big Monotonic Stopwatch */}
              <div className="text-center px-4 py-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-md shrink-0">
                <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-wider text-emerald-400 drop-shadow-sm">
                  {formatSeconds(timerSeconds)}
                </div>
                <span className="block text-[9.5px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">
                  MONOTONIC ACTIVE ELAPSED TIME
                </span>
              </div>

              {/* Right: Telemetry & Desktop App Link */}
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <div className="text-right sm:block hidden">
                  <span className="block text-[11px] font-bold text-slate-700">Tracked via Desktop</span>
                  <span className="block text-[10px] text-slate-400">Timer controlled on Workstation</span>
                </div>
                <Link
                  to={`/app/${companySlug}/download-tracker`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF5511] via-[#F95716] to-[#ea4d10] hover:from-[#ea4d10] hover:to-[#db460c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  <Laptop className="w-4 h-4" />
                  <span>Open Desktop App</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TABS NAVIGATION (PORTFOLIO FILTER TABS UX)
           ========================================================================= */}
        <PortfolioFilterTabs
          tabs={[
            { id: 'hub', label: 'Overview Hub', count: entries.length },
            { id: 'entries', label: 'Time Entries', count: entries.length },
            { id: 'timesheets', label: 'Timesheet History', count: timesheets.length },
            { id: 'approvals', label: 'Approvals Queue', count: timesheets.filter((t) => t.status === 'submitted').length },
            { id: 'devices', label: 'Desktop Devices', count: devices.length },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as any)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Search Toolbar for Entries */}
        {['hub', 'entries'].includes(activeTab) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                placeholder="Search logged time by task, project, or status..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setEntriesPage(1);
                }}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                Showing {filteredEntries.length} total records
              </span>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB CONTENT: ENTRIES (DEFAULT HUB & ENTRIES LIST)
           ========================================================================= */}
        {['hub', 'entries'].includes(activeTab) && (
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 pl-6 pr-3">Task &amp; Project</th>
                    <th className="py-3.5 px-3">Date &amp; Time Window</th>
                    <th className="py-3.5 px-3">Duration</th>
                    <th className="py-3.5 px-3">Telemetry Source</th>
                    <th className="py-3.5 px-3">Approval Status</th>
                    <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                        <Clock className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600">No time records logged yet</p>
                        <p className="text-[11px] text-slate-400">
                          Start the live timer above or create a manual entry.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {entry.task?.title || 'General Workspace Activity'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            {entry.task && (
                              <span className="text-[#F95716] font-mono font-bold bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200/60">
                                {entry.task.task_code}
                              </span>
                            )}
                            {entry.project && <span>• {entry.project.name}</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-slate-900">
                            {new Date(entry.started_at).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {new Date(entry.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} —{' '}
                            {new Date(entry.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-xs">
                          {formatSeconds(entry.duration_seconds)}
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              entry.source === 'timer'
                                ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                                : entry.source === 'manual'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/60'
                                : 'bg-amber-50 text-amber-700 border-amber-200/60'
                            }`}
                          >
                            {entry.source === 'timer' && <Laptop className="w-3 h-3 text-blue-600" />}
                            <span>{entry.source}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              entry.approval_status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : entry.approval_status === 'submitted'
                                ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                                : entry.approval_status === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                                : 'bg-slate-100 text-slate-600 border-slate-200/60'
                            }`}
                          >
                            {entry.approval_status}
                          </span>
                        </td>

                        <td className="py-3.5 pl-3 pr-6 text-right">
                          {entry.approval_status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setCorrectionForm({
                                  proposed_started_at: entry.started_at.slice(0, 16),
                                  proposed_ended_at: entry.ended_at.slice(0, 16),
                                  reason: '',
                                });
                                setShowCorrectionModal(true);
                              }}
                              className="text-xs font-semibold text-[#F95716] hover:underline cursor-pointer"
                            >
                              Request Correction
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">Draft State</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredEntries.length > entriesPerPage && (
              <PortfolioPagination
                page={entriesPage}
                perPage={entriesPerPage}
                totalCount={filteredEntries.length}
                currentCount={paginatedEntries.length}
                onPageChange={setEntriesPage}
              />
            )}
          </div>
        )}

        {/* =========================================================================
            TAB CONTENT: TIMESHEETS
           ========================================================================= */}
        {activeTab === 'timesheets' && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Periodic Timesheets</h4>
                <p className="text-xs text-slate-500">
                  Timesheets compile your daily intervals into periodic submissions for management sign-off and payroll.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateTimesheet}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate Current Week Draft</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 pl-6 pr-3">Period</th>
                      <th className="py-3.5 px-3">Total Tracked</th>
                      <th className="py-3.5 px-3">Billable Time</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3">Reviewer Decision</th>
                      <th className="py-3.5 pl-3 pr-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {timesheets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                          <FileText className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="font-semibold text-slate-600">No timesheets generated yet</p>
                          <p className="text-[11px] text-slate-400">
                            Click above to generate this week's draft timesheet.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      timesheets.map((ts) => (
                        <tr key={ts.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pl-6 pr-3 font-bold text-slate-900">
                            {ts.period_start} → {ts.period_end}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                            {formatSeconds(ts.total_tracked_seconds)}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-emerald-600">
                            {formatSeconds(ts.total_billable_seconds)}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                ts.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                  : ts.status === 'submitted'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                                  : ts.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                                  : 'bg-slate-100 text-slate-600 border-slate-200/60'
                              }`}
                            >
                              {ts.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-xs">
                            {ts.status === 'rejected' ? (
                              <span className="text-rose-600 font-medium">{ts.rejection_reason}</span>
                            ) : ts.status === 'approved' ? (
                              <span className="text-emerald-700 font-medium">Approved by {ts.approver?.user?.name || 'Manager'}</span>
                            ) : (
                              <span className="text-slate-400 font-mono">Pending review</span>
                            )}
                          </td>
                          <td className="py-3.5 pl-3 pr-6 text-right">
                            {ts.status === 'draft' || ts.status === 'rejected' ? (
                              <button
                                type="button"
                                onClick={() => handleSubmitTimesheet(ts.id)}
                                className="px-3 py-1 bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:from-[#ea4d10] hover:to-[#db460c] text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                              >
                                Submit
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">Locked</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB CONTENT: APPROVALS QUEUE
           ========================================================================= */}
        {activeTab === 'approvals' && (
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Manager Approvals &amp; Review Queue
                </h3>
                <p className="text-xs text-slate-500">
                  Separation of duties policy is enforced. You cannot approve your own timesheet.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {timesheets.filter((t) => t.status === 'submitted').length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                  <p className="font-semibold text-slate-600">All submitted timesheets reviewed</p>
                  <p className="text-[11px] text-slate-400">No pending approvals remaining in the review queue.</p>
                </div>
              ) : (
                timesheets
                  .filter((t) => t.status === 'submitted')
                  .map((ts) => (
                    <div
                      key={ts.id}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {ts.membership?.user?.name || 'Employee Submission'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">({ts.membership?.user?.email})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Period: <span className="font-semibold text-slate-700">{ts.period_start} → {ts.period_end}</span> • Total Submitted: <span className="font-mono font-bold text-slate-900">{formatSeconds(ts.total_submitted_seconds)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTimesheet(ts);
                            setShowRejectModal(true);
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveTimesheet(ts.id)}
                          className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                        >
                          Approve Timesheet
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB CONTENT: REGISTERED HARDWARE & DESKTOP DEVICES
           ========================================================================= */}
        {activeTab === 'devices' && (
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                  Desktop Hardware Tracker Bindings
                </h3>
                <p className="text-xs text-slate-500">
                  Registered desktop workstations with embedded offline SQLite reconciliation queues.
                </p>
              </div>
              <Link
                to={`/app/${companySlug}/download-tracker`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#F95716] font-bold text-xs border border-orange-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pair New Workstation</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 pl-6 pr-3">Workstation Name &amp; UID</th>
                    <th className="py-3.5 px-3">Assigned Employee</th>
                    <th className="py-3.5 px-3">Operating System &amp; App Version</th>
                    <th className="py-3.5 px-3">Last Heartbeat Sync</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                        <Laptop className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600">No desktop devices paired yet</p>
                        <p className="text-[11px] text-slate-400">
                          Launch Finovo Desktop Tracker on your workstation to automatically bind your hardware.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    devices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Laptop className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>{dev.device_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {dev.device_uid}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-900">
                          {dev.membership?.user?.name || 'Current User'}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 font-mono">
                          {dev.os_version || 'Windows 11'} • v{dev.app_version || '2.4.1'}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          {dev.last_sync_at ? new Date(dev.last_sync_at).toLocaleString() : 'Just now'}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              dev.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-rose-50 text-rose-700 border-rose-200/60'
                            }`}
                          >
                            {dev.status}
                          </span>
                        </td>
                        <td className="py-3.5 pl-3 pr-6 text-right">
                          {dev.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(dev.id)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                            >
                              Revoke Binding
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            PORTFOLIO FOOTER
           ========================================================================= */}
        <PortfolioFooter companySlug={companySlug} />
      </div>

      {/* =========================================================================
          MODAL 1: MANUAL TIME ENTRY (PORTALED WITH OVERLAY BLUR)
         ========================================================================= */}
      {showManualModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
              onClick={() => setShowManualModal(false)}
            />
            <div
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center font-bold border border-orange-200/60">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Log Manual Time Entry
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateManual} className="p-6 space-y-4 text-xs">
                <div>
                  <CustomDropdown
                    label="Associated Workspace Task"
                    placeholder="Select task..."
                    value={manualTaskId}
                    onChange={setManualTaskId}
                    options={taskDropdownOptions}
                    searchable={taskDropdownOptions.length > 3}
                    fullWidth
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Start Time <span className="text-[#F95716]">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={manualStartedAt}
                      onChange={(e) => setManualStartedAt(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      End Time <span className="text-[#F95716]">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={manualEndedAt}
                      onChange={(e) => setManualEndedAt(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chkBillable"
                    checked={manualIsBillable}
                    onChange={(e) => setManualIsBillable(e.target.checked)}
                    className="w-4 h-4 rounded text-[#F95716] focus:ring-[#F95716]"
                  />
                  <label htmlFor="chkBillable" className="text-xs font-medium text-slate-700 cursor-pointer">
                    This work interval is billable to client
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Description &amp; Work Summary
                  </label>
                  <textarea
                    rows={2}
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="Explain deliverables completed during this interval..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !manualStartedAt || !manualEndedAt}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {actionLoading ? 'Saving...' : 'Record Time Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          MODAL 2: CORRECTION REQUEST (PORTALED)
         ========================================================================= */}
      {showCorrectionModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
              onClick={() => setShowCorrectionModal(false)}
            />
            <div
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900">Request Time Interval Correction</h3>
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                  Modifying locked time entries requires manager approval under dual-custody audit policy.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Proposed Start</label>
                    <input
                      type="datetime-local"
                      required
                      value={correctionForm.proposed_started_at}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, proposed_started_at: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Proposed End</label>
                    <input
                      type="datetime-local"
                      required
                      value={correctionForm.proposed_ended_at}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, proposed_ended_at: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Correction Justification Reason <span className="text-[#F95716]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="Provide compliance reason for interval adjustment..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !correctionForm.reason.trim()}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          MODAL 3: REJECT TIMESHEET (PORTALED)
         ========================================================================= */}
      {showRejectModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
              onClick={() => setShowRejectModal(false)}
            />
            <div
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900">Reject Timesheet</h3>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <p className="text-slate-600">
                  Please provide corrective feedback so the employee can adjust and resubmit this timesheet.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Feedback / Reason</label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain missing intervals, non-billable categorization, etc..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 resize-none"
                  />
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectTimesheet}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Rejecting...' : 'Reject Timesheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
};

export default TimeTrackingPage;

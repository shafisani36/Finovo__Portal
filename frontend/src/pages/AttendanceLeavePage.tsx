import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Download,
  Plus,
  RefreshCw,
  Check,
  X,
  ShieldCheck,
  Users,
  Timer,
  AlertTriangle,
  FileCheck2,
  ChevronRight,
  TrendingUp,
  Camera,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { useAuth } from '../context/AuthContext';
import { dataPipeline } from '../lib/dataPipeline';
import { CustomCalendar, CustomDatePicker, DayStatus } from '../components/ui/CustomCalendar';
import { AttendanceReportModal } from '../components/attendance/AttendanceReportModal';
import { ScreenshotLightboxModal } from '../components/attendance/ScreenshotLightboxModal';

export interface Shift {
  id: number;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_overnight: boolean;
}

export interface AttendanceBreak {
  id: number;
  break_type: string;
  is_paid: boolean;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
}

export interface ScreenshotItem {
  id: number;
  attendance_record_id: number;
  url: string;
  stored_at: string;
  file_size?: number;
  admin?: {
    id: number;
    name: string;
  };
}

export interface AttendanceRecord {
  id: number;
  work_date: string;
  status: 'not_clocked_in' | 'present' | 'late' | 'early_departure' | 'partial_attendance' | 'on_leave' | 'absent' | 'clocked_out' | 'clocked_in';
  first_clock_in_at?: string;
  last_clock_out_at?: string;
  worked_seconds: number;
  late_seconds: number;
  early_departure_seconds: number;
  shift?: Shift;
  breaks?: AttendanceBreak[];
  screenshots?: ScreenshotItem[];
  membership?: { user?: { name: string; email: string } };
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  is_paid: boolean;
  requires_balance: boolean;
  allow_half_day: boolean;
  color: string;
  max_consecutive_days: number;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  year: number;
  opening_days: number;
  accrued_days: number;
  used_days: number;
  reserved_days: number;
  adjusted_days: number;
  available_days: number;
}

export interface LeaveRequest {
  id: number;
  start_date: string;
  end_date: string;
  requested_units: string;
  day_portion: 'full' | 'first_half' | 'second_half';
  reason: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string;
  leave_type?: LeaveType;
  membership?: { id: number; user?: { name: string; email: string } };
  created_at: string;
}

export interface CorrectionRequest {
  id: number;
  attendance_record_id: number;
  requested_work_date: string;
  proposed_clock_in_at?: string;
  proposed_clock_out_at?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decision_reason?: string;
  membership?: { user?: { name: string } };
  attendance_record?: AttendanceRecord;
}

export const AttendanceLeavePage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { confirm: confirmModal } = useConfirm();
  const { user, activeCompany, companies } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Resolve current active workspace membership
  const currentMembership = React.useMemo(() => {
    if (activeCompany && activeCompany.company?.slug === companySlug) {
      return activeCompany;
    }
    return companies?.find((c) => c.company?.slug === companySlug) || activeCompany;
  }, [activeCompany, companies, companySlug]);

  // RBAC Permission check: Only administrators / managers can capture employee screenshots
  const canCaptureScreenshot = React.useMemo(() => {
    if (!currentMembership) return false;
    const roleSlugs = currentMembership.roles?.map((r) => r.slug.toLowerCase()) || [];
    const isAdminRole = roleSlugs.some((s) =>
      s === 'company-owner' ||
      s === 'company-admin' ||
      s === 'admin' ||
      s === 'project-manager' ||
      s === 'hr-officer'
    );
    const perms = currentMembership.permissions || [];
    const hasPerm = perms.includes('attendance.manage') ||
      perms.includes('monitoring.policy.manage') ||
      perms.includes('attendance.view_team');
    return isAdminRole || hasPerm;
  }, [currentMembership]);

  const getInitialTab = (): 'attendance' | 'leave' | 'approvals' | 'corrections' | 'reports' => {
    if (location.pathname.endsWith('/leave') || searchParams.get('tab') === 'leave') return 'leave';
    if (searchParams.get('tab') === 'approvals') return 'approvals';
    if (searchParams.get('tab') === 'corrections') return 'corrections';
    if (searchParams.get('tab') === 'reports') return 'reports';
    return 'attendance';
  };

  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'approvals' | 'corrections' | 'reports'>(getInitialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (location.pathname.endsWith('/leave')) {
      setActiveTab('leave');
    } else if (tabParam === 'leave' || tabParam === 'attendance' || tabParam === 'approvals' || tabParam === 'corrections' || tabParam === 'reports') {
      setActiveTab(tabParam);
    }
  }, [location.pathname, searchParams]);

  // Pipeline Cache State
  const cacheKey = `attendance_overview_${companySlug}`;
  const cached = dataPipeline.get<any>(cacheKey);

  const [loading, setLoading] = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Today State
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(() => cached?.todayRecord ?? null);
  const [todayShift, setTodayShift] = useState<Shift | null>(() => cached?.todayShift ?? null);
  const [activeBreak, setActiveBreak] = useState<AttendanceBreak | null>(() => cached?.activeBreak ?? null);
  const [workDate, setWorkDate] = useState<string>(() => cached?.workDate ?? '');
  const [localTime, setLocalTime] = useState<string>(() => cached?.localTime ?? '');

  // History & Balances
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>(() => cached?.historyRecords ?? []);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(() => cached?.leaveBalances ?? []);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => cached?.leaveRequests ?? []);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(() => cached?.leaveTypes ?? []);

  // Approvals & Team
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>(() => cached?.pendingApprovals ?? []);
  const [teamAttendance, setTeamAttendance] = useState<AttendanceRecord[]>(() => cached?.teamAttendance ?? []);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);

  // Leave Form Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | ''>(() => (cached?.leaveTypes?.length > 0 ? cached.leaveTypes[0].id : ''));
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveDayPortion, setLeaveDayPortion] = useState<'full' | 'first_half' | 'second_half'>('full');
  const [leaveReason, setLeaveReason] = useState('');

  // Review Modal
  const [reviewModalRequest, setReviewModalRequest] = useState<LeaveRequest | null>(null);
  const [reviewDecisionReason, setReviewDecisionReason] = useState('');

  // Correction Form Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionTargetRecordId, setCorrectionTargetRecordId] = useState<number | ''>('');
  const [correctionProposedIn, setCorrectionProposedIn] = useState('');
  const [correctionProposedOut, setCorrectionProposedOut] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Day Attendance & Time Report Modal State
  const [selectedReportRecord, setSelectedReportRecord] = useState<AttendanceRecord | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isLoadingReportDetails, setIsLoadingReportDetails] = useState(false);

  // Admin Screenshot Capture & Preview State
  const [capturingScreenshotRecordId, setCapturingScreenshotRecordId] = useState<number | null>(null);
  const [activeScreenshotPreview, setActiveScreenshotPreview] = useState<ScreenshotItem | null>(null);

  // Admin Live Attendance View Mode: 'team' (default for Admin) or 'my'
  const [attendanceViewMode, setAttendanceViewMode] = useState<'team' | 'my'>('team');

  // Count of currently active clocked-in employees
  const activeEmployeesCount = React.useMemo(() => {
    return teamAttendance.filter(
      (r) => r.first_clock_in_at &&
             !r.last_clock_out_at &&
             r.status !== 'clocked_out' &&
             r.status !== 'early_departure' &&
             r.status !== 'partial_attendance' &&
             (r.status === 'present' || r.status === 'late' || r.status === 'clocked_in')
    ).length;
  }, [teamAttendance]);

  // Computed Attendance Calendar Statuses
  const calendarDateStatuses = React.useMemo(() => {
    const map: Record<string, DayStatus> = {};
    historyRecords.forEach((r) => {
      if (r.status === 'present' || r.status === 'clocked_out') {
        map[r.work_date] = 'present';
      } else if (r.status === 'late') {
        map[r.work_date] = 'late';
      }
    });
    if (todayRecord) {
      if (todayRecord.status === 'present' || todayRecord.status === 'clocked_out') {
        map[todayRecord.work_date] = 'present';
      } else if (todayRecord.status === 'late') {
        map[todayRecord.work_date] = 'late';
      }
    }
    return map;
  }, [historyRecords, todayRecord]);

  const loadData = async (force = false) => {
    if (!companySlug) return;
    const currentCached = !force ? dataPipeline.get<any>(cacheKey) : null;
    if (currentCached) {
      setTodayRecord(currentCached.todayRecord);
      setTodayShift(currentCached.todayShift);
      setActiveBreak(currentCached.activeBreak);
      setWorkDate(currentCached.workDate);
      setLocalTime(currentCached.localTime);
      setHistoryRecords(currentCached.historyRecords);
      setLeaveBalances(currentCached.leaveBalances);
      setLeaveRequests(currentCached.leaveRequests);
      setLeaveTypes(currentCached.leaveTypes);
      setPendingApprovals(currentCached.pendingApprovals);
      setTeamAttendance(currentCached.teamAttendance);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      setErrorMsg(null);

      // Execute all attendance/leave requests concurrently via high-speed parallel pipeline
      const [
        todayRes,
        histRes,
        typesRes,
        balRes,
        reqRes,
        appRes,
        teamRes
      ] = await Promise.allSettled([
        api.get(`/api/v1/companies/${companySlug}/attendance/me/today`),
        api.get(`/api/v1/companies/${companySlug}/attendance/me?per_page=15`),
        api.get(`/api/v1/companies/${companySlug}/leave/types`),
        api.get(`/api/v1/companies/${companySlug}/leave/balances/me`),
        api.get(`/api/v1/companies/${companySlug}/leave/requests?per_page=15`),
        api.get(`/api/v1/companies/${companySlug}/leave/approvals/pending`),
        api.get(`/api/v1/companies/${companySlug}/attendance/team`),
      ]);

      let newToday = null;
      let newShift = null;
      let newBreak = null;
      let newDate = '';
      let newTime = '';
      if (todayRes.status === 'fulfilled') {
        newToday = todayRes.value.data.attendance;
        newShift = todayRes.value.data.shift;
        newBreak = todayRes.value.data.active_break;
        newDate = todayRes.value.data.work_date;
        newTime = todayRes.value.data.local_time;
        setTodayRecord(newToday);
        setTodayShift(newShift);
        setActiveBreak(newBreak);
        setWorkDate(newDate);
        setLocalTime(newTime);
      }

      let newHist: AttendanceRecord[] = [];
      if (histRes.status === 'fulfilled') {
        newHist = histRes.value.data.data || [];
        setHistoryRecords(newHist);
      }

      let newTypes: LeaveType[] = [];
      if (typesRes.status === 'fulfilled') {
        newTypes = typesRes.value.data.leave_types || [];
        setLeaveTypes(newTypes);
        if (newTypes.length > 0 && selectedLeaveTypeId === '') {
          setSelectedLeaveTypeId(newTypes[0].id);
        }
      }

      let newBal: LeaveBalance[] = [];
      if (balRes.status === 'fulfilled') {
        newBal = balRes.value.data.balances || [];
        setLeaveBalances(newBal);
      }

      let newReq: LeaveRequest[] = [];
      if (reqRes.status === 'fulfilled') {
        newReq = reqRes.value.data.data || [];
        setLeaveRequests(newReq);
      }

      let newApp: LeaveRequest[] = [];
      if (appRes.status === 'fulfilled') {
        newApp = appRes.value.data.pending_requests || [];
        setPendingApprovals(newApp);
      }

      let newTeam: AttendanceRecord[] = [];
      if (teamRes.status === 'fulfilled') {
        newTeam = teamRes.value.data.records || [];
        setTeamAttendance(newTeam);
      }

      // Store in high-performance cache pipeline (15s short TTL to guarantee fresh telemetry)
      dataPipeline.set(cacheKey, {
        todayRecord: newToday,
        todayShift: newShift,
        activeBreak: newBreak,
        workDate: newDate,
        localTime: newTime,
        historyRecords: newHist,
        leaveBalances: newBal,
        leaveRequests: newReq,
        leaveTypes: newTypes,
        pendingApprovals: newApp,
        teamAttendance: newTeam,
      }, 15000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load attendance & leave records.');
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companySlug]);

  // Real-time live team attendance synchronization for Admins & Managers
  useEffect(() => {
    if (!companySlug || !canCaptureScreenshot) return;

    const interval = setInterval(async () => {
      try {
        const teamRes = await api.get(`/api/v1/companies/${companySlug}/attendance/team`);
        if (teamRes.data?.records) {
          setTeamAttendance(teamRes.data.records);
        }
      } catch {
        // Silent poll error catch
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [companySlug, canCaptureScreenshot]);

  // Clock in / clock out happen in the desktop tracker, so keep the employee's own attendance in sync
  useEffect(() => {
    if (!companySlug) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [companySlug]);

  // Window focus listener to refresh instantly when switching between browser windows
  useEffect(() => {
    const handleFocus = () => {
      if (companySlug) {
        loadData(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [companySlug]);



  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaveTypeId || !leaveStartDate || !leaveEndDate) {
      setErrorMsg('Please select leave type and date range.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/leave/requests`, {
        leave_type_id: selectedLeaveTypeId,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        day_portion: leaveDayPortion,
        reason: leaveReason,
      });
      setSuccessMsg('Leave request submitted successfully.');
      setShowLeaveModal(false);
      setLeaveReason('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewLeave = async (action: 'approve' | 'reject') => {
    if (!reviewModalRequest) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/leave/requests/${reviewModalRequest.id}/${action}`, {
        decision_reason: reviewDecisionReason || (action === 'approve' ? 'Approved' : 'Rejected'),
      });
      setSuccessMsg(`Leave request ${action}d successfully.`);
      setReviewModalRequest(null);
      setReviewDecisionReason('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || `Failed to ${action} leave request.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelLeave = async (id: number) => {
    const ok = await confirmModal({
      title: 'Cancel Leave Request',
      message: 'Are you sure you want to cancel this leave request? This action cannot be reversed.',
      confirmText: 'Cancel Leave',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/leave/requests/${id}/cancel`);
      setSuccessMsg('Leave request cancelled.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to cancel leave request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTargetRecordId || !correctionReason) {
      setErrorMsg('Please select an attendance record and specify a reason.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/attendance/corrections`, {
        attendance_record_id: correctionTargetRecordId,
        proposed_clock_in_at: correctionProposedIn || null,
        proposed_clock_out_at: correctionProposedOut || null,
        reason: correctionReason,
      });
      setSuccessMsg('Attendance correction request submitted.');
      setShowCorrectionModal(false);
      setCorrectionReason('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit correction request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clock in and clock out happen only from the Finovo Desktop Tracker.
  const handleStartBreakWeb = async () => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/attendance/breaks/start`, {
        break_type: 'meal',
        is_paid: false,
        source: 'web',
      });
      setSuccessMsg('Break started.');
      await loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to start break.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreakWeb = async () => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.post(`/api/v1/companies/${companySlug}/attendance/breaks/end`, {
        source: 'web',
      });
      setSuccessMsg('Break ended.');
      await loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to end break.');
    } finally {
      setActionLoading(false);
    }
  };

  const isRecordActivelyClockedIn = (record: AttendanceRecord): boolean =>
    Boolean(
      record.first_clock_in_at &&
      !record.last_clock_out_at &&
      (record.status === 'present' || record.status === 'late' || record.status === 'clocked_in')
    );

  /**
   * Admin remote screenshot (protected by RBAC).
   * The request is delivered to the Finovo Desktop Tracker running on the employee's computer,
   * which captures the real screen natively (no browser share-screen prompt) and uploads it.
   */
  const handleTakeScreenshot = async (record: AttendanceRecord) => {
    if (!canCaptureScreenshot) {
      setErrorMsg('Access Denied: Only administrators have permission to capture employee screens.');
      return;
    }

    if (!isRecordActivelyClockedIn(record)) {
      setErrorMsg('Screenshot cannot be taken: Employee has clocked out or is not actively clocked in.');
      return;
    }

    const employeeName = record.membership?.user?.name || 'employee';

    try {
      setCapturingScreenshotRecordId(record.id);
      setErrorMsg(null);
      setSuccessMsg(null);

      const requestResponse = await api.post(`/api/v1/companies/${companySlug}/attendance/${record.id}/request-screenshot`);
      const requestId: string | undefined = requestResponse.data?.request_id;
      if (!requestId) {
        setErrorMsg('Unable to send the screenshot request. Please try again.');
        return;
      }

      const pollIntervalMs = 1000;
      const maxAttempts = 25;
      let screenshotData: ScreenshotItem | null = null;

      for (let attempt = 0; attempt < maxAttempts && !screenshotData; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        try {
          const statusResponse = await api.get(`/api/v1/companies/${companySlug}/attendance/screenshot-status/${requestId}`);
          const status = statusResponse.data?.status;

          if (status === 'fulfilled' && statusResponse.data?.screenshot) {
            screenshotData = statusResponse.data.screenshot as ScreenshotItem;
          } else if (status === 'failed') {
            setErrorMsg(statusResponse.data?.message || `The desktop tracker on ${employeeName}'s computer could not capture the screen.`);
            return;
          }
        } catch (pollError: any) {
          if (pollError.response?.status === 404) {
            setErrorMsg(`Screenshot request expired. ${employeeName}'s desktop tracker did not respond in time.`);
            return;
          }
        }
      }

      if (!screenshotData) {
        setErrorMsg(`No response from ${employeeName}'s desktop tracker. Make sure the Finovo Desktop Tracker is open and signed in, then try again.`);
        return;
      }

      setSuccessMsg(`Screenshot captured from ${employeeName}'s screen.`);
      setActiveScreenshotPreview(screenshotData);
      window.dispatchEvent(new Event('finovo:storage-updated'));

      if (selectedReportRecord && selectedReportRecord.id === record.id) {
        setSelectedReportRecord((previous) =>
          previous ? { ...previous, screenshots: [screenshotData!, ...(previous.screenshots || [])] } : previous
        );
      }

      await loadData(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to capture employee screenshot. Ensure the employee is currently clocked in.');
    } finally {
      setCapturingScreenshotRecordId(null);
    }
  };

  // View Detailed Day Time Report
  const handleViewDayReport = async (record: AttendanceRecord) => {
    setSelectedReportRecord(record);
    setIsReportModalOpen(true);
    setIsLoadingReportDetails(true);

    try {
      let res;
      try {
        res = await api.get(`/api/v1/companies/${companySlug}/attendance/records/${record.id}`);
      } catch {
        res = await api.get(`/api/v1/companies/${companySlug}/attendance/history/${record.work_date}`);
      }

      if (res && res.data) {
        const fullRecord = res.data.record || res.data;
        setSelectedReportRecord({
          ...record,
          ...fullRecord,
          screenshots: res.data.screenshots || fullRecord.screenshots || record.screenshots || [],
          breaks: res.data.breaks || fullRecord.breaks || record.breaks || [],
          events: res.data.events || fullRecord.events || record.events || [],
        });
      }
    } catch (err) {
      console.warn('Could not load extra report details:', err);
    } finally {
      setIsLoadingReportDetails(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <AppShell
      title="Attendance & Leave Management"
      subtitle="Shift compliance, immutable attendance events, and auditable leave balance ledger."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={`/api/v1/companies/${companySlug}/attendance/export`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 text-slate-700"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </a>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-3.5 py-1.5 bg-[#F95716] text-white rounded-lg text-sm font-semibold hover:bg-[#e0480a] flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-6 max-w-7xl mx-auto relative">
        {/* SWR Subtle Revalidation Progress Bar */}
        {isValidating && (
          <div className="h-0.5 -mt-6 -mx-6 mb-4 bg-slate-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {/* Banner Alert Messages */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start justify-between text-red-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start justify-between text-emerald-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Control Bar: Today's Shift & Active Attendance Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Shift & Calendar Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Shift</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-[#F95716] border border-orange-200">
                  {todayShift?.name || 'Standard Shift'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                {workDate ? new Date(workDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Shift Hours: <span className="font-medium text-slate-700">{todayShift?.start_time || '09:00'} - {todayShift?.end_time || '18:00'}</span> (Grace: {todayShift?.grace_period_minutes || 15}m)
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Status:</span>
              <span className={`font-semibold capitalize px-2 py-0.5 rounded-md ${
                todayRecord?.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                todayRecord?.status === 'late' ? 'bg-amber-50 text-amber-700' :
                todayRecord?.status === 'on_leave' ? 'bg-blue-50 text-blue-700' :
                todayRecord?.status === 'clocked_out' ? 'bg-slate-100 text-slate-700' :
                'bg-slate-50 text-slate-500'
              }`}>
                {todayRecord ? todayRecord.status.replace('_', ' ') : 'Not Clocked In'}
              </span>
            </div>
          </div>

          {/* 2. Clock-In / Clock-Out Desktop Telemetry & Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between lg:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {canCaptureScreenshot ? 'Attendance Telemetry & Workforce Overview' : 'Attendance Status & Telemetry'}
                </span>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <div className={`w-3 h-3 rounded-full ${
                    todayRecord?.first_clock_in_at && !todayRecord?.last_clock_out_at
                      ? 'bg-emerald-500 animate-pulse'
                      : todayRecord?.last_clock_out_at
                      ? 'bg-blue-500'
                      : 'bg-slate-300'
                  }`} />
                  <span className="text-lg font-bold text-slate-900">
                    {todayRecord?.first_clock_in_at && !todayRecord?.last_clock_out_at
                      ? 'Actively Clocked In'
                      : todayRecord?.last_clock_out_at
                      ? 'Shift Completed & Clocked Out'
                      : 'Not Clocked In'}
                  </span>
                  {canCaptureScreenshot && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {activeEmployeesCount} Active Member{activeEmployeesCount !== 1 ? 's' : ''} Online
                    </span>
                  )}
                </div>
              </div>

              {/* Time Details */}
              <div className="flex items-center gap-4 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Clocked In</div>
                  <div className="font-semibold text-slate-800">
                    {todayRecord?.first_clock_in_at ? new Date(todayRecord.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Clocked Out</div>
                  <div className="font-semibold text-slate-800">
                    {todayRecord?.last_clock_out_at ? new Date(todayRecord.last_clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Worked</div>
                  <div className="font-semibold text-emerald-600">
                    {todayRecord ? formatSeconds(todayRecord.worked_seconds) : '0h 0m'}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance actions (clock in / clock out happen in the desktop tracker) */}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
                <Laptop className="w-4 h-4 text-[#F95716] shrink-0" />
                <span>Attendance is recorded by the Finovo Desktop Tracker</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 *:whitespace-nowrap">
                {todayRecord && (
                  <button
                    type="button"
                    onClick={() => handleViewDayReport(todayRecord)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/80 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Today Report</span>
                  </button>
                )}

                {canCaptureScreenshot && todayRecord && (
                  <button
                    type="button"
                    onClick={() => handleTakeScreenshot(todayRecord)}
                    disabled={
                      !Boolean(
                        todayRecord.first_clock_in_at &&
                        !todayRecord.last_clock_out_at &&
                        (todayRecord.status === 'present' || todayRecord.status === 'late' || todayRecord.status === 'clocked_in')
                      ) || capturingScreenshotRecordId === todayRecord.id
                    }
                    title={
                      Boolean(
                        todayRecord.first_clock_in_at &&
                        !todayRecord.last_clock_out_at &&
                        (todayRecord.status === 'present' || todayRecord.status === 'late' || todayRecord.status === 'clocked_in')
                      )
                        ? "Capture screen (Employee actively clocked in)"
                        : "Screenshot disabled: Employee must be actively clocked in"
                    }
                    className={`px-3 py-1.5 font-semibold text-xs rounded-xl border flex items-center gap-1.5 transition ${
                      Boolean(
                        todayRecord.first_clock_in_at &&
                        !todayRecord.last_clock_out_at &&
                        (todayRecord.status === 'present' || todayRecord.status === 'late' || todayRecord.status === 'clocked_in')
                      )
                        ? 'bg-orange-50 hover:bg-orange-100 text-[#F95716] border-orange-200 cursor-pointer shadow-2xs'
                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{capturingScreenshotRecordId === todayRecord.id ? 'Capturing...' : 'Take Screenshot'}</span>
                  </button>
                )}

                <span
                  className={`px-3 py-1.5 font-semibold text-xs rounded-xl border flex items-center gap-1.5 ${
                    todayRecord?.first_clock_in_at && !todayRecord?.last_clock_out_at
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                  title="Clock in and clock out from the Finovo Desktop Tracker"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {todayRecord?.first_clock_in_at && !todayRecord?.last_clock_out_at
                      ? 'Clocked in via Desktop Tracker'
                      : 'Clock in from Desktop Tracker'}
                  </span>
                </span>

                <Link
                  to={`/app/${companySlug}/download-tracker`}
                  className="px-3.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#F95716] font-semibold text-xs rounded-xl border border-orange-200/80 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Desktop App</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    if (todayRecord) {
                      setCorrectionTargetRecordId(todayRecord.id);
                    }
                    setShowCorrectionModal(true);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline transition cursor-pointer ml-1"
                >
                  Correction
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'attendance'
                ? 'border-[#F95716] text-[#F95716] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            {canCaptureScreenshot ? 'Live Attendance Ledger' : 'My Attendance Ledger'}
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'leave'
                ? 'border-[#F95716] text-[#F95716] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Leave & Balances
          </button>
          {canCaptureScreenshot && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'approvals'
                  ? 'border-[#F95716] text-[#F95716] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Leave Approvals Queue
              {pendingApprovals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#F95716] text-white">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* TAB 1: ATTENDANCE LEDGER */}
        {activeTab === 'attendance' && (
          canCaptureScreenshot && attendanceViewMode === 'team' ? (
            <div className="space-y-4">
              {/* Live Team & Employee Attendance Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/50 to-orange-50/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100/80 border border-orange-200/60 flex items-center justify-center text-[#F95716] shadow-2xs">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">Live Employee Attendance &amp; Telemetry</h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          {activeEmployeesCount} Active Now
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Real-time workforce presence, shift compliance &amp; remote desktop screen capture
                      </p>
                    </div>
                  </div>

                  {/* Toggle between Team Attendance and My Attendance */}
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-slate-100 rounded-xl flex items-center text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setAttendanceViewMode('team')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          attendanceViewMode === 'team'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        All Employees ({teamAttendance.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceViewMode('my')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          attendanceViewMode === 'my'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        My Attendance
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadData(true)}
                      className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
                      title="Force refresh live team records"
                    >
                      <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin text-[#F95716]' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-3.5 px-5">Employee</th>
                        <th className="py-3.5 px-4">Shift</th>
                        <th className="py-3.5 px-4">Clock In</th>
                        <th className="py-3.5 px-4">Clock Out</th>
                        <th className="py-3.5 px-4">Duration</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {teamAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <span>No employee attendance records logged for today yet.</span>
                          </td>
                        </tr>
                      ) : (
                        teamAttendance.map((rec) => {
                          const isActivelyClockedIn = Boolean(
                            rec.first_clock_in_at &&
                            !rec.last_clock_out_at &&
                            rec.status !== 'clocked_out' &&
                            rec.status !== 'early_departure' &&
                            rec.status !== 'partial_attendance' &&
                            (rec.status === 'present' || rec.status === 'late' || rec.status === 'clocked_in')
                          );
                          const isClockedOut = Boolean(
                            rec.last_clock_out_at ||
                            rec.status === 'clocked_out' ||
                            rec.status === 'early_departure' ||
                            rec.status === 'partial_attendance'
                          );
                          const employeeName = rec.membership?.user?.name || 'Employee';
                          const employeeEmail = rec.membership?.user?.email || '';

                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/60 transition group">
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-[#F95716] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                                    {employeeName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                      <span>{employeeName}</span>
                                      {isActivelyClockedIn && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Session" />
                                      )}
                                    </div>
                                    {employeeEmail && (
                                      <div className="text-[11px] text-slate-400">{employeeEmail}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                <div className="font-semibold text-slate-800">{rec.shift?.name || 'Standard Shift'}</div>
                                <div className="text-[10px] text-slate-400">
                                  {rec.shift?.start_time ? `${rec.shift.start_time.slice(0, 5)} - ${rec.shift.end_time?.slice(0, 5)}` : '09:00 - 18:00'}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                {rec.first_clock_in_at ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-100/80 text-emerald-800 font-bold">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{new Date(rec.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono">--:--</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {rec.last_clock_out_at ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{new Date(rec.last_clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                ) : isActivelyClockedIn ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">--:--</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                {formatSeconds(rec.worked_seconds)}
                              </td>
                              <td className="py-3.5 px-4">
                                {isActivelyClockedIn ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Actively Clocked In</span>
                                  </span>
                                ) : isClockedOut ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    <span>Clocked Out</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-slate-50 text-slate-500 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    <span>Not Clocked In</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleTakeScreenshot(rec)}
                                    disabled={!isActivelyClockedIn || capturingScreenshotRecordId === rec.id}
                                    title={
                                      isActivelyClockedIn
                                        ? `Capture live screen of ${employeeName}`
                                        : 'Available after the employee clocks in'
                                    }
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                                      isActivelyClockedIn
                                        ? 'bg-gradient-to-r from-orange-500 to-[#F95716] hover:from-orange-600 hover:to-[#e0480a] text-white shadow-xs cursor-pointer active:scale-95 disabled:opacity-75'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    }`}
                                  >
                                    <Camera className={`w-3.5 h-3.5 ${capturingScreenshotRecordId === rec.id ? 'animate-spin' : ''}`} />
                                    <span>{capturingScreenshotRecordId === rec.id ? 'Capturing...' : 'Take Screenshot'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleViewDayReport(rec)}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Custom Calendar Widget Matching Exact Reference Design */}
              <div className="lg:col-span-4 flex flex-col items-center">
                <div className="w-full max-w-[320px] mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Attendance Visualizer</h4>
                    <p className="text-[11px] text-slate-400">Monthly presence and punctuality status</p>
                  </div>
                  {canCaptureScreenshot && (
                    <button
                      type="button"
                      onClick={() => setAttendanceViewMode('team')}
                      className="text-xs font-bold text-[#F95716] hover:underline"
                    >
                      &larr; Team View
                    </button>
                  )}
                </div>
                <CustomCalendar
                  dateStatuses={Object.keys(calendarDateStatuses).length > 0 ? calendarDateStatuses : undefined}
                  showLegend={true}
                  className="w-full max-w-[320px]"
                />
              </div>

              {/* Right Column: Attendance History Log Table */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-sm">Personal Attendance History Log</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Authoritative server evaluated work dates</span>
                    {canCaptureScreenshot && (
                      <button
                        type="button"
                        onClick={() => setAttendanceViewMode('team')}
                        className="px-2.5 py-1 bg-orange-50 text-[#F95716] font-bold text-xs rounded-lg hover:bg-orange-100 transition"
                      >
                        Switch to Team View
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Work Date</th>
                        <th className="py-3 px-4">Shift</th>
                        <th className="py-3 px-4">Clock In</th>
                        <th className="py-3 px-4">Clock Out</th>
                        <th className="py-3 px-4">Worked</th>
                        <th className="py-3 px-4">Lateness</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {historyRecords.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            No attendance records found.
                          </td>
                        </tr>
                      ) : (
                        historyRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900">{r.work_date}</td>
                            <td className="py-3 px-4 text-slate-600">{r.shift?.name || 'Standard'}</td>
                            <td className="py-3 px-4">
                              {r.first_clock_in_at ? new Date(r.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </td>
                            <td className="py-3 px-4">
                              {r.last_clock_out_at ? new Date(r.last_clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </td>
                            <td className="py-3 px-4 font-medium text-emerald-600">{formatSeconds(r.worked_seconds)}</td>
                            <td className="py-3 px-4 text-amber-600">
                              {r.late_seconds > 0 ? `${Math.round(r.late_seconds / 60)}m` : '0m'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded font-semibold text-[11px] capitalize ${
                                r.status === 'present' || r.status === 'clocked_out' ? 'bg-emerald-50 text-emerald-700' :
                                r.status === 'late' ? 'bg-amber-50 text-amber-700' :
                                r.status === 'on_leave' ? 'bg-blue-50 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {r.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleViewDayReport(r)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-semibold rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Report</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        )}

        {/* TAB 2: LEAVE & BALANCES */}
        {activeTab === 'leave' && (
          <div className="space-y-6">
            {/* Visual Balances Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {leaveBalances.map((b) => (
                <div
                  key={b.leave_type.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between"
                  style={{ borderTop: `4px solid ${b.leave_type.color || '#F95716'}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-bold text-slate-900 text-sm">{b.leave_type.name}</h5>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                      {b.leave_type.code}
                    </span>
                  </div>

                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-slate-900">{b.available_days}</span>
                    <span className="text-xs text-slate-500 ml-1">days available</span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Allowance / Opening:</span>
                      <span className="font-semibold text-slate-700">{b.opening_days}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <span className="font-semibold text-rose-600">{b.used_days}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Reservation:</span>
                      <span className="font-semibold text-amber-600">{b.reserved_days}d</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* My Requests List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm">My Leave Requests</h4>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="text-xs font-bold text-[#F95716] hover:underline"
                >
                  + New Request
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Leave Type</th>
                      <th className="py-3 px-4">Date Range</th>
                      <th className="py-3 px-4">Units</th>
                      <th className="py-3 px-4">Portion</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                          No leave requests submitted yet.
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">{req.leave_type?.name}</td>
                          <td className="py-3 px-4">
                            {req.start_date} to {req.end_date}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{req.requested_units} days</td>
                          <td className="py-3 px-4 capitalize">{req.day_portion.replace('_', ' ')}</td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[11px] capitalize ${
                              req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              req.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                              req.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {req.status === 'pending' || req.status === 'submitted' ? (
                              <button
                                onClick={() => handleCancelLeave(req.id)}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
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

        {/* TAB 3: APPROVALS & TEAM (MANAGERS & HR) */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {/* Separation of Duties Notice */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>Separation of Duties Enforced:</strong> The Finovo governance engine strictly prohibits self-approval. Managers and HR reviewers can only decide requests submitted by other employees.
              </span>
            </div>

            {/* Pending Requests Queue */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm">Pending Leave Approval Queue</h4>
                <span className="text-xs font-bold text-slate-500">
                  {pendingApprovals.length} requests awaiting review
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Leave Type</th>
                      <th className="py-3 px-4">Dates</th>
                      <th className="py-3 px-4">Units</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pendingApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          No pending leave requests in your approval queue.
                        </td>
                      </tr>
                    ) : (
                      pendingApprovals.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {req.membership?.user?.name || 'Employee'}
                          </td>
                          <td className="py-3 px-4">{req.leave_type?.name}</td>
                          <td className="py-3 px-4">
                            {req.start_date} to {req.end_date}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{req.requested_units}d</td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setReviewModalRequest(req)}
                              className="px-3 py-1 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg text-xs transition"
                            >
                              Review & Decide
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Monitoring Quick Link */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200/80 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F95716] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Live Workforce Attendance &amp; Screen Monitoring</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    View today's live team attendance, active work sessions, and capture remote employee screenshots directly on the primary ledger.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('attendance');
                  setAttendanceViewMode('team');
                }}
                className="px-4 py-2 bg-[#F95716] hover:bg-[#e0480a] text-white font-bold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <span>Open Live Team Ledger</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: REQUEST LEAVE */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Request Leave of Absence</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Leave Category</label>
                <select
                  value={selectedLeaveTypeId}
                  onChange={(e) => setSelectedLeaveTypeId(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  required
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.is_paid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CustomDatePicker
                  label="Start Date"
                  value={leaveStartDate}
                  onChange={setLeaveStartDate}
                  placeholder="Select start date"
                  required
                />
                <CustomDatePicker
                  label="End Date"
                  value={leaveEndDate}
                  onChange={setLeaveEndDate}
                  placeholder="Select end date"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Day Portion</label>
                <select
                  value={leaveDayPortion}
                  onChange={(e) => setLeaveDayPortion(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                >
                  <option value="full">Full Day (1.0 day/day)</option>
                  <option value="first_half">First Half (0.5 day/day)</option>
                  <option value="second_half">Second Half (0.5 day/day)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Absence</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                  placeholder="Provide details for review..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#F95716] hover:bg-[#e0480a] text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REVIEW DECISION */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Decide Leave Request</h3>
              <button onClick={() => setReviewModalRequest(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-slate-600">
                <div><strong>Employee:</strong> {reviewModalRequest.membership?.user?.name}</div>
                <div><strong>Category:</strong> {reviewModalRequest.leave_type?.name}</div>
                <div><strong>Dates:</strong> {reviewModalRequest.start_date} to {reviewModalRequest.end_date} ({reviewModalRequest.requested_units} days)</div>
                <div><strong>Reason:</strong> {reviewModalRequest.reason}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision Note / Feedback</label>
                <textarea
                  value={reviewDecisionReason}
                  onChange={(e) => setReviewDecisionReason(e.target.value)}
                  rows={2}
                  placeholder="Optional review reason or explanation..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewModalRequest(null)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewLeave('reject')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewLeave('approve')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  Approve Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DAY ATTENDANCE & TIME REPORT */}
      <AttendanceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        record={selectedReportRecord}
        isLoading={isLoadingReportDetails}
        onTakeScreenshot={handleTakeScreenshot}
        isCapturingScreenshot={capturingScreenshotRecordId === selectedReportRecord?.id}
        onPreviewScreenshot={(s) => setActiveScreenshotPreview(s)}
        formatSeconds={formatSeconds}
        canCaptureScreenshot={canCaptureScreenshot}
      />

      {/* MODAL 5: FULL-SCREEN SCREENSHOT PREVIEW LIGHTBOX */}
      <ScreenshotLightboxModal
        screenshot={activeScreenshotPreview}
        onClose={() => setActiveScreenshotPreview(null)}
      />

      {/* MODAL 3: ATTENDANCE CORRECTION */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Request Attendance Correction</h3>
              <button onClick={() => setShowCorrectionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Attendance Record</label>
                <select
                  value={correctionTargetRecordId}
                  onChange={(e) => setCorrectionTargetRecordId(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  required
                >
                  <option value="">Select date to amend...</option>
                  {historyRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.work_date} (Status: {r.status}, Clock-in: {r.first_clock_in_at ? new Date(r.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Proposed Clock-In</label>
                  <input
                    type="datetime-local"
                    value={correctionProposedIn}
                    onChange={(e) => setCorrectionProposedIn(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Proposed Clock-Out</label>
                  <input
                    type="datetime-local"
                    value={correctionProposedOut}
                    onChange={(e) => setCorrectionProposedOut(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Correction Reason & Proof</label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. System offline / badge swipe not recorded / emergency leave..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F95716] outline-none"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#F95716] hover:bg-[#e0480a] text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

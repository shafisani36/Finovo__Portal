import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { useConfirm } from '../context/ConfirmationModalContext';
import { dataPipeline } from '../lib/dataPipeline';
import { CustomCalendar, CustomDatePicker, DayStatus } from '../components/ui/CustomCalendar';

interface Shift {
  id: number;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_overnight: boolean;
}

interface AttendanceBreak {
  id: number;
  break_type: string;
  is_paid: boolean;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
}

interface AttendanceRecord {
  id: number;
  work_date: string;
  status: 'not_clocked_in' | 'present' | 'late' | 'early_departure' | 'partial_attendance' | 'on_leave' | 'absent' | 'clocked_out';
  first_clock_in_at?: string;
  last_clock_out_at?: string;
  worked_seconds: number;
  late_seconds: number;
  early_departure_seconds: number;
  shift?: Shift;
  breaks?: AttendanceBreak[];
  membership?: { user?: { name: string; email: string } };
}

interface LeaveType {
  id: number;
  name: string;
  code: string;
  is_paid: boolean;
  requires_balance: boolean;
  allow_half_day: boolean;
  color: string;
  max_consecutive_days: number;
}

interface LeaveBalance {
  leave_type: LeaveType;
  year: number;
  opening_days: number;
  accrued_days: number;
  used_days: number;
  reserved_days: number;
  adjusted_days: number;
  available_days: number;
}

interface LeaveRequest {
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

interface CorrectionRequest {
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

  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'approvals' | 'corrections' | 'reports'>('attendance');

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

      // Store in high-performance cache pipeline
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
      }, 120000);
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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Status & Telemetry</span>
                <div className="flex items-center gap-3 mt-1">
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

            {/* Desktop-Only Notice & Download / Correction Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Laptop className="w-4 h-4 text-[#F95716] shrink-0" />
                <span>
                  <strong>Notice:</strong> Clock-in, breaks, and time tracking are available exclusively via the <strong>Finovo Global Desktop Application</strong>.
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/app/${companySlug}/download-tracker`}
                  className="px-3.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#F95716] font-semibold text-xs rounded-xl border border-orange-200/80 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Desktop App</span>
                </Link>

                <button
                  onClick={() => {
                    if (todayRecord) {
                      setCorrectionTargetRecordId(todayRecord.id);
                    }
                    setShowCorrectionModal(true);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
                >
                  Request Correction
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
            My Attendance Ledger
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
          <button
            onClick={() => setActiveTab('approvals')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'approvals'
                ? 'border-[#F95716] text-[#F95716] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Manager Approvals & Team
            {pendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#F95716] text-white">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: ATTENDANCE LEDGER */}
        {activeTab === 'attendance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Custom Calendar Widget Matching Exact Reference Design */}
            <div className="lg:col-span-4 flex flex-col items-center">
              <div className="w-full max-w-[320px] mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Attendance Visualizer</h4>
                  <p className="text-[11px] text-slate-400">Monthly presence and punctuality status</p>
                </div>
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
                <h4 className="font-bold text-slate-800 text-sm">Attendance History Log</h4>
                <span className="text-xs text-slate-400">Authoritative server evaluated work dates</span>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {historyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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

            {/* Team Attendance Today */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm">Team Attendance Today</h4>
                <span className="text-xs text-slate-400">Authorized department members</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Clock In</th>
                      <th className="py-3 px-4">Clock Out</th>
                      <th className="py-3 px-4">Worked</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {teamAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                          No team attendance records logged for today.
                        </td>
                      </tr>
                    ) : (
                      teamAttendance.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {rec.membership?.user?.name || 'Member'}
                          </td>
                          <td className="py-3 px-4">
                            {rec.first_clock_in_at ? new Date(rec.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td className="py-3 px-4">
                            {rec.last_clock_out_at ? new Date(rec.last_clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-600">{formatSeconds(rec.worked_seconds)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[11px] capitalize ${
                              rec.status === 'present' || rec.status === 'clocked_out' ? 'bg-emerald-50 text-emerald-700' :
                              rec.status === 'late' ? 'bg-amber-50 text-amber-700' :
                              rec.status === 'on_leave' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {rec.status.replace('_', ' ')}
                            </span>
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

import React from 'react';
import {
  X,
  Clock,
  Coffee,
  Camera,
  ZoomIn,
  RefreshCw,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import type { AttendanceRecord, ScreenshotItem } from '../../pages/AttendanceLeavePage';
import { normalizeImageUrl } from './ScreenshotLightboxModal';

interface AttendanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  isLoading?: boolean;
  onTakeScreenshot?: (record: AttendanceRecord) => void;
  isCapturingScreenshot?: boolean;
  onPreviewScreenshot: (screenshot: ScreenshotItem) => void;
  formatSeconds: (sec: number) => string;
  canCaptureScreenshot?: boolean;
}

export const AttendanceReportModal: React.FC<AttendanceReportModalProps> = ({
  isOpen,
  onClose,
  record,
  isLoading = false,
  onTakeScreenshot,
  isCapturingScreenshot = false,
  onPreviewScreenshot,
  formatSeconds,
  canCaptureScreenshot = false,
}) => {
  if (!isOpen || !record) return null;

  const isClockedIn = Boolean(
    record.first_clock_in_at &&
    !record.last_clock_out_at &&
    (record.status === 'present' || record.status === 'late' || record.status === 'clocked_in')
  );

  const formattedDate = record.work_date
    ? new Date(record.work_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Selected Work Date';

  const screenshots = record.screenshots || [];
  const breaks = record.breaks || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full my-8 p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Attendance &amp; Time Report
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                  record.status === 'present' || record.status === 'clocked_out'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : record.status === 'late'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {record.status.replace('_', ' ')}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>{formattedDate}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Employee: <strong className="text-slate-800">{record.membership?.user?.name || 'Active Member'}</strong>{' '}
              &bull; Shift: <span className="font-semibold text-slate-700">{record.shift?.name || 'Standard'}</span>{' '}
              ({record.shift?.start_time || '09:00'} - {record.shift?.end_time || '18:00'})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="py-2.5 px-4 my-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Retrieving complete session telemetry &amp; captures...</span>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/90">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock In (Login)</span>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {record.first_clock_in_at
                ? new Date(record.first_clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Session Started</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/90">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock Out (Logout)</span>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {record.last_clock_out_at
                ? new Date(record.last_clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : record.first_clock_in_at
                ? 'In Progress'
                : '--:--'}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {record.last_clock_out_at ? 'Session Ended' : 'Active'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Worked</span>
            <div className="text-base font-extrabold text-emerald-700 mt-1">
              {formatSeconds(record.worked_seconds)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Net Productive</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Punctuality</span>
            <div className="text-base font-extrabold text-amber-700 mt-1">
              {record.late_seconds > 0 ? `${Math.round(record.late_seconds / 60)}m Late` : 'On Time'}
            </div>
            <span className="text-[11px] text-amber-600 font-medium">Shift Compliance</span>
          </div>
        </div>

        {/* Breaks Table if any */}
        {breaks.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-slate-500" />
              <span>Breaks Summary ({breaks.length})</span>
            </h4>
            <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Break Type</th>
                    <th className="py-2 px-3">Started</th>
                    <th className="py-2 px-3">Ended</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {breaks.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 px-3 capitalize font-semibold">{b.break_type}</td>
                      <td className="py-2 px-3">
                        {new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3">
                        {b.ended_at
                          ? new Date(b.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'In Progress'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{formatSeconds(b.duration_seconds)}</td>
                      <td className="py-2 px-3">{b.is_paid ? 'Paid Break' : 'Unpaid Break'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN SCREENSHOTS SECTION */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#F95716]" />
                <span>Admin Screen Captures</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-[#F95716]">
                  {screenshots.length}
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Screenshots captured by administrator to monitor active employee work activity
              </p>
            </div>

            {/* Quick Take Screenshot Button inside modal if actively clocked in */}
            {canCaptureScreenshot && isClockedIn && onTakeScreenshot && (
              <button
                type="button"
                onClick={() => onTakeScreenshot(record)}
                disabled={isCapturingScreenshot}
                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-[#F95716] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                {isCapturingScreenshot ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Capturing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Screenshot Now</span>
                  </>
                )}
              </button>
            )}
          </div>

          {screenshots.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                No screen captures recorded for this attendance session.
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                Admin can capture live employee desktop screenshots at any time while the employee is actively clocked in.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {screenshots.map((s, idx) => (
                <div
                  key={s.id || idx}
                  onClick={() => onPreviewScreenshot(s)}
                  className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs cursor-pointer hover:shadow-md transition"
                >
                  <div className="aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                    <img
                      src={normalizeImageUrl(s.url)}
                      alt="Session Screenshot"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <div className="p-2 rounded-full bg-white/95 text-slate-900 shadow-md flex items-center gap-1.5 text-xs font-bold">
                      <ZoomIn className="w-4 h-4 text-indigo-600" />
                      <span>View Full Image</span>
                    </div>
                  </div>

                  {/* Information Bar */}
                  <div className="p-2.5 bg-white border-t border-slate-100 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-700 font-semibold">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        {s.stored_at
                          ? new Date(s.stored_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : 'Captured'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {s.admin?.name ? `By ${s.admin.name}` : 'Admin'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};

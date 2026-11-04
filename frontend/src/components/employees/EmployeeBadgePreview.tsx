import React from 'react';
import { Clock, Check, FileCheck, UserPlus, Loader2 } from 'lucide-react';
import { DepartmentItem, DesignationItem } from './ShiftTimingCard';

export interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
}

export interface EmployeeBadgePreviewProps {
  name: string;
  email: string;
  employeeNumber: string;
  selectedDeptObj?: DepartmentItem;
  selectedDesigObj?: DesignationItem;
  roleSlug: string;
  workArrangement: string;
  initialStatus: string;
  shiftStartTime: string;
  shiftEndTime: string;
  workingDays: string[];
  shiftTimezone: string;
  readinessPercentage: number;
  readinessItems: ReadinessItem[];
  submitting: boolean;
  isValid: boolean;
  getInitials: (fullName: string) => string;
  formatTime12h: (timeStr: string) => string;
}

export const EmployeeBadgePreview: React.FC<EmployeeBadgePreviewProps> = ({
  name,
  email,
  employeeNumber,
  selectedDeptObj,
  selectedDesigObj,
  roleSlug,
  workArrangement,
  initialStatus,
  shiftStartTime,
  shiftEndTime,
  workingDays,
  shiftTimezone,
  readinessPercentage,
  readinessItems,
  submitting,
  isValid,
  getInitials,
  formatTime12h,
}) => {
  return (
    <div className="space-y-5 lg:sticky lg:top-20 font-['Inter',sans-serif]">
      {/* Live Profile Manifest Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold">
            LIVE PROFILE MANIFEST
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Digital Badge Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#F95716]/30 to-transparent rounded-bl-full pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/30">
              {getInitials(name)}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                EMP ID
              </span>
              <span className="font-mono text-xs font-bold text-orange-400">
                {employeeNumber || 'AUTO'}
              </span>
            </div>
          </div>

          <div className="mt-4 relative z-10">
            <h4 className="text-base font-bold text-white truncate font-['Plus_Jakarta_Sans',sans-serif]">
              {name || 'Employee Full Name'}
            </h4>
            <p className="text-xs text-slate-400 font-mono truncate">
              {email || 'employee.email@company.com'}
            </p>
          </div>

          {/* Shift Timing Banner on Badge */}
          <div className="mt-3 p-2 rounded-xl bg-white/10 border border-white/10 relative z-10">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-orange-300 font-medium flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-orange-400" />
                <span>{formatTime12h(shiftStartTime)} – {formatTime12h(shiftEndTime)}</span>
              </span>
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-200">
                {workingDays.length}d / wk
              </span>
            </div>
            <span className="text-[9.5px] text-slate-300 block mt-0.5 truncate font-mono">
              {workingDays.join(', ')} • {shiftTimezone.split('/')[1] || shiftTimezone}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px] relative z-10">
            <div>
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wider">
                Department
              </span>
              <span className="font-semibold text-orange-300 truncate block">
                {selectedDeptObj?.name || 'General Operations'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wider">
                Job Title
              </span>
              <span className="font-semibold text-slate-200 truncate block">
                {selectedDesigObj?.name || 'Team Member'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wider">
                Work Role
              </span>
              <span className="font-semibold text-slate-300 capitalize block">
                {roleSlug.replace('-', ' ')}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wider">
                Model
              </span>
              <span className="font-semibold text-slate-300 capitalize block">
                {workArrangement}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] relative z-10">
            <span className="text-slate-400">Status:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="capitalize">{initialStatus}</span>
            </span>
          </div>
        </div>

        {/* Progress & Readiness Meter */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Profile Readiness</span>
            <span className="font-mono font-bold text-[#F95716]">
              {readinessPercentage}%
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#FF5511] to-[#F95716] h-full rounded-full transition-all duration-300"
              style={{ width: `${readinessPercentage}%` }}
            />
          </div>

          <div className="space-y-1.5 pt-1 text-[11px]">
            {readinessItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-slate-600">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                    item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {item.done ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                </div>
                <span className={item.done ? 'font-medium text-slate-800' : ''}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Automated Day 1-7 Onboarding Pipeline Notice */}
        <div className="p-3.5 rounded-2xl bg-orange-50/50 border border-orange-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#F95716] font-bold text-[11px]">
            <FileCheck className="w-3.5 h-3.5" />
            <span>AUTOMATED ONBOARDING PIPELINE</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Upon creation, Finovo links the shift schedule to daily attendance records and provisions 4 standard onboarding tasks automatically.
          </p>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          form="create-employee-form"
          disabled={submitting || !isValid}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Provisioning Employee...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 stroke-[2.4]" />
              <span>Confirm &amp; Create Employee</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};


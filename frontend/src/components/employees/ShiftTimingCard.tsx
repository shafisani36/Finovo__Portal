import React, { useMemo } from 'react';
import {
  Clock,
  Sun,
  Moon,
  Coffee,
  Check,
  Globe,
  Timer,
  Utensils,
} from 'lucide-react';
import { CustomDropdown, SelectOption } from '../ui/CustomDropdown';

export interface ShiftItem {
  id: number;
  name: string;
  code?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  grace_period_minutes?: number;
  break_duration_minutes?: number;
}

export const SHIFT_PRESETS = [
  {
    id: 'std_day',
    name: 'Standard Day Shift',
    code: 'STD-0918',
    startTime: '09:00',
    endTime: '18:00',
    label: '09:00 AM – 06:00 PM',
    icon: Sun,
    description: 'Standard 9-hour corporate schedule (1h lunch)',
  },
  {
    id: 'early_morning',
    name: 'Morning Shift',
    code: 'MORN-0817',
    startTime: '08:00',
    endTime: '17:00',
    label: '08:00 AM – 05:00 PM',
    icon: Sun,
    description: 'Early morning corporate operations schedule',
  },
  {
    id: 'mid_shift',
    name: 'Afternoon / Mid Shift',
    code: 'MID-1322',
    startTime: '13:00',
    endTime: '22:00',
    label: '01:00 PM – 10:00 PM',
    icon: Clock,
    description: 'Mid-day & evening coverage schedule',
  },
  {
    id: 'night_graveyard',
    name: 'Night / Graveyard Shift',
    code: 'NGHT-2106',
    startTime: '21:00',
    endTime: '06:00',
    label: '09:00 PM – 06:00 AM',
    icon: Moon,
    description: 'Overnight operations & global support coverage',
  },
  {
    id: 'flexible',
    name: 'Flexible Hours (Core Hours)',
    code: 'FLEX-1016',
    startTime: '10:00',
    endTime: '16:00',
    label: '10:00 AM – 04:00 PM (Core)',
    icon: Coffee,
    description: 'Autonomous schedule with required core hours',
  },
];

export const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)', description: 'EST/EDT • UTC-05:00', badge: 'EST' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)', description: 'CST/CDT • UTC-06:00', badge: 'CST' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)', description: 'MST/MDT • UTC-07:00', badge: 'MST' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', description: 'PST/PDT • UTC-08:00', badge: 'PST' },
  { value: 'Europe/London', label: 'London, Edinburgh, Dublin', description: 'GMT/BST • UTC+00:00', badge: 'GMT' },
  { value: 'Europe/Berlin', label: 'Amsterdam, Berlin, Paris, Rome', description: 'CET/CEST • UTC+01:00', badge: 'CET' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat', description: 'GST • UTC+04:00', badge: 'GST' },
  { value: 'Asia/Karachi', label: 'Islamabad, Karachi, Tashkent', description: 'PKT • UTC+05:00', badge: 'PKT' },
  { value: 'Asia/Kolkata', label: 'Chennai, Kolkata, Mumbai, New Delhi', description: 'IST • UTC+05:30', badge: 'IST' },
  { value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur, Hong Kong', description: 'SGT/HKT • UTC+08:00', badge: 'SGT' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Osaka, Sapporo, Seoul', description: 'JST/KST • UTC+09:00', badge: 'JST' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra', description: 'AEST/AEDT • UTC+10:00', badge: 'AEST' },
  { value: 'UTC', label: 'Coordinated Universal Time', description: 'UTC standard reference time', badge: 'UTC' },
];

export const GRACE_PERIOD_OPTIONS: SelectOption[] = [
  { value: '0', label: '0 minutes (Strict)', description: 'No late tolerance allowed', badge: 'Strict' },
  { value: '5', label: '5 minutes', description: 'Short tolerance window', badge: '5m' },
  { value: '10', label: '10 minutes', description: 'Moderate grace interval', badge: '10m' },
  { value: '15', label: '15 minutes (Standard)', description: 'Corporate standard tolerance', badge: 'Standard' },
  { value: '30', label: '30 minutes', description: 'Generous flex window', badge: '30m' },
  { value: '45', label: '45 minutes', description: 'Extended grace buffer', badge: '45m' },
];

export const BREAK_DURATION_OPTIONS: SelectOption[] = [
  { value: '30', label: '30 minutes (Half Hour)', description: 'Quick lunch/snack break', badge: '30m' },
  { value: '45', label: '45 minutes', description: 'Extended lunch break', badge: '45m' },
  { value: '60', label: '60 minutes (1 Hour)', description: 'Standard corporate lunch hour', badge: '1 Hour' },
  { value: '90', label: '90 minutes (1.5 Hours)', description: 'Extended executive/workout break', badge: '1.5h' },
];

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generate 30-minute intervals for 24 hours
const GENERATED_TIME_SLOTS: SelectOption[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hhStr = h.toString().padStart(2, '0');
    const mmStr = m.toString().padStart(2, '0');
    const value = `${hhStr}:${mmStr}`;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const label = `${hour12.toString().padStart(2, '0')}:${mmStr} ${period}`;
    const desc = h < 6 ? 'Early Morning' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
    GENERATED_TIME_SLOTS.push({
      value,
      label,
      description: `${desc} slot (${value})`,
      badge: period,
    });
  }
}

export interface ShiftTimingCardProps {
  shiftSelectionMode: 'preset' | 'existing' | 'custom';
  setShiftSelectionMode: (mode: 'preset' | 'existing' | 'custom') => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  availableShifts: ShiftItem[];
  selectedShiftId: string;
  onSelectExistingShift: (shift: ShiftItem) => void;
  shiftStartTime: string;
  setShiftStartTime: (val: string) => void;
  shiftEndTime: string;
  setShiftEndTime: (val: string) => void;
  shiftTimezone: string;
  setShiftTimezone: (val: string) => void;
  workingDays: string[];
  onToggleWorkingDay: (day: string) => void;
  gracePeriodMinutes: string;
  setGracePeriodMinutes: (val: string) => void;
  breakDurationMinutes: string;
  setBreakDurationMinutes: (val: string) => void;
  formatTime12h: (timeStr: string) => string;
}

export const ShiftTimingCard: React.FC<ShiftTimingCardProps> = ({
  shiftSelectionMode,
  setShiftSelectionMode,
  selectedPresetId,
  onSelectPreset,
  availableShifts,
  selectedShiftId,
  onSelectExistingShift,
  shiftStartTime,
  setShiftStartTime,
  shiftEndTime,
  setShiftEndTime,
  shiftTimezone,
  setShiftTimezone,
  workingDays,
  onToggleWorkingDay,
  gracePeriodMinutes,
  setGracePeriodMinutes,
  breakDurationMinutes,
  setBreakDurationMinutes,
  formatTime12h,
}) => {
  // Ensure current start time is in the options list if custom
  const startTimeOptions = useMemo(() => {
    const exists = GENERATED_TIME_SLOTS.some((o) => o.value === shiftStartTime);
    if (!exists && shiftStartTime) {
      return [
        {
          value: shiftStartTime,
          label: formatTime12h(shiftStartTime),
          description: `Custom start (${shiftStartTime})`,
          badge: 'Custom',
        },
        ...GENERATED_TIME_SLOTS,
      ];
    }
    return GENERATED_TIME_SLOTS;
  }, [shiftStartTime, formatTime12h]);

  // Ensure current end time is in the options list if custom
  const endTimeOptions = useMemo(() => {
    const exists = GENERATED_TIME_SLOTS.some((o) => o.value === shiftEndTime);
    if (!exists && shiftEndTime) {
      return [
        {
          value: shiftEndTime,
          label: formatTime12h(shiftEndTime),
          description: `Custom end (${shiftEndTime})`,
          badge: 'Custom',
        },
        ...GENERATED_TIME_SLOTS,
      ];
    }
    return GENERATED_TIME_SLOTS;
  }, [shiftEndTime, formatTime12h]);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-orange-200/90 shadow-2xs space-y-5 relative overflow-hidden font-['Inter',sans-serif]">
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-orange-400/5 via-amber-400/5 to-transparent rounded-bl-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 relative z-10 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
            2
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Shift Timing &amp; Work Schedule
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#F95716] text-[10px] font-bold">
                ATTENDANCE &amp; TIMING
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure daily working hours, grace periods, lunch breaks, and active schedule days
            </p>
          </div>
        </div>

        {/* Shift Mode Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
          <button
            type="button"
            onClick={() => setShiftSelectionMode('preset')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              shiftSelectionMode === 'preset'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Presets
          </button>
          {availableShifts.length > 0 && (
            <button
              type="button"
              onClick={() => setShiftSelectionMode('existing')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                shiftSelectionMode === 'existing'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Company Shifts ({availableShifts.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShiftSelectionMode('custom')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              shiftSelectionMode === 'custom'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Custom Hours
          </button>
        </div>
      </div>

      {/* Mode A: Presets */}
      {shiftSelectionMode === 'preset' && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Choose Schedule Preset
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SHIFT_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => onSelectPreset(preset.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#F95716] bg-orange-50/30 ring-2 ring-[#F95716]/15'
                      : 'border-slate-200/80 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-[#F95716]' : 'text-slate-400'}`} />
                        <span>{preset.name}</span>
                      </span>
                      <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                        {preset.code}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      {preset.label}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{preset.description}</p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">9 hrs (1h break)</span>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-[#F95716] bg-[#F95716] text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode B: Existing Company Shifts */}
      {shiftSelectionMode === 'existing' && availableShifts.length > 0 && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Select Active Company Shift
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableShifts.map((shift) => {
              const isSelected = selectedShiftId === String(shift.id);
              return (
                <div
                  key={shift.id}
                  onClick={() => onSelectExistingShift(shift)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#F95716] bg-orange-50/30 ring-2 ring-[#F95716]/15'
                      : 'border-slate-200/80 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{shift.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {shift.code || `SHIFT-${shift.id}`}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      {formatTime12h(shift.start_time)} – {formatTime12h(shift.end_time)}
                    </div>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      TZ: {shift.timezone || 'UTC'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shift Timing Details Inputs USING CustomDropdown */}
      <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clock In Custom Dropdown */}
        <div>
          <CustomDropdown
            label="Clock-In / Start Time"
            value={shiftStartTime}
            onChange={setShiftStartTime}
            options={startTimeOptions}
            placeholder="Select Start Time"
            searchable
            searchPlaceholder="Search hour (e.g. 09:00)..."
            leadingIcon={<Clock className="w-3.5 h-3.5 text-orange-500" />}
            fullWidth
            size="md"
          />
        </div>

        {/* Clock Out Custom Dropdown */}
        <div>
          <CustomDropdown
            label="Clock-Out / End Time"
            value={shiftEndTime}
            onChange={setShiftEndTime}
            options={endTimeOptions}
            placeholder="Select End Time"
            searchable
            searchPlaceholder="Search hour (e.g. 18:00)..."
            leadingIcon={<Clock className="w-3.5 h-3.5 text-orange-500" />}
            fullWidth
            size="md"
          />
        </div>

        {/* Late Grace Period Custom Dropdown */}
        <div>
          <CustomDropdown
            label="Late Grace Period"
            value={gracePeriodMinutes}
            onChange={setGracePeriodMinutes}
            options={GRACE_PERIOD_OPTIONS}
            placeholder="Select Grace Window"
            leadingIcon={<Timer className="w-3.5 h-3.5 text-slate-400" />}
            fullWidth
            size="md"
          />
        </div>

        {/* Lunch / Break Duration Custom Dropdown */}
        <div>
          <CustomDropdown
            label="Break Duration"
            value={breakDurationMinutes}
            onChange={setBreakDurationMinutes}
            options={BREAK_DURATION_OPTIONS}
            placeholder="Select Break Length"
            leadingIcon={<Utensils className="w-3.5 h-3.5 text-slate-400" />}
            fullWidth
            size="md"
          />
        </div>
      </div>

      {/* Timezone & Working Days USING CustomDropdown */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
        {/* Timezone Custom Dropdown */}
        <div className="sm:col-span-5">
          <CustomDropdown
            label="Shift Timezone"
            value={shiftTimezone}
            onChange={setShiftTimezone}
            options={TIMEZONE_OPTIONS}
            placeholder="Select Shift Timezone"
            searchable
            searchPlaceholder="Search timezone or city..."
            leadingIcon={<Globe className="w-3.5 h-3.5 text-slate-400" />}
            fullWidth
            size="md"
          />
        </div>

        {/* Working Schedule Days Toggle */}
        <div className="sm:col-span-7 space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">
            Working Schedule Days ({workingDays.length} days/week)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onToggleWorkingDay(day)}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold flex-1 sm:flex-none min-w-[36px] text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

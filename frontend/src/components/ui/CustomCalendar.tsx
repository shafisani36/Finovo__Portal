import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

export type DayStatus = 'present' | 'late' | 'today' | 'muted' | 'default';

export interface CustomCalendarProps {
  /** Selected date in YYYY-MM-DD format */
  value?: string;
  /** Selection callback */
  onChange?: (dateStr: string) => void;
  /** Initial month to display (defaults to October 2026 or given value) */
  initialDate?: Date;
  /** Map of date strings (YYYY-MM-DD or day number string) to DayStatus */
  dateStatuses?: Record<string, DayStatus>;
  /** Whether to show the bottom legend (Present, Late, Today) */
  showLegend?: boolean;
  /** Custom wrapper styling */
  className?: string;
  /** When used inside a popover / compact view */
  compact?: boolean;
}

// Default demonstration statuses matching the user's uploaded reference image for October 2026:
// - Day 3: Today (white squircle with warm orange border)
// - Days 15, 17, 18, 20: Present (solid mint green)
// - Day 16: Late (solid golden orange)
// - Days 4, 10, 11, 24, 25, 31: Muted / inactive weekend days
// - Days 1, 2, 5-9, 12-14, 19, 21-23, 26-30: Regular active days (crisp white squircles)
const DEFAULT_OCTOBER_2026_STATUSES: Record<number, DayStatus> = {
  3: 'today',
  4: 'muted',
  10: 'muted',
  11: 'muted',
  15: 'present',
  16: 'late',
  17: 'present',
  18: 'present',
  20: 'present',
  24: 'muted',
  25: 'muted',
  31: 'muted',
};

const WEEKDAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Pixel-perfect Custom Calendar Component based on the reference design.
 * Features soft warm cream container (#F7F6F2), squircle date pills,
 * Monday-start 7-day grid, status highlights (Present, Late, Today), and interactive navigation.
 */
export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  value,
  onChange,
  initialDate,
  dateStatuses,
  showLegend = true,
  className = '',
  compact = false,
}) => {
  // Determine starting view month: if value provided, use it; else if initialDate; else October 2026 (matching reference)
  const defaultStartingDate = useMemo(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (initialDate) return initialDate;
    return new Date(2026, 9, 1); // Month index 9 = October 2026
  }, [value, initialDate]);

  const [currentDate, setCurrentDate] = useState<Date>(defaultStartingDate);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Navigate months
  const handlePrevMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Build days grid: Monday is column 0, Sunday is column 6
  const { blankCount, daysInMonth } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Sunday is 0 in JS. We want Monday = 0, Tuesday = 1, ..., Sunday = 6
    const jsDay = firstDay.getDay();
    const mondayBasedDay = (jsDay + 6) % 7;
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();

    return {
      blankCount: mondayBasedDay,
      daysInMonth: daysCount,
    };
  }, [currentYear, currentMonth]);

  // Selected date components
  const selectedDateObj = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const isSelected = (day: number) => {
    if (!selectedDateObj) return false;
    return (
      selectedDateObj.getFullYear() === currentYear &&
      selectedDateObj.getMonth() === currentMonth &&
      selectedDateObj.getDate() === day
    );
  };

  // Resolve status for a specific day in the current view
  const getDayStatus = (day: number): DayStatus => {
    const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 1. Check custom dateStatuses map if provided
    if (dateStatuses) {
      if (dateStatuses[formattedDate]) return dateStatuses[formattedDate];
      if (dateStatuses[String(day)]) return dateStatuses[String(day)];
    }

    // 2. Default sample matching the user's reference image for October 2026
    if (currentYear === 2026 && currentMonth === 9) {
      if (DEFAULT_OCTOBER_2026_STATUSES[day]) {
        return DEFAULT_OCTOBER_2026_STATUSES[day];
      }
    }

    // 3. Fallback: Check if actual today
    const realToday = new Date();
    if (
      realToday.getFullYear() === currentYear &&
      realToday.getMonth() === currentMonth &&
      realToday.getDate() === day
    ) {
      return 'today';
    }

    return 'default';
  };

  const handleDayClick = (day: number) => {
    const formatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (onChange) {
      onChange(formatted);
    }
  };

  return (
    <div
      className={`bg-[#F8F7F3] rounded-[26px] p-4.5 select-none font-['Inter',sans-serif] w-[272px] shadow-[0_12px_36px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] border border-[#EBE7DF]/90 ${className}`}
    >
      {/* =========================================================================
          CALENDAR HEADER: MONTH YEAR + CHEVRON CONTROLS
         ========================================================================= */}
      <div className="flex items-center justify-between pb-3 px-1">
        <h3 className="font-bold text-[#1E2024] text-[16.5px] tracking-tight leading-none">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="text-[#787C85] hover:text-[#1E2024] transition-colors cursor-pointer p-0.5"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="text-[#787C85] hover:text-[#1E2024] transition-colors cursor-pointer p-0.5"
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          WEEKDAYS HEADER ROW (MONDAY TO SUNDAY)
         ========================================================================= */}
      <div className="grid grid-cols-7 gap-[6px] text-center mb-1.5">
        {WEEKDAY_NAMES.map((w, idx) => (
          <div
            key={idx}
            className="text-[11px] font-semibold text-[#8E929A] text-center select-none"
          >
            {w}
          </div>
        ))}
      </div>

      {/* =========================================================================
          DAYS GRID (SQUIRCLES)
         ========================================================================= */}
      <div className="grid grid-cols-7 gap-[6px]">
        {/* Leading empty slots */}
        {Array.from({ length: blankCount }).map((_, idx) => (
          <div key={`blank-${idx}`} className="w-[28px] h-[28px]" />
        ))}

        {/* Month Day Cells */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const status = getDayStatus(day);
          const activeSelection = isSelected(day);

          let cellStyle = '';

          if (activeSelection) {
            // Selected day in picker mode
            cellStyle = 'bg-[#F95716] text-white font-bold shadow-md shadow-orange-500/25 scale-[1.04]';
          } else if (status === 'present') {
            // Present: Solid Emerald Mint (#23AC80)
            cellStyle = 'bg-[#23AC80] text-white font-semibold shadow-[0_1px_2px_rgba(35,172,128,0.2)] hover:brightness-95';
          } else if (status === 'late') {
            // Late: Solid Warm Golden Orange (#F4A524)
            cellStyle = 'bg-[#F4A524] text-white font-semibold shadow-[0_1px_2px_rgba(244,165,36,0.2)] hover:brightness-95';
          } else if (status === 'today') {
            // Today: White with 2px warm orange outline (#E0673A)
            cellStyle = 'bg-white border-[2px] border-[#E0673A] text-[#374151] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-orange-50/30';
          } else if (status === 'muted') {
            // Muted / Weekend: Faint squircle pill (#EAE8E2) with gray numbers (#8E929A)
            cellStyle = 'bg-[#EAE8E2]/80 text-[#8E929A] font-medium hover:bg-[#EAE8E2]';
          } else {
            // Standard active day: Solid pure white squircle pill
            cellStyle = 'bg-white text-[#374151] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-stone-50';
          }

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`w-[28px] h-[28px] rounded-[11px] flex items-center justify-center text-[12.5px] select-none cursor-pointer transition-all duration-150 ${cellStyle}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          BOTTOM LEGEND: PRESENT • LATE • TODAY
         ========================================================================= */}
      {showLegend && (
        <div className="flex items-center gap-3.5 mt-3.5 pt-1 text-xs select-none px-0.5">
          {/* Present */}
          <div className="flex items-center gap-1.5">
            <span className="w-[10px] h-[10px] rounded-[2.5px] bg-[#23AC80] shrink-0" />
            <span className="text-[11.5px] text-[#6E727A] font-medium">Present</span>
          </div>

          {/* Late */}
          <div className="flex items-center gap-1.5">
            <span className="w-[10px] h-[10px] rounded-[2.5px] bg-[#F4A524] shrink-0" />
            <span className="text-[11.5px] text-[#6E727A] font-medium">Late</span>
          </div>

          {/* Today */}
          <div className="flex items-center gap-1.5">
            <span className="w-[10px] h-[10px] rounded-[2.5px] border-[2px] border-[#E0673A] bg-transparent shrink-0" />
            <span className="text-[11.5px] text-[#6E727A] font-medium">Today</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// CUSTOM DATE PICKER (INPUT TRIGGER + POPUP CALENDAR POPOVER)
// =========================================================================

export interface CustomDatePickerProps {
  label?: string;
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  dateStatuses?: Record<string, DayStatus>;
  align?: 'left' | 'right';
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date...',
  required = false,
  disabled = false,
  error,
  className = '',
  dateStatuses,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Formatted display date (e.g. "Oct 16, 2026")
  const formattedDisplay = useMemo(() => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return value;
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const calendarWidth = 276;
    const calendarHeight = 350;

    let left = align === 'right' ? rect.right - calendarWidth : rect.left;
    if (left + calendarWidth > window.innerWidth - 12) {
      left = window.innerWidth - calendarWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    let placement: 'top' | 'bottom' = 'bottom';
    let top = rect.bottom + 6;

    if (spaceBelow < calendarHeight && spaceAbove > spaceBelow) {
      placement = 'top';
      top = Math.max(12, rect.top - calendarHeight - 6);
    }

    setCoords({ top, left, placement });
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  return (
    <div className={`relative text-left font-['Inter',sans-serif] ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-800 mb-1">
          {label} {required && <span className="text-[#F95716]">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border bg-white transition-all duration-150 outline-none cursor-pointer ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
              : isOpen
              ? 'border-[#F95716] ring-2 ring-orange-500/20 shadow-xs'
              : error
              ? 'border-rose-400 focus:border-rose-500'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarIcon className="w-4 h-4" />
          </span>

          <span className={`truncate ${formattedDisplay ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
            {formattedDisplay || placeholder}
          </span>

          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
              Pick
            </span>
          )}
        </button>

        {/* Floating Calendar Dropdown Popover Portaled to body */}
        {isOpen && coords && createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              maxWidth: 'calc(100vw - 24px)',
            }}
            className="animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomCalendar
              value={value}
              onChange={handleSelectDate}
              dateStatuses={dateStatuses}
              showLegend={true}
              className="max-w-[calc(100vw-24px)] shadow-2xl"
            />
          </div>,
          document.body
        )}
      </div>

      {error && <p className="text-[10.5px] text-rose-500 mt-1 font-medium">{error}</p>}
    </div>
  );
};

export default CustomCalendar;

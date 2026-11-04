import React, { useState } from 'react';
import { Flame, Clock, Sparkles, HelpCircle } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface DeepWorkHeatmapCardProps {
  range: TimeRange;
}

export const DeepWorkHeatmapCard: React.FC<DeepWorkHeatmapCardProps> = ({ range }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hour: string;
    intensity: number;
    headcount: number;
  } | null>(null);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  // Intensity matrix (0 - 100)
  // Rows: days, Cols: hours
  const matrix: number[][] = [
    [72, 88, 94, 60, 52, 85, 91, 78, 62], // Mon
    [80, 96, 98, 64, 55, 92, 95, 84, 68], // Tue (Peak)
    [75, 90, 92, 62, 54, 88, 90, 80, 60], // Wed
    [82, 95, 96, 68, 58, 90, 93, 86, 70], // Thu
    [78, 89, 90, 65, 50, 78, 82, 69, 45], // Fri
    [25, 35, 42, 30, 20, 28, 30, 22, 15], // Sat
    [15, 22, 28, 20, 15, 20, 25, 18, 10], // Sun
  ];

  // Helper to get color class based on score
  const getCellColor = (score: number) => {
    if (score >= 90) return 'bg-[#ea580c] text-white'; // Deep Focus Peak
    if (score >= 75) return 'bg-[#f95716] text-white'; // High Focus
    if (score >= 60) return 'bg-[#fb923c] text-white'; // Moderate Focus
    if (score >= 40) return 'bg-[#fed7aa] text-slate-800'; // Light Focus
    return 'bg-slate-100 text-slate-400'; // Off / Low
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <Flame className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Deep Work &amp; Focus Heatmap
            </h3>
            <p className="text-xs text-slate-400">Hourly focus intensity and unbroken flow state matrix</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span>Low</span>
          <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-200" />
          <span className="w-3.5 h-3.5 rounded-md bg-[#fed7aa]" />
          <span className="w-3.5 h-3.5 rounded-md bg-[#fb923c]" />
          <span className="w-3.5 h-3.5 rounded-md bg-[#f95716]" />
          <span className="w-3.5 h-3.5 rounded-md bg-[#ea580c]" />
          <span>95%+ Deep Flow</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto no-scrollbar pb-1">
        <div className="min-w-[620px]">
          {/* Hour headers */}
          <div className="grid grid-cols-[60px_repeat(9,1fr)] gap-1.5 mb-2 text-center">
            <span className="text-[11px] font-bold text-slate-400 text-left pl-1">Day</span>
            {hours.map((h) => (
              <span key={h} className="text-[10.5px] font-semibold text-slate-400">
                {h}
              </span>
            ))}
          </div>

          {/* Matrix Rows */}
          <div className="space-y-1.5">
            {days.map((dayName, rowIdx) => (
              <div key={dayName} className="grid grid-cols-[60px_repeat(9,1fr)] gap-1.5 items-center">
                <span className="text-xs font-bold text-slate-700 pl-1">{dayName}</span>
                {hours.map((hourName, colIdx) => {
                  const score = matrix[rowIdx][colIdx];
                  const colorClass = getCellColor(score);
                  return (
                    <button
                      key={hourName}
                      type="button"
                      onMouseEnter={() =>
                        setHoveredCell({
                          day: dayName,
                          hour: hourName,
                          intensity: score,
                          headcount: score > 50 ? 46 : 14,
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`h-8 rounded-xl font-bold text-[10.5px] flex items-center justify-center transition-all duration-150 cursor-pointer hover:scale-105 hover:ring-2 hover:ring-[#f95716]/60 ${colorClass}`}
                    >
                      {score}%
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Info Banner or Insights Banner */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        {hoveredCell ? (
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              {hoveredCell.day} at {hoveredCell.hour}:
            </span>
            <span className="text-[#f95716] font-extrabold">{hoveredCell.intensity}% Focus Intensity</span>
            <span className="text-slate-400">({hoveredCell.headcount} team members logged in flow state)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-600">
            <Sparkles className="w-4 h-4 text-[#f95716] shrink-0" />
            <span>
              <strong>Golden Productivity Window:</strong> Tuesday &amp; Thursday 10:00 - 12:00 (96.8% avg unbroken focus).
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-slate-400 text-[11px] shrink-0">
          <span>Target baseline: 75% focus threshold</span>
        </div>
      </div>
    </div>
  );
};

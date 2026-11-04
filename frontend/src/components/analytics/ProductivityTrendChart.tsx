import React, { useState } from 'react';
import { Calendar, ChevronRight, TrendingUp, Users, Clock, Info } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface ProductivityTrendChartProps {
  range: TimeRange;
}

type MetricMode = 'hours' | 'productivity' | 'billable';

export const ProductivityTrendChart: React.FC<ProductivityTrendChartProps> = ({ range }) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('hours');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Dynamic series based on range
  const chartDataByRange: Record<
    TimeRange,
    Array<{
      label: string;
      fullDate: string;
      actual: number; // e.g. hours or score
      target: number;
      billable: number;
      activeStaff: number;
    }>
  > = {
    today: [
      { label: '08:00', fullDate: 'Today 08:00 AM', actual: 12.4, target: 15.0, billable: 11.2, activeStaff: 18 },
      { label: '10:00', fullDate: 'Today 10:00 AM', actual: 34.6, target: 30.0, billable: 32.1, activeStaff: 42 },
      { label: '12:00', fullDate: 'Today 12:00 PM', actual: 41.2, target: 38.0, billable: 38.0, activeStaff: 46 },
      { label: '14:00', fullDate: 'Today 02:00 PM', actual: 44.8, target: 40.0, billable: 41.5, activeStaff: 47 },
      { label: '16:00', fullDate: 'Today 04:00 PM', actual: 38.5, target: 36.0, billable: 35.8, activeStaff: 44 },
      { label: '18:00', fullDate: 'Today 06:00 PM', actual: 23.0, target: 20.0, billable: 21.4, activeStaff: 31 },
    ],
    '7d': [
      { label: 'Mon', fullDate: 'Oct 06, 2026', actual: 214.5, target: 200, billable: 198.2, activeStaff: 48 },
      { label: 'Tue', fullDate: 'Oct 07, 2026', actual: 228.4, target: 200, billable: 212.0, activeStaff: 49 },
      { label: 'Wed', fullDate: 'Oct 08, 2026', actual: 219.0, target: 200, billable: 201.8, activeStaff: 49 },
      { label: 'Thu', fullDate: 'Oct 09, 2026', actual: 234.2, target: 200, billable: 218.4, activeStaff: 50 },
      { label: 'Fri', fullDate: 'Oct 10, 2026', actual: 221.8, target: 200, billable: 203.5, activeStaff: 48 },
      { label: 'Sat', fullDate: 'Oct 11, 2026', actual: 58.2, target: 40, billable: 52.0, activeStaff: 14 },
      { label: 'Sun', fullDate: 'Oct 12, 2026', actual: 52.4, target: 40, billable: 46.5, activeStaff: 12 },
    ],
    '30d': [
      { label: 'W1', fullDate: 'Week 1 (Sep 15 - 21)', actual: 1140, target: 1100, billable: 1045, activeStaff: 48 },
      { label: 'W2', fullDate: 'Week 2 (Sep 22 - 28)', actual: 1210, target: 1100, billable: 1110, activeStaff: 49 },
      { label: 'W3', fullDate: 'Week 3 (Sep 29 - Oct 05)', actual: 1195, target: 1100, billable: 1088, activeStaff: 50 },
      { label: 'W4', fullDate: 'Week 4 (Oct 06 - 12)', actual: 1228, target: 1100, billable: 1132, activeStaff: 50 },
    ],
    quarter: [
      { label: 'Jul', fullDate: 'July 2026', actual: 4850, target: 4600, billable: 4420, activeStaff: 47 },
      { label: 'Aug', fullDate: 'August 2026', actual: 5120, target: 4800, billable: 4680, activeStaff: 49 },
      { label: 'Sep', fullDate: 'September 2026', actual: 5310, target: 4900, billable: 4890, activeStaff: 50 },
      { label: 'Oct', fullDate: 'October 2026 (MTD)', actual: 2170, target: 2000, billable: 1980, activeStaff: 50 },
    ],
    ytd: [
      { label: 'Q1', fullDate: 'Q1 2026', actual: 13200, target: 12500, billable: 12050, activeStaff: 44 },
      { label: 'Q2', fullDate: 'Q2 2026', actual: 14450, target: 13500, billable: 13180, activeStaff: 47 },
      { label: 'Q3', fullDate: 'Q3 2026', actual: 15280, target: 14300, billable: 13990, activeStaff: 50 },
    ],
  };

  const data = chartDataByRange[range] || chartDataByRange['7d'];

  // SVG Chart Dimensions
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  const maxActual = Math.max(...data.map((d) => Math.max(d.actual, d.target)));
  const yMax = Math.ceil(maxActual * 1.15);

  const getX = (index: number) => {
    if (data.length <= 1) return svgWidth / 2;
    return paddingX + (index / (data.length - 1)) * (svgWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const usableHeight = svgHeight - paddingTop - paddingBottom;
    return svgHeight - paddingBottom - (val / yMax) * usableHeight;
  };

  // Generate smooth cubic bezier path
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const points = values.map((val, i) => ({ x: getX(i), y: getY(val) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const actualLine = buildSmoothPath(data.map((d) => d.actual));
  const targetLine = buildSmoothPath(data.map((d) => d.target));
  const areaPath = `${actualLine} L ${getX(data.length - 1)} ${svgHeight - paddingBottom} L ${getX(0)} ${svgHeight - paddingBottom} Z`;

  // Grid lines
  const yTicks = [0, yMax * 0.33, yMax * 0.66, yMax];

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-5 sm:p-6 space-y-5">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Workforce Velocity &amp; Activity Trajectory
            </h3>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-50 text-[#f95716] border border-orange-100">
              Live Aggregate
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous comparison between logged productive capacity and planned baseline sprint target.
          </p>
        </div>

        {/* Metric Mode Filter */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricMode('hours')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'hours' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tracked Hours
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('billable')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'billable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Billable Hours
          </button>
        </div>
      </div>

      {/* KPI highlight pills right above chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">Peak Period</span>
          <span className="text-sm font-black text-slate-800">
            {data.reduce((max, cur) => (cur.actual > max.actual ? cur : max), data[0])?.label}
          </span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">+14% above quota</span>
        </div>
        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">Capacity Index</span>
          <span className="text-sm font-black text-slate-800">108.4%</span>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Surplus bandwidth</span>
        </div>
        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">Billable Ratio</span>
          <span className="text-sm font-black text-[#f95716]">91.4%</span>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">High client allocation</span>
        </div>
        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">Active Force</span>
          <span className="text-sm font-black text-slate-800">50 Specialists</span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">100% On-schedule</span>
        </div>
      </div>

      {/* Responsive SVG Area Chart */}
      <div className="relative w-full overflow-hidden pt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Orange Gradient Area Fill */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f95716" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#f95716" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f95716" stopOpacity="0.00" />
            </linearGradient>

            <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#f95716" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>

            {/* Drop Shadow filter for data points */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f95716" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Ticks */}
          {yTicks.map((tick, i) => {
            const yPos = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={yPos}
                  x2={svgWidth - paddingX}
                  y2={yPos}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="600"
                  fill="#94a3b8"
                >
                  {Math.round(tick)}h
                </text>
              </g>
            );
          })}

          {/* Target Capacity Baseline (Dashed) */}
          <path
            d={targetLine}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.75"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />

          {/* Actual Logged Hours Gradient Area */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Actual Logged Hours Line */}
          <path
            d={actualLine}
            fill="none"
            stroke="url(#strokeGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points & Interaction Hover Targets */}
          {data.map((item, index) => {
            const cx = getX(index);
            const cy = getY(metricMode === 'billable' ? item.billable : item.actual);
            const isHovered = hoveredIndex === index;

            return (
              <g key={index} className="cursor-pointer">
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingTop}
                    x2={cx}
                    y2={svgHeight - paddingBottom}
                    stroke="#f95716"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                )}

                {/* Visible Data Point Node */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke="#f95716"
                  strokeWidth={isHovered ? 3 : 2.5}
                  filter="url(#glow)"
                  className="transition-all duration-150"
                />

                {/* X Axis Label */}
                <text
                  x={cx}
                  y={svgHeight - paddingBottom + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '600'}
                  fill={isHovered ? '#0f172a' : '#64748b'}
                  className="transition-colors"
                >
                  {item.label}
                </text>

                {/* Transparent hit area for hover */}
                <rect
                  x={cx - 30}
                  y={paddingTop}
                  width={60}
                  height={svgHeight - paddingTop - paddingBottom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Interactive Floating Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-xl border border-slate-800 text-xs transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: `${(getX(hoveredIndex) / svgWidth) * 100}%`,
              top: `${(getY(metricMode === 'billable' ? data[hoveredIndex].billable : data[hoveredIndex].actual) / svgHeight) * 100}%`,
            }}
          >
            <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-3">
              <span>{data[hoveredIndex].fullDate}</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Active Cycle</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Total Tracked:</span>
                <span className="font-black text-[#f95716]">{data[hoveredIndex].actual} hrs</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Billable Target:</span>
                <span className="font-semibold text-slate-300">{data[hoveredIndex].billable} hrs</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Baseline Quota:</span>
                <span className="font-semibold text-slate-400">{data[hoveredIndex].target} hrs</span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 text-[10.5px]">
                <span className="text-slate-400">Active Talent:</span>
                <span className="font-bold text-emerald-400">{data[hoveredIndex].activeStaff} members</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend and Footnote */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-[#f95716]" />
            <span className="font-semibold text-slate-700">Actual Logged Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-300" />
            <span className="text-slate-500">Target Standard Capacity</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>Calculated via Finovo Desktop agent heartbeats &amp; active intervals</span>
        </div>
      </div>
    </div>
  );
};

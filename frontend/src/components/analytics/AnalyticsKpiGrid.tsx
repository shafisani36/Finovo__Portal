import React from 'react';
import { Clock, Zap, Target, TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TimeRange } from './AnalyticsHeader';

interface AnalyticsKpiGridProps {
  range: TimeRange;
}

export const AnalyticsKpiGrid: React.FC<AnalyticsKpiGridProps> = ({ range }) => {
  // Dynamic display values based on selected time range
  const metricsByRange: Record<TimeRange, Array<{
    id: string;
    label: string;
    value: string;
    sublabel: string;
    trend: string;
    trendPositive: boolean;
    icon: React.ElementType;
    sparkline: number[];
  }>> = {
    today: [
      {
        id: 'total_hours',
        label: 'Total Hours Tracked',
        value: '194.5 hrs',
        sublabel: '91.2% Billable Utilization',
        trend: '+4.8%',
        trendPositive: true,
        icon: Clock,
        sparkline: [35, 42, 48, 52, 60, 58, 65, 72],
      },
      {
        id: 'productivity_score',
        label: 'Productivity Index',
        value: '95.4%',
        sublabel: 'Active vs Idle Ratio 97:3',
        trend: '+2.1%',
        trendPositive: true,
        icon: Zap,
        sparkline: [88, 90, 92, 91, 94, 93, 95, 96],
      },
      {
        id: 'deep_work',
        label: 'Avg Deep Work',
        value: '6.8 hrs',
        sublabel: 'Unbroken focus intervals',
        trend: '+8.4%',
        trendPositive: true,
        icon: Target,
        sparkline: [5.2, 5.6, 6.0, 5.9, 6.2, 6.5, 6.8, 6.8],
      },
      {
        id: 'milestone_velocity',
        label: 'Milestone Velocity',
        value: '98.2%',
        sublabel: '14 Sprint deliverables done',
        trend: '+3.5%',
        trendPositive: true,
        icon: TrendingUp,
        sparkline: [85, 89, 92, 94, 95, 97, 98, 98],
      },
      {
        id: 'zero_trust',
        label: 'Zero-Trust Telemetry',
        value: '100%',
        sublabel: '48 Agents tamper-verified',
        trend: 'Optimal',
        trendPositive: true,
        icon: ShieldCheck,
        sparkline: [100, 100, 100, 100, 100, 100, 100, 100],
      },
    ],
    '7d': [
      {
        id: 'total_hours',
        label: 'Total Hours Tracked',
        value: '1,428.5 hrs',
        sublabel: '89.4% Billable Utilization',
        trend: '+6.2%',
        trendPositive: true,
        icon: Clock,
        sparkline: [170, 185, 210, 204, 218, 110, 95, 230],
      },
      {
        id: 'productivity_score',
        label: 'Productivity Index',
        value: '94.2%',
        sublabel: 'Based on active keystroke/app events',
        trend: '+3.4%',
        trendPositive: true,
        icon: Zap,
        sparkline: [91, 92, 93, 94, 93, 95, 94, 95],
      },
      {
        id: 'deep_work',
        label: 'Avg Deep Work',
        value: '6.4 hrs',
        sublabel: 'Per team member daily',
        trend: '+5.1%',
        trendPositive: true,
        icon: Target,
        sparkline: [5.8, 6.0, 6.2, 6.1, 6.3, 6.4, 6.5, 6.4],
      },
      {
        id: 'milestone_velocity',
        label: 'Milestone Velocity',
        value: '98.6%',
        sublabel: '42 Sprint tasks closed on schedule',
        trend: '+2.1%',
        trendPositive: true,
        icon: TrendingUp,
        sparkline: [92, 94, 95, 96, 97, 98, 98, 99],
      },
      {
        id: 'zero_trust',
        label: 'Zero-Trust Telemetry',
        value: '99.8%',
        sublabel: '100% End-to-end encrypted logs',
        trend: 'Secure',
        trendPositive: true,
        icon: ShieldCheck,
        sparkline: [99, 100, 100, 99.5, 100, 100, 100, 100],
      },
    ],
    '30d': [
      {
        id: 'total_hours',
        label: 'Total Hours Tracked',
        value: '5,842.0 hrs',
        sublabel: '88.9% Billable Utilization',
        trend: '+8.1%',
        trendPositive: true,
        icon: Clock,
        sparkline: [1200, 1340, 1410, 1450, 1442],
      },
      {
        id: 'productivity_score',
        label: 'Productivity Index',
        value: '93.8%',
        sublabel: 'Org-wide standard benchmark',
        trend: '+1.9%',
        trendPositive: true,
        icon: Zap,
        sparkline: [91, 92, 93, 94, 93.8],
      },
      {
        id: 'deep_work',
        label: 'Avg Deep Work',
        value: '6.2 hrs',
        sublabel: 'Sustainable high focus pattern',
        trend: '+4.0%',
        trendPositive: true,
        icon: Target,
        sparkline: [5.9, 6.0, 6.1, 6.2, 6.2],
      },
      {
        id: 'milestone_velocity',
        label: 'Milestone Velocity',
        value: '97.4%',
        sublabel: '168 Deliverables closed',
        trend: '+4.5%',
        trendPositive: true,
        icon: TrendingUp,
        sparkline: [90, 93, 95, 96, 97.4],
      },
      {
        id: 'zero_trust',
        label: 'Zero-Trust Telemetry',
        value: '99.9%',
        sublabel: 'Audited SOC2 Type II compliance',
        trend: 'Certified',
        trendPositive: true,
        icon: ShieldCheck,
        sparkline: [99.8, 99.9, 99.9, 100, 99.9],
      },
    ],
    quarter: [
      {
        id: 'total_hours',
        label: 'Total Hours Tracked',
        value: '17,450 hrs',
        sublabel: '90.1% Overall Billable',
        trend: '+12.4%',
        trendPositive: true,
        icon: Clock,
        sparkline: [5200, 5600, 5800, 6050],
      },
      {
        id: 'productivity_score',
        label: 'Productivity Index',
        value: '94.0%',
        sublabel: 'Quarterly composite score',
        trend: '+2.8%',
        trendPositive: true,
        icon: Zap,
        sparkline: [92, 93, 94, 94],
      },
      {
        id: 'deep_work',
        label: 'Avg Deep Work',
        value: '6.3 hrs',
        sublabel: 'Quarterly average focus',
        trend: '+3.9%',
        trendPositive: true,
        icon: Target,
        sparkline: [6.0, 6.1, 6.2, 6.3],
      },
      {
        id: 'milestone_velocity',
        label: 'Milestone Velocity',
        value: '98.0%',
        sublabel: '512 Deliverables shipped',
        trend: '+6.0%',
        trendPositive: true,
        icon: TrendingUp,
        sparkline: [92, 95, 96, 98],
      },
      {
        id: 'zero_trust',
        label: 'Zero-Trust Telemetry',
        value: '100%',
        sublabel: 'Zero compliance breaches',
        trend: 'A+',
        trendPositive: true,
        icon: ShieldCheck,
        sparkline: [100, 100, 100, 100],
      },
    ],
    ytd: [
      {
        id: 'total_hours',
        label: 'Total Hours Tracked',
        value: '42,120 hrs',
        sublabel: '89.6% Year-to-date Billable',
        trend: '+18.2%',
        trendPositive: true,
        icon: Clock,
        sparkline: [8000, 12000, 20000, 31000, 42120],
      },
      {
        id: 'productivity_score',
        label: 'Productivity Index',
        value: '94.5%',
        sublabel: 'Annual excellence baseline',
        trend: '+3.1%',
        trendPositive: true,
        icon: Zap,
        sparkline: [91, 92, 93, 94, 94.5],
      },
      {
        id: 'deep_work',
        label: 'Avg Deep Work',
        value: '6.4 hrs',
        sublabel: 'Continuous productivity index',
        trend: '+4.4%',
        trendPositive: true,
        icon: Target,
        sparkline: [5.8, 6.0, 6.2, 6.3, 6.4],
      },
      {
        id: 'milestone_velocity',
        label: 'Milestone Velocity',
        value: '98.4%',
        sublabel: 'Enterprise roadmap completion',
        trend: '+7.2%',
        trendPositive: true,
        icon: TrendingUp,
        sparkline: [89, 92, 95, 97, 98.4],
      },
      {
        id: 'zero_trust',
        label: 'Zero-Trust Telemetry',
        value: '100%',
        sublabel: 'Enterprise Zero-Trust active',
        trend: 'A+',
        trendPositive: true,
        icon: ShieldCheck,
        sparkline: [100, 100, 100, 100, 100],
      },
    ],
  };

  const metrics = metricsByRange[range] || metricsByRange['7d'];

  // Render a tiny SVG sparkline curve
  const renderSparkline = (data: number[]) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const rangeVal = max - min === 0 ? 1 : max - min;
    const width = 64;
    const height = 24;
    const padding = 2;

    const points = data
      .map((val, idx) => {
        const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / rangeVal) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <defs>
          <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f95716" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f95716" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#f95716"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
      {metrics.map((m) => {
        const IconComponent = m.icon;
        return (
          <div
            key={m.id}
            className="group relative bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_28px_rgba(249,87,22,0.08)] hover:border-orange-200/60 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between"
          >
            {/* Top row: Icon and Trend Pill */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716] group-hover:scale-105 group-hover:bg-[#f95716] group-hover:text-white transition-all duration-200">
                <IconComponent className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex items-center gap-1">
                {renderSparkline(m.sparkline)}
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    m.trendPositive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}
                >
                  {m.trend.startsWith('+') && <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
                  {m.trend.startsWith('-') && <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
                  <span>{m.trend}</span>
                </span>
              </div>
            </div>

            {/* Bottom details */}
            <div className="space-y-1">
              <p className="text-[11.5px] font-semibold text-slate-500 tracking-tight">{m.label}</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                {m.value}
              </h3>
              <p className="text-[11px] font-medium text-slate-400 line-clamp-1">{m.sublabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

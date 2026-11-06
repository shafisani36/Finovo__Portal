import React, { useState, useEffect, useCallback } from 'react';
import { Database } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface SidebarStorageWidgetProps {
  usedGb?: number;
  totalGb?: number;
  isCollapsed?: boolean;
}

interface StorageStats {
  usedGb: number;
  totalGb: number;
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  formattedUsed: string;
  formattedTotal: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatPercentage = (percentage: number): string => {
  if (percentage <= 0) return '0%';
  if (percentage < 1) return '<1%';
  return `${Math.round(percentage)}%`;
};

export const SidebarStorageWidget: React.FC<SidebarStorageWidgetProps> = ({
  usedGb: propUsedGb,
  totalGb: propTotalGb,
  isCollapsed = false,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { activeCompany } = useAuth();
  const slug = companySlug || activeCompany?.company?.slug || 'default';

  const [stats, setStats] = useState<StorageStats>(() => {
    // Try restoring from localStorage cache for instant 0ms flicker-free render
    try {
      const cached = localStorage.getItem(`finovo_storage_stats_${slug}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    const u = propUsedGb !== undefined ? propUsedGb : 0;
    const t = propTotalGb !== undefined ? propTotalGb : 50;
    const pct = t > 0 ? Math.round((u / t) * 100) : 0;
    return {
      usedGb: u,
      totalGb: t,
      usedBytes: u * 1024 * 1024 * 1024,
      totalBytes: t * 1024 * 1024 * 1024,
      percentage: pct,
      formattedUsed: u > 0 ? `${u.toFixed(1)} GB` : '0 GB',
      formattedTotal: `${t} GB`,
    };
  });

  const fetchStorageStats = useCallback(async () => {
    try {
      // 1. Try company-scoped endpoint
      let res;
      try {
        res = await api.get(`/api/v1/companies/${slug}/storage-stats`);
      } catch {
        // Fallback to direct dashboard sidebar stats
        res = await api.get(`/api/v1/dashboard/sidebar-stats?company=${slug}`);
      }

      if (res && res.data) {
        const data = res.data;
        const bytesPerGb = 1024 * 1024 * 1024;
        const usedBytes = Number(data.storage_used_bytes) || 0;
        const totalBytes = Number(data.storage_allocated_bytes) || 0;
        const totalGb = Number(data.total_gb) || Math.round(totalBytes / bytesPerGb);
        const usedGbVal = usedBytes / bytesPerGb;

        const calculatedPct = totalBytes > 0
          ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100))
          : 0;

        const updatedStats: StorageStats = {
          usedGb: parseFloat(usedGbVal.toFixed(2)),
          totalGb,
          usedBytes,
          totalBytes,
          percentage: calculatedPct,
          formattedUsed: formatBytes(usedBytes),
          formattedTotal: `${totalGb} GB`,
        };

        setStats(updatedStats);
        try {
          localStorage.setItem(`finovo_storage_stats_${slug}`, JSON.stringify(updatedStats));
        } catch {}
      }
    } catch {
      // Silent fallback gracefully maintains state
    }
  }, [slug]);

  useEffect(() => {
    fetchStorageStats();

    // Listen to reactive update events across tabs and app actions
    const handleStorageChange = () => fetchStorageStats();
    window.addEventListener('finovo:storage-updated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    // Poll periodically every 45s to reflect background file uploads
    const interval = setInterval(fetchStorageStats, 45000);

    return () => {
      window.removeEventListener('finovo:storage-updated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [fetchStorageStats]);

  const percentage = stats.percentage;
  const percentageLabel = formatPercentage(percentage);

  if (isCollapsed) {
    return (
      <div 
        className="mx-2 my-2 p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center justify-center space-y-1 group relative cursor-pointer"
        title={`Storage: ${stats.formattedUsed} of ${stats.formattedTotal} used (${percentageLabel})`}
      >
        <Database className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#f95716] transition-colors" />
        <span className="text-[9px] font-bold text-slate-700">{percentageLabel}</span>
      </div>
    );
  }

  return (
    <div className="mx-3.5 my-2 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 space-y-2.5 select-none transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-800">Storage</span>
        </div>
        <span className="text-xs font-bold text-slate-900">{percentageLabel}</span>
      </div>

      {/* Progress Bar with Gradient */}
      <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-[#f95716] rounded-full transition-all duration-500"
          style={{ width: `${Math.max(percentage, percentage > 0 ? 3 : 0)}%` }}
        />
      </div>

      <p className="text-[10.5px] text-slate-500 font-medium flex items-center justify-between">
        <span>
          <strong className="text-slate-700 font-semibold">{stats.formattedUsed}</strong> of {stats.formattedTotal} used
        </span>
      </p>
    </div>
  );
};

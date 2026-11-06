import React, { useEffect, useMemo, useState } from 'react';
import { Laptop, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_POLL_INTERVAL_MS = 15000;

/**
 * Employee desktop tracker reminder.
 *
 * Screenshots are captured natively by the Finovo Desktop Tracker running on the employee's
 * computer (no browser share-screen prompt). This component only reminds a clocked-in employee
 * to open the tracker when it is not connected, so administrator screenshot requests can be answered.
 */
export const EmployeeScreenMonitor: React.FC = () => {
  const { activeCompany } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isAdminUser = useMemo(() => {
    if (!activeCompany) return false;
    const roleSlugs = activeCompany.roles?.map((role) => role.slug.toLowerCase()) || [];
    return (
      roleSlugs.some((slug) =>
        ['company-owner', 'company-admin', 'admin', 'project-manager', 'hr-officer'].includes(slug)
      ) || Boolean(activeCompany.permissions?.includes('attendance.manage'))
    );
  }, [activeCompany]);

  useEffect(() => {
    if (isAdminUser || !activeCompany) return;

    let isMounted = true;

    const checkTrackerStatus = async () => {
      try {
        const response = await api.get('/api/v1/attendance/employee/check-screenshot-request');
        if (!isMounted) return;
        const { is_clocked_in: isClockedIn, agent_connected: isAgentConnected } = response.data || {};
        setShowReminder(Boolean(isClockedIn) && !isAgentConnected);
      } catch {
        if (isMounted) setShowReminder(false);
      }
    };

    checkTrackerStatus();
    const interval = setInterval(checkTrackerStatus, STATUS_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdminUser, activeCompany]);

  if (isAdminUser || !showReminder || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] bg-white border border-orange-200 rounded-2xl shadow-lg p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F95716] flex items-center justify-center shrink-0">
        <Laptop className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900">Open Finovo Desktop Tracker</h4>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          You are clocked in, but the desktop tracker is not running. Open it and sign in so your work session is verified.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

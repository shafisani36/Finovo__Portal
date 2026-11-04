import React from 'react';
import { Flag } from 'lucide-react';

export interface PortfolioPriorityBadgeProps {
  priority?: string | null;
  className?: string;
}

export const PortfolioPriorityBadge: React.FC<PortfolioPriorityBadgeProps> = ({
  priority,
  className = '',
}) => {
  const norm = (priority || 'medium').toLowerCase();

  if (norm === 'high' || norm === 'urgent' || norm === 'critical') {
    return (
      <span className={`text-xs font-medium text-rose-600 flex items-center gap-1.5 ${className}`}>
        <Flag className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
        {norm === 'urgent' ? 'Urgent' : 'High'}
      </span>
    );
  }

  if (norm === 'low') {
    return (
      <span className={`text-xs font-medium text-teal-600 flex items-center gap-1.5 ${className}`}>
        <Flag className="w-3.5 h-3.5 text-teal-500 fill-teal-500 shrink-0" />
        Low
      </span>
    );
  }

  return (
    <span className={`text-xs font-medium text-amber-600 flex items-center gap-1.5 ${className}`}>
      <Flag className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
      Medium
    </span>
  );
};

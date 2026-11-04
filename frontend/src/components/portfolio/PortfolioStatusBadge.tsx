import React from 'react';

export interface PortfolioStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export const PortfolioStatusBadge: React.FC<PortfolioStatusBadgeProps> = ({
  status = 'planning',
  className = '',
}) => {
  const norm = (status || '').toLowerCase().trim();

  let dotColor = 'bg-slate-400';
  let label = norm.replace(/_/g, ' ');

  if (norm === 'planning' || norm === 'open') {
    dotColor = 'bg-blue-500';
    label = norm === 'planning' ? 'Planning' : 'Open';
  } else if (norm === 'active' || norm === 'in_progress') {
    dotColor = 'bg-[#F95716]';
    label = norm === 'active' ? 'Active' : 'Ongoing';
  } else if (norm === 'in_review') {
    dotColor = 'bg-purple-500';
    label = 'In review';
  } else if (norm === 'on_hold' || norm === 'blocked') {
    dotColor = 'bg-slate-400';
    label = norm === 'on_hold' ? 'On hold' : 'Blocked';
  } else if (norm === 'completed' || norm === 'accepted') {
    dotColor = 'bg-emerald-500';
    label = norm === 'completed' ? 'Completed' : 'Accepted';
  } else if (norm === 'archived' || norm === 'closed' || norm === 'cancelled') {
    dotColor = 'bg-slate-500';
    label = norm === 'archived' ? 'Archived' : norm === 'cancelled' ? 'Cancelled' : 'Closed';
  }

  // Capitalize first letter of label
  const formattedLabel = label ? label.charAt(0).toUpperCase() + label.slice(1) : '—';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span>{formattedLabel}</span>
    </span>
  );
};

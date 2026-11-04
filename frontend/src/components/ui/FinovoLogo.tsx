import React from 'react';
import logoBanner from '../../assets/finovo-logo-banner.png';

interface FinovoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

export const FinovoLogo: React.FC<FinovoLogoProps> = ({
  size = 'md',
  showBadge = true,
  className = '',
}) => {
  const heightClass = {
    sm: 'h-6',
    md: 'h-7 sm:h-7.5',
    lg: 'h-8 sm:h-9',
    xl: 'h-10 sm:h-11',
  }[size];

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={logoBanner}
        alt="Finovo Global — Enterprise OS"
        className={`${heightClass} w-auto object-contain select-none`}
        draggable={false}
      />
    </div>
  );
};


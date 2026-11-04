import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradientTop?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  gradientTop = true,
}) => {
  return (
    <div
      className={`relative rounded-2xl bg-[#0D121E]/85 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_60px_-15px_rgba(99,102,241,0.2)] overflow-hidden ${className}`}
    >
      {gradientTop && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-cyan-400 opacity-90" />
      )}
      {children}
    </div>
  );
};

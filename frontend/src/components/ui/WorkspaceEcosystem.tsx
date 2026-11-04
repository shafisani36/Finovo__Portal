import React from 'react';
import ecosystemImage from '../../assets/auth-ecosystem.png';

interface WorkspaceEcosystemProps {
  className?: string;
}

export const WorkspaceEcosystem: React.FC<WorkspaceEcosystemProps> = ({ className = '' }) => {
  return (
    <div className={`relative w-full h-[200px] xs:h-[230px] sm:h-[280px] md:h-[340px] lg:h-full lg:flex-1 min-h-[190px] lg:min-h-0 max-w-[720px] mx-auto select-none overflow-hidden flex items-center justify-center ${className}`}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full bg-gradient-to-tr from-orange-400/15 via-orange-300/10 to-amber-200/5 blur-3xl pointer-events-none" />

      <img
        src={ecosystemImage}
        alt="Finovo Global Enterprise Ecosystem - People, Projects & Operations"
        className="absolute inset-0 m-auto w-full h-full max-w-full max-h-full object-contain object-center drop-shadow-[0_20px_40px_rgba(249,87,22,0.08)] pointer-events-none select-none transition-transform duration-500 hover:scale-[1.01]"
        draggable={false}
      />
    </div>
  );
};


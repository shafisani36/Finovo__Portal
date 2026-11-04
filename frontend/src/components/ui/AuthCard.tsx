import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { FinovoLogo } from './FinovoLogo';

export interface AuthCardProps {
  title: string;
  subtitle: string;
  serverError?: string | null;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  maxWidthClass?: string;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  title,
  subtitle,
  serverError,
  children,
  footerContent,
  maxWidthClass = 'max-w-[440px]',
}) => {
  return (
    <div className={`w-full ${maxWidthClass} bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 xl:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] border border-slate-100 relative z-20 max-h-none lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto no-scrollbar`}>
      <div className="mb-3 sm:mb-4 hidden lg:block">
        <FinovoLogo size="md" />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mb-1 font-['Plus_Jakarta_Sans',sans-serif]">
        {title}
      </h2>
      <p className="text-xs text-slate-500 mb-4 sm:mb-5 font-normal">
        {subtitle}
      </p>

      {serverError && (
        <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {children}

      {footerContent}

      <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-100 text-center space-y-0.5">
        <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[10.5px] text-slate-400 font-medium">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>256-Bit SSL Encrypted Session &bull; ISO 27001 Ready</span>
        </div>
        <p className="text-[9.5px] sm:text-[10px] text-slate-400">
          &copy; {new Date().getFullYear()} Finovo Global Workspace Systems &bull; All rights reserved
        </p>
      </div>
    </div>
  );
};

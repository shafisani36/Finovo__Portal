import React from 'react';
import { FinovoLogo } from '../ui/FinovoLogo';
import ecosystemImage from '../../assets/auth-ecosystem.png';

export interface AuthLayoutProps {
  children: React.ReactNode;
  heroEyebrow?: string;
  heroHeadlineMain?: string;
  heroHeadlineHighlight1?: string;
  heroHeadlineHighlight2?: string;
  heroSubtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  heroEyebrow = 'PEOPLE • PROJECTS • OPERATIONS',
  heroHeadlineMain = 'One smart workspace',
  heroHeadlineHighlight1 = 'for people, projects,',
  heroHeadlineHighlight2 = 'and operations',
  heroSubtitle = 'Manage employees, tasks, attendance, leaves, reporting, and operational visibility in one secure and intelligent platform.',
}) => {
  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full bg-white text-slate-900 flex flex-col justify-between font-['Inter',sans-serif] relative select-none overflow-x-hidden selection:bg-orange-500/20 selection:text-orange-950">
      {/* Universal Ambient Brand Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_35%_25%,rgba(249,115,22,0.12),rgba(254,215,170,0.06)_40%,transparent_70%)] -z-10" />

      {/* Top Branding Header - Exactly 50px Left, Right, & Top Spacing */}
      <header className="w-full px-4 sm:px-6 md:px-8 lg:px-[50px] pt-4 sm:pt-6 lg:pt-[50px] pb-2 shrink-0 z-30 flex items-center justify-between">
        <FinovoLogo size="md" />
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/8 border border-orange-500/15 text-[11px] font-semibold text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f95716] animate-pulse" />
          <span>Enterprise Portal</span>
        </div>
      </header>

      {/* Main Content Viewport - Exactly 50px Left & 50px Right Spacing */}
      <main className="flex-1 lg:h-full lg:max-h-screen w-full px-4 sm:px-6 md:px-8 lg:px-[50px] pt-2 sm:pt-3 lg:pt-4 pb-4 sm:pb-6 lg:pb-6 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-10 xl:gap-14 2xl:gap-16 z-10 min-h-0 my-auto">
        {/* Left Column: Hero Copy + Grand Ecosystem Illustration */}
        <div className="w-full lg:flex-1 lg:h-full flex flex-col justify-between min-h-0 py-1 lg:py-2 relative z-10 text-center lg:text-left">
          {/* Hero Typography Group */}
          <div className="shrink-0 pt-1 lg:pt-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-[0.22em] text-[#e85a1a] uppercase mb-2 bg-orange-500/10 px-3 py-0.5 rounded-full lg:bg-transparent lg:px-0 lg:py-0">
              {heroEyebrow}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[36px] xl:text-[42px] 2xl:text-[46px] font-black tracking-tight leading-[1.12] text-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
              {heroHeadlineMain} <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] bg-clip-text text-transparent">
                {heroHeadlineHighlight1}
              </span>{' '}
              <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] bg-clip-text text-transparent">
                {heroHeadlineHighlight2}
              </span>
              <span className="text-slate-950">.</span>
            </h1>

            <p className="mt-2.5 text-xs sm:text-[13px] xl:text-sm text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              {heroSubtitle}
            </p>
          </div>

          {/* Desktop Grand Ecosystem Graphic: 100px Top & Right Offset */}
          <div className="hidden lg:flex relative w-full flex-1 min-h-0 items-center justify-start pointer-events-none select-none lg:-translate-y-[100px] lg:translate-x-[100px]">
            <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full bg-gradient-to-tr from-orange-500/15 via-orange-400/10 to-amber-200/5 blur-3xl pointer-events-none -z-10" />

            <img
              src={ecosystemImage}
              alt="Finovo Global Ecosystem"
              className="w-full max-w-[680px] xl:max-w-[780px] 2xl:max-w-[880px] h-auto object-contain object-left select-none pointer-events-none drop-shadow-[0_24px_55px_rgba(249,87,22,0.14)]"
              draggable={false}
            />
          </div>
        </div>

        {/* Right Column: Auth Card with Exactly 50px Right Spacing */}
        <div className="w-full lg:w-[440px] xl:w-[460px] shrink-0 flex items-center justify-center lg:justify-end my-auto self-center relative z-20">
          {children}
        </div>
      </main>

      {/* Subtle Mobile Bottom Safe Space */}
      <div className="h-2 sm:h-4 lg:hidden" />
    </div>
  );
};

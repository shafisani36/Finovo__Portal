import React, { useState, useEffect } from 'react';
import { Plus, ArrowRight, Flame } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import buildingsIllustration from '../../assets/dashboard-buildings.png';
import { useAuth } from '../../context/AuthContext';

interface HeroGreetingCardProps {
  userName?: string;
  onNewProjectClick?: () => void;
}

export const HeroGreetingCard: React.FC<HeroGreetingCardProps> = ({
  userName,
  onNewProjectClick,
}) => {
  const { user } = useAuth();
  const { companySlug } = useParams<{ companySlug: string }>();
  const displayName = userName || user?.name || 'System SuperAdmin';

  const [activeRole, setActiveRole] = useState<'admin' | 'pm' | 'hr' | 'dev'>('admin');
  const [time, setTime] = useState<{ day: string; date: string; clock: string; greeting: string }>({
    day: 'Wednesday',
    date: '30 Sept 2026',
    clock: '03:42:36 PM',
    greeting: 'Good Afternoon,',
  });

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      let greeting = 'Good Afternoon,';
      if (hours < 12) greeting = 'Good Morning,';
      else if (hours >= 17) greeting = 'Good Evening,';

      setTime({
        day: now.toLocaleDateString('en-US', { weekday: 'long' }),
        date: now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        clock: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        greeting,
      });
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-white via-[#fffcf9] to-[#fff4eb] rounded-3xl border border-slate-100/90 shadow-[0_4px_30px_rgba(249,87,22,0.03),0_1px_3px_rgba(0,0,0,0.02)] p-5 sm:p-6 lg:p-7 overflow-hidden relative transition-all">
      {/* Ambient Sunset Radial Glow mirroring the buildings sun illustration */}
      <div className="absolute right-[12%] sm:right-[18%] lg:right-[24%] top-1/2 -translate-y-1/2 w-[280px] sm:w-[360px] lg:w-[440px] h-[280px] sm:h-[340px] rounded-full bg-gradient-to-tr from-orange-400/15 via-amber-300/10 to-transparent blur-3xl pointer-events-none" />

      {/* Responsive layout across all 5 screen breakpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-6 items-center relative z-10">
        {/* Left Section: Personalized Greetings and Role Selector */}
        <div className="md:col-span-2 lg:col-span-5 space-y-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold tracking-tight">
              <span className="text-[#f95716] drop-shadow-xs">
                <Flame className="w-4 h-4 fill-[#f95716]" />
              </span>
              <span>{time.greeting}</span>
            </div>

            <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-black text-slate-950 tracking-tight font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2 leading-tight">
              <span className="truncate">{displayName}</span>
              <span className="inline-block animate-wave text-2xl shrink-0">👋</span>
            </h1>

            <p className="text-xs sm:text-[13px] text-slate-400 font-normal leading-relaxed">
              Here&apos;s your synchronized organizational overview.
            </p>
          </div>

          {/* Interactive Role Switcher Pills - Multi-line wrapping with zero horizontal overflow */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveRole('admin')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                activeRole === 'admin'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>Executive Admin</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRole('pm')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                activeRole === 'pm'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>Project Manager</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRole('hr')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                activeRole === 'hr'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
              <span>People Ops (HR)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRole('dev')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                activeRole === 'dev'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span>Squad Contributor</span>
            </button>
          </div>
        </div>

        {/* Center Section: Architectural Skyline Illustration with Floating Impact Badge */}
        <div className="md:col-span-1 lg:col-span-4 relative flex items-center justify-center min-h-[150px] sm:min-h-[165px] lg:min-h-[175px]">
          <div className="relative w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[390px] h-[145px] sm:h-[160px] flex items-end justify-center">
            {/* The transparent vector skyscrapers artwork */}
            <img
              src={buildingsIllustration}
              alt="Finovo Headquarters"
              className="w-full h-full object-contain object-bottom select-none pointer-events-none drop-shadow-[0_8px_20px_rgba(249,87,22,0.06)]"
            />

            {/* Floating Motivational Badge */}
            <div className="absolute top-1 left-0 sm:-left-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-100/90 shadow-[0_8px_20px_rgba(0,0,0,0.06)] flex items-center gap-2 group cursor-pointer hover:border-orange-200 transition-all z-20">
              <span className="text-[11px] font-bold text-slate-800 leading-tight">
                Turning <br />
                <span className="bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] bg-clip-text text-transparent font-black">
                  Ideas into Impact
                </span>
              </span>
              <div className="w-5 h-5 rounded-full bg-slate-100 group-hover:bg-[#f95716] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors shadow-2xs">
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Time & New Project CTA Card */}
        <div className="md:col-span-1 lg:col-span-3 bg-white/90 backdrop-blur-md rounded-2xl p-4 sm:p-4.5 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-3">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {time.day}
            </div>
            <div className="text-base sm:text-[17px] font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              {time.date}
            </div>
            <div className="text-xs text-slate-500 font-mono font-medium">
              {time.clock}
            </div>
          </div>

          <Link
            to={`/app/${companySlug || 'default'}/projects`}
            onClick={onNewProjectClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:from-[#d94f13] hover:via-[#e35d18] hover:to-[#eb7124] text-white font-bold text-xs shadow-[0_4px_16px_rgba(249,87,22,0.28)] hover:shadow-[0_6px_20px_rgba(249,87,22,0.36)] transition-all duration-200 active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Project</span>
          </Link>

          <p className="text-[10px] text-slate-400 italic leading-relaxed text-center">
            &ldquo;A more connected workspace for a stronger tomorrow.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
};

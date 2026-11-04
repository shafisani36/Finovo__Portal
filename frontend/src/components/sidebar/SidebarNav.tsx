import React, { useEffect, useState, useCallback } from 'react';
import { NavLink, useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Folder,
  CheckSquare,
  FileText,
  Users,
  LayoutGrid,
  CreditCard,
  Shield,
  Clock,
  CalendarDays,
  Zap,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Plus,
  Receipt,
  Share2,
  Server,
} from 'lucide-react';
import api from '../../lib/api';
import { dataPipeline } from '../../lib/dataPipeline';

export interface OngoingProjectItem {
  id: string;
  name: string;
  code: string;
  color?: string;
  letter: string;
  status?: string;
}

interface SidebarNavProps {
  isCollapsed?: boolean;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ isCollapsed = false }) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const slug = companySlug || 'default';

  const cacheKey = `projects_summary_${slug}`;
  const cached = dataPipeline.get<{ count: number; ongoing: OngoingProjectItem[] }>(cacheKey);

  const [projectCount, setProjectCount] = useState<number>(() => cached?.count ?? 0);
  const [ongoingProjects, setOngoingProjects] = useState<OngoingProjectItem[]>(() => cached?.ongoing ?? []);

  const syncProjectsSummary = useCallback(async () => {
    if (!companySlug) return;
    try {
      const res = await api.get(`/companies/${companySlug}/projects?per_page=5&sort_by=created_at&sort_direction=desc`);
      const total = Number(res.data.total ?? res.data.stats?.total ?? 0);
      const items = res.data.data || res.data.projects?.data || [];

      const colors = [
        'bg-slate-900 text-white',
        'bg-[#F95716] text-white',
        'bg-indigo-600 text-white',
        'bg-emerald-600 text-white',
        'bg-amber-600 text-white',
      ];

      const mapped: OngoingProjectItem[] = items.slice(0, 4).map((p: any, idx: number) => ({
        id: String(p.id),
        name: p.name,
        code: p.project_code || `PRJ-${p.id}`,
        color: colors[idx % colors.length],
        letter: (p.name || 'P')[0].toUpperCase(),
        status: p.status,
      }));

      setProjectCount(total);
      setOngoingProjects(mapped);
      dataPipeline.set(cacheKey, { count: total, ongoing: mapped }, 180000);
    } catch {
      // Graceful fallback
    }
  }, [companySlug, cacheKey]);

  useEffect(() => {
    syncProjectsSummary();

    // Subscribe to dataPipeline updates
    const unsubscribe = dataPipeline.subscribe(cacheKey, (data: { count: number; ongoing: OngoingProjectItem[] }) => {
      if (data) {
        if (typeof data.count === 'number') setProjectCount(data.count);
        if (Array.isArray(data.ongoing)) setOngoingProjects(data.ongoing);
      }
    });

    // Global event listener for reactive real-time sync across components
    const handleGlobalUpdate = (e: any) => {
      if (e.detail?.companySlug === companySlug) {
        if (typeof e.detail.total === 'number') {
          setProjectCount(e.detail.total);
        }
        if (Array.isArray(e.detail.ongoing)) {
          setOngoingProjects(e.detail.ongoing);
        } else {
          syncProjectsSummary();
        }
      }
    };

    window.addEventListener('finovo_projects_updated', handleGlobalUpdate);
    return () => {
      unsubscribe();
      window.removeEventListener('finovo_projects_updated', handleGlobalUpdate);
    };
  }, [companySlug, syncProjectsSummary, cacheKey]);

  const navSections = [
    {
      title: 'WORKSPACE',
      items: [
        { label: 'Dashboard', to: `/app/${slug}/overview`, icon: LayoutDashboard },
        { label: 'Analytics Hub', to: `/app/${slug}/monitoring`, icon: BarChart3 },
        { label: 'Messages', to: `/app/${slug}/collaboration`, icon: MessageSquare },
        { label: 'Projects', to: `/app/${slug}/projects`, icon: Folder, count: projectCount },
        { label: 'Tasks', to: `/app/${slug}/tasks`, icon: CheckSquare },
        { label: 'Files & Docs', to: `/app/${slug}/files`, icon: FileText },
      ],
    },
    {
      title: 'PEOPLE',
      items: [
        { label: 'Employees', to: `/app/${slug}/employees`, icon: Users },
        { label: 'Departments', to: `/app/${slug}/departments`, icon: LayoutGrid },
        { label: 'Designations', to: `/app/${slug}/roles`, icon: CreditCard },
        { label: 'Roles & RBAC', to: `/app/${slug}/roles`, icon: Shield },
      ],
    },
    {
      title: 'TIME',
      items: [
        { label: 'Attendance & Time', to: `/app/${slug}/attendance`, icon: Clock },
        { label: 'Leave Portal', to: `/app/${slug}/attendance`, icon: CalendarDays },
        { label: 'Live Tracker', to: `/app/${slug}/time`, icon: Zap },
        { label: 'Time Reports', to: `/app/${slug}/time`, icon: TrendingUp },
        { label: 'Download Tracker', to: `/app/${slug}/download-tracker`, icon: Download },
      ],
    },
    {
      title: 'PLATFORM & SAAS',
      items: [
        { label: 'Subscription & Plans', to: `/app/${slug}/billing`, icon: Receipt },
        { label: 'Integrations Hub', to: `/app/${slug}/integrations`, icon: Share2 },
        { label: 'Platform Operations', to: `/app/${slug}/platform-admin`, icon: Server },
        { label: 'Audit Logs', to: `/app/${slug}/audit`, icon: FileSpreadsheet },
      ],
    },
  ];

  if (isCollapsed) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar flex flex-col items-center select-none">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1 w-full flex flex-col items-center">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    `w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative cursor-pointer ${
                      isActive
                        ? 'bg-[#fff4ed] text-[#f95716] shadow-2xs border border-orange-200/60 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute top-1 right-1 px-1 py-0.2 min-w-4 text-[9px] font-bold rounded-full bg-[#f95716] text-white flex items-center justify-center leading-none">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Collapsed Ongoing Projects */}
        <div className="pt-2 border-t border-slate-100 w-full flex flex-col items-center space-y-1.5">
          {ongoingProjects.length > 0 ? (
            ongoingProjects.map((proj) => (
              <Link
                key={proj.id}
                to={`/app/${slug}/projects?selected=${proj.id}`}
                title={`${proj.name} (${proj.code})`}
                className={`w-7 h-7 rounded-lg text-[10.5px] font-bold flex items-center justify-center hover:scale-105 transition-transform ${proj.color || 'bg-slate-900 text-white'}`}
              >
                {proj.letter}
              </Link>
            ))
          ) : (
            <Link
              to={`/app/${slug}/projects/create`}
              title="Create New Project"
              className="w-7 h-7 rounded-lg border border-dashed border-slate-200 text-slate-400 hover:text-[#f95716] hover:border-orange-300 flex items-center justify-center transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 custom-scrollbar text-[12px] select-none">
      {navSections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-[#fff4ed] text-[#f95716] font-bold shadow-2xs border border-orange-200/50'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50/90 font-medium'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-colors ${
                        item.label === 'Projects'
                          ? 'bg-[#F95716] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-orange-100 group-hover:text-[#F95716]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}

      {/* Ongoing Projects Section */}
      <div className="pt-2 space-y-1">
        <div className="flex items-center justify-between px-3 mb-1">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Ongoing Projects
          </span>
          <Link
            to={`/app/${slug}/projects/create`}
            className="w-4 h-4 rounded text-slate-400 hover:text-[#f95716] flex items-center justify-center transition-colors"
            title="Create Project"
          >
            <Plus className="w-3.5 h-3.5" />
          </Link>
        </div>

        {ongoingProjects.length > 0 ? (
          <div className="space-y-0.5">
            {ongoingProjects.map((project) => (
              <Link
                key={project.id}
                to={`/app/${slug}/projects?selected=${project.id}`}
                className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 ${project.color || 'bg-slate-900 text-white'}`}
                  >
                    {project.letter}
                  </span>
                  <span className="text-slate-700 text-xs font-medium truncate group-hover:text-slate-900">
                    {project.name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {project.code}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2.5 rounded-xl bg-slate-50/70 border border-dashed border-slate-200/80 text-center space-y-1.5 my-1">
            <p className="text-[11px] font-medium text-slate-400">No ongoing projects</p>
            <Link
              to={`/app/${slug}/projects/create`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f95716] hover:text-[#ea4e0e] transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create Project
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

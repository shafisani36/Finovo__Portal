import { dataPipeline } from './dataPipeline';
import { OngoingProjectItem } from '../components/sidebar/SidebarNav';

export const notifyProjectsUpdated = (
  companySlug: string,
  total: number,
  projectsList: any[] = []
) => {
  const colors = [
    'bg-slate-900 text-white',
    'bg-[#F95716] text-white',
    'bg-indigo-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
  ];

  const ongoing: OngoingProjectItem[] = projectsList.slice(0, 4).map((p: any, idx: number) => ({
    id: String(p.id),
    name: p.name,
    code: p.project_code || `PRJ-${p.id}`,
    color: colors[idx % colors.length],
    letter: (p.name || 'P')[0].toUpperCase(),
    status: p.status,
  }));

  const cacheKey = `projects_summary_${companySlug}`;
  dataPipeline.set(cacheKey, { count: total, ongoing }, 180000);

  window.dispatchEvent(
    new CustomEvent('finovo_projects_updated', {
      detail: { companySlug, total, ongoing },
    })
  );
};

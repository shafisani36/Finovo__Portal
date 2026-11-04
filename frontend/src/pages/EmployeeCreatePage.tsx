import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import { CreateEmployeeForm } from '../components/employees/CreateEmployeeForm';

export const EmployeeCreatePage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const slug = companySlug || 'bitspark-ops';

  return (
    <AppShell
      title="Create New Employee"
      subtitle="Comprehensive workforce provisioning: shift timing, organizational hierarchy, demographics, and credentials."
      actions={
        <div className="flex items-center gap-2.5">
          <Link
            to={`/app/${slug}/employees`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Cancel</span>
          </Link>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
        {/* Navigation Breadcrumbs Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
          <nav className="flex items-center gap-2 text-xs text-slate-500">
            <Link to={`/app/${slug}/employees`} className="hover:text-[#F95716] font-medium transition-colors">
              Employees
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">Add Employee</span>
          </nav>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Workspace:</span>
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              /{slug}
            </span>
          </div>
        </div>

        {/* Master Employee Creation Component */}
        <CreateEmployeeForm companySlug={slug} showCancelButton={false} />
      </div>
    </AppShell>
  );
};

export default EmployeeCreatePage;

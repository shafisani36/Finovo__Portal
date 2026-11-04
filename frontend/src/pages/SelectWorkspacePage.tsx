import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Plus, ArrowRight, Shield, LogOut, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import { CustomSelect, SelectOption } from '../components/ui/CustomSelect';
import { useAuth, CompanyMembership } from '../context/AuthContext';

export const SelectWorkspacePage: React.FC = () => {
  const { user, companies, activeCompany, setActiveCompany, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedSlug, setSelectedSlug] = useState<string>('');

  useEffect(() => {
    if (!loading && companies.length === 0) {
      navigate('/onboarding');
    } else if (companies.length > 0 && !selectedSlug) {
      setSelectedSlug(activeCompany?.company.slug || companies[0].company.slug);
    }
  }, [loading, companies, activeCompany, selectedSlug, navigate]);

  const handleSelect = (companyMembership: CompanyMembership) => {
    setActiveCompany(companyMembership);
    navigate(`/app/${companyMembership.company.slug}/overview`);
  };

  const handleDropdownChange = (slug: string) => {
    setSelectedSlug(slug);
    const target = companies.find((m) => m.company.slug === slug);
    if (target) {
      handleSelect(target);
    }
  };

  const workspaceOptions: SelectOption[] = companies.map((m) => ({
    value: m.company.slug,
    label: m.company.name,
    description: `${m.company.slug} • ${m.roles[0]?.name || 'Member'}`,
    badge: m.roles[0]?.name || 'Member',
    icon: <Building2 className="w-4 h-4 text-[#f95716]" />,
  }));

  return (
    <AuthLayout
      heroEyebrow="ENTERPRISE WORKSPACE HUB"
      heroHeadlineMain="Welcome to your"
      heroHeadlineHighlight1="intelligent"
      heroHeadlineHighlight2="workspace portal"
      heroSubtitle="Switch between organizational tenants, access authorized projects, and collaborate with teams securely."
    >
      <AuthCard
        title="Select Workspace"
        subtitle={`Welcome back, ${user?.name || 'Team Member'}. Choose an organization to access.`}
        maxWidthClass="max-w-[450px]"
        footerContent={
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11.5px]">
              {companies.length} {companies.length === 1 ? 'organization' : 'organizations'} connected
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 hover:text-[#f95716] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {companies.length > 2 && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick Switcher
              </label>
              <CustomSelect
                options={workspaceOptions}
                value={selectedSlug}
                onChange={handleDropdownChange}
                placeholder="Choose an organization..."
                leadingIcon={<Building2 className="w-4 h-4" />}
                searchPlaceholder="Search your workspaces..."
              />
            </div>
          )}

          {/* Interactive Workspace Cards */}
          <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1 custom-scrollbar">
            {companies.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-orange-500/5 border border-dashed border-orange-500/20 space-y-2">
                <Building2 className="w-8 h-8 text-[#f95716] mx-auto opacity-70" />
                <p className="text-xs font-semibold text-slate-700">No organizations found</p>
                <p className="text-[11px] text-slate-400">
                  You don't have access to any workspace yet. Create a new organization to get started.
                </p>
              </div>
            ) : (
              companies.map((m) => {
                const isCurrent = activeCompany?.company.id === m.company.id;
                const roleName = m.roles[0]?.name || 'Member';

                return (
                  <button
                    key={m.company.id}
                    type="button"
                    onClick={() => handleSelect(m)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 group flex items-center justify-between relative overflow-hidden ${
                      isCurrent
                        ? 'bg-orange-500/[0.04] border-[#f95716]/40 shadow-sm'
                        : 'bg-white border-slate-200/90 hover:border-[#f95716]/60 hover:bg-orange-500/[0.02] hover:shadow-sm'
                    }`}
                  >
                    {/* Active Accent Bar */}
                    {isCurrent && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#e85a1a] to-[#fa8136]" />
                    )}

                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                          isCurrent
                            ? 'bg-gradient-to-br from-[#e85a1a] to-[#fa8136] text-white shadow-sm shadow-orange-500/25'
                            : 'bg-orange-500/10 border border-orange-500/15 text-[#f95716] group-hover:bg-[#f95716] group-hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-black tracking-wide uppercase">
                          {m.company.name.slice(0, 2)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#f95716] transition-colors truncate">
                            {m.company.name}
                          </h3>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#f95716] text-white shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 bg-slate-100 group-hover:bg-orange-500/10 group-hover:text-[#f95716] px-1.5 py-0.5 rounded transition-colors">
                            <Shield className="w-3 h-3 text-[#f95716]" />
                            {roleName}
                          </span>
                          <span className="text-slate-300">&bull;</span>
                          <span className="text-[10.5px] font-mono text-slate-400 truncate">
                            /{m.company.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-orange-500/10 flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#f95716] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Action Link: Create New Organization */}
          <Link
            to="/onboarding"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#f95716]/40 text-[#f95716] bg-orange-500/[0.03] hover:bg-orange-500/[0.08] hover:border-[#f95716] transition-all text-xs font-bold group"
          >
            <Plus className="w-4 h-4 text-[#f95716] group-hover:rotate-90 transition-transform duration-200" />
            <span>Create New Organization</span>
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
};

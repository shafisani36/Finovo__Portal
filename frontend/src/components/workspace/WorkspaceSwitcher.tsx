import React, { useState, useRef, useEffect } from 'react';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

export const WorkspaceSwitcher: React.FC = () => {
  const { companies, activeCompany, setActiveCompany } = useAuth();
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentWorkspace = companies.find((c) => c.company.slug === companySlug) || activeCompany || companies[0];

  const handleSelect = (slug: string) => {
    const target = companies.find((c) => c.company.slug === slug);
    if (target) {
      setActiveCompany(target);
    }
    setIsOpen(false);
    navigate(`/app/${slug}/overview`);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-all text-left shadow-xs cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-200/50 flex items-center justify-center text-[#F95716] font-bold text-xs shrink-0">
              {currentWorkspace?.company.name?.[0]?.toUpperCase() || <Building2 className="w-4 h-4" />}
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs font-bold text-slate-900 truncate">
                {currentWorkspace?.company.name || 'Select Workspace'}
              </p>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                {currentWorkspace?.company.slug || 'no-workspace'}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workspaces ({companies.length})
            </div>

            <div className="max-h-60 overflow-y-auto">
              {companies.map((membership) => {
                const isSelected = membership.company.slug === (currentWorkspace?.company.slug || companySlug);
                return (
                  <button
                    key={membership.membership_id}
                    onClick={() => handleSelect(membership.company.slug)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-orange-50/60 transition-colors cursor-pointer ${
                      isSelected ? 'bg-orange-50/80 text-orange-900 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-[11px] shrink-0">
                        {membership.company.name[0]?.toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="text-xs truncate">{membership.company.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{membership.company.slug}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#F95716] shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 mt-1 border-t border-slate-100 px-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-[#F95716] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
};

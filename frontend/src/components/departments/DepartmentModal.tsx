import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Network,
  X,
  Loader2,
  Building,
  AlertCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { CustomDropdown } from '../ui/CustomDropdown';
import { Department, MemberOption } from './types';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string | null;
    description: string | null;
    manager_membership_id: number | null;
    parent_department_id: number | null;
    status: string;
  }) => Promise<void>;
  editingDepartment?: Department | null;
  departments: Department[];
  members: MemberOption[];
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingDepartment,
  departments,
  members,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when opening or editing changes
  useEffect(() => {
    if (isOpen) {
      if (editingDepartment) {
        setName(editingDepartment.name);
        setCode(editingDepartment.code || '');
        setDescription(editingDepartment.description || '');
        setManagerId(
          editingDepartment.manager_membership_id
            ? String(editingDepartment.manager_membership_id)
            : ''
        );
        setParentId(
          editingDepartment.parent_department_id
            ? String(editingDepartment.parent_department_id)
            : editingDepartment.parent_department?.id
            ? String(editingDepartment.parent_department.id)
            : ''
        );
        setStatus(editingDepartment.status || 'active');
      } else {
        setName('');
        setCode('');
        setDescription('');
        setManagerId('');
        setParentId('');
        setStatus('active');
      }
      setError(null);
    }
  }, [isOpen, editingDepartment]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department Name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : null,
        description: description.trim() || null,
        manager_membership_id: managerId ? parseInt(managerId, 10) : null,
        parent_department_id: parentId ? parseInt(parentId, 10) : null,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save department.');
    } finally {
      setLoading(false);
    }
  };

  // Filter out the current editing department and its descendants to avoid cycles
  const availableParents = departments.filter((d) => {
    if (!editingDepartment) return true;
    return d.id !== editingDepartment.id;
  });

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Background Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={() => {
          if (!loading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-modal-title"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/40 via-white to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
              <Network className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2
                id="department-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]"
              >
                {editingDepartment ? 'Edit Department' : 'Create Department'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingDepartment
                  ? 'Update organizational structure, leadership, and operational scope'
                  : 'Establish a new organizational division, team, or operational unit'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
            title="Close dialog (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4.5 flex-1 custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Department Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Department Name <span className="text-[#F95716]">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Engineering & Technology"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Code & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Department Code / Prefix <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. ENG, PRD, OPS"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all uppercase"
                />
              </div>
            </div>

            <div>
              <CustomDropdown
                label="Department Status"
                value={status}
                onChange={setStatus}
                options={[
                  {
                    value: 'active',
                    label: 'Active Unit',
                    description: 'Operational and accepting member assignments',
                    badge: 'Active',
                    colorDot: '#10B981',
                  },
                  {
                    value: 'archived',
                    label: 'Archived Unit',
                    description: 'Deprecated or reorganized division',
                    badge: 'Archived',
                    colorDot: '#94A3B8',
                  },
                ]}
                fullWidth
                size="md"
              />
            </div>
          </div>

          {/* Department Head (Manager) */}
          <div>
            <CustomDropdown
              label="Head of Department (Lead Manager)"
              placeholder="Unassigned / Direct to Executive"
              value={managerId}
              onChange={setManagerId}
              options={[
                {
                  value: '',
                  label: 'Unassigned / Direct to Leadership',
                  description: 'No specific department head assigned',
                },
                ...members.map((m) => ({
                  value: String(m.id),
                  label: m.user.name,
                  description: m.user.email,
                  badge: 'Member',
                })),
              ]}
              searchable={members.length > 4}
              searchPlaceholder="Search team members by name..."
              fullWidth
              size="md"
            />
          </div>

          {/* Parent Department */}
          <div>
            <CustomDropdown
              label="Parent Organizational Division"
              placeholder="None (Top-Level Division)"
              value={parentId}
              onChange={setParentId}
              options={[
                {
                  value: '',
                  label: 'None (Top-Level Independent Division)',
                  description: 'Direct reporting to executive leadership',
                  badge: 'Root',
                },
                ...availableParents.map((dept) => ({
                  value: String(dept.id),
                  label: dept.name,
                  description: dept.code ? `Code: ${dept.code}` : undefined,
                  badge: dept.code || undefined,
                })),
              ]}
              searchable={availableParents.length > 5}
              searchPlaceholder="Search parent divisions..."
              fullWidth
              size="md"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">
                Charter, Scope &amp; Responsibilities <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {description.length}/300
              </span>
            </div>
            <div className="relative">
              <textarea
                rows={3}
                maxLength={300}
                placeholder="Describe team mandate, core deliverables, and operational domain..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all resize-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:from-[#f04e0e] hover:to-[#e04a0e] shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  <span>{editingDepartment ? 'Save Changes' : 'Create Department'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

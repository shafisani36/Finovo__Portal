import React, { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building,
  Briefcase,
  Shield,
  Key,
  Sparkles,
  Check,
  Loader2,
  Calendar,
  MapPin,
  Laptop,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import api from '../../lib/api';
import { CustomDropdown } from '../ui/CustomDropdown';

export interface EmployeeCredentials {
  name: string;
  email: string;
  password: string;
  company_slug: string;
  company_name: string;
  role: string;
  login_url: string;
}

export interface DepartmentItem {
  id: number;
  name: string;
  code?: string;
}

export interface DesignationItem {
  id: number;
  name: string;
  code?: string;
  level?: string | number;
}

export interface ManagerItem {
  id: number;
  user?: { id: number; name: string; email: string };
}

export interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (credentials: EmployeeCredentials, employee: any) => void;
  companySlug: string;
  companyName?: string;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  managers: ManagerItem[];
}

export const CreateEmployeeModal: React.FC<CreateEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companySlug,
  companyName = 'Bitspark Global Operations',
  departments,
  designations,
  managers,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => `Finovo@${Math.floor(1000 + Math.random() * 9000)}!`);
  const [showPassword, setShowPassword] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [managerMembershipId, setManagerMembershipId] = useState('');
  const [roleSlug, setRoleSlug] = useState('employee');
  const [employmentType, setEmploymentType] = useState('permanent');
  const [workArrangement, setWorkArrangement] = useState('remote');
  const [workLocation, setWorkLocation] = useState('Headquarters');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [initialStatus, setInitialStatus] = useState<'active' | 'onboarding'>('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let newPass = 'Finovo@';
    for (let i = 0; i < 4; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newPass += '!';
    setPassword(newPass);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return 'EM';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const selectedDeptObj = departments.find((d) => String(d.id) === departmentId);
  const selectedDesigObj = designations.find((d) => String(d.id) === designationId);

  // Calculate required fields completed
  const totalRequired = 2; // name, email
  let completedRequired = 0;
  if (name.trim()) completedRequired++;
  if (email.trim() && email.includes('@')) completedRequired++;
  const progressPercent = Math.round((completedRequired / totalRequired) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please provide employee full name and valid work email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post(`/companies/${companySlug}/employees`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || undefined,
        employee_number: employeeNumber.trim() || undefined,
        department_id: departmentId ? parseInt(departmentId, 10) : undefined,
        designation_id: designationId ? parseInt(designationId, 10) : undefined,
        manager_membership_id: managerMembershipId ? parseInt(managerMembershipId, 10) : undefined,
        role_slug: roleSlug,
        employment_type: employmentType,
        work_arrangement: workArrangement,
        work_location: workLocation.trim() || 'Headquarters',
        hire_date: hireDate,
        status: initialStatus,
      });

      const creds: EmployeeCredentials = res.data.credentials || {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        company_slug: companySlug,
        company_name: companyName,
        role: roleSlug === 'company-admin' ? 'Company Administrator' : roleSlug === 'project-manager' ? 'Project Manager' : roleSlug === 'hr-officer' ? 'HR Officer' : 'Employee',
        login_url: `${window.location.origin}/login`,
      };

      onSuccess(creds, res.data.employee);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create employee account. Please verify input fields.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-['Inter',sans-serif]">
        {/* Modal Header */}
        <div className="px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 shadow-2xs shrink-0">
              <UserPlus className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#F95716] font-bold block">
                ORGANIZATION ONBOARDING
              </span>
              <h2 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] truncate">
                Add New Employee Account
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono border border-slate-200">
              Esc
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Grid (2 Columns: Form on Left, Live ID Preview on Right) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 custom-scrollbar">
          {/* Left Form: Col 1-7 */}
          <form onSubmit={handleSubmit} id="create-employee-form" className="lg:col-span-7 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  !
                </span>
                <span className="flex-1 leading-relaxed font-medium">{error}</span>
              </div>
            )}

            {/* Section 1: Identity & Credentials */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#F95716]" />
                  <span>1. Identity &amp; Login Credentials</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Active on save</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Full Name <span className="text-[#F95716]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Work Email <span className="text-[#F95716]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="alex.morgan@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Password Provisioning */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Key className="w-3 h-3 text-[#F95716]" />
                    <span>Login Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[10.5px] font-semibold text-[#F95716] hover:text-orange-700 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Secure</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter or generate temporary password"
                    className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Credentials will be active immediately. The employee can use this email and password at the login page.
                </p>
              </div>
            </div>

            {/* Section 2: Organization Lock & Role Assignment */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#F95716]" />
                <span>2. Organization &amp; Permission Role</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Organization Locked Badge */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Company Organization
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 shadow-2xs">
                    <Lock className="w-3.5 h-3.5 text-[#F95716] shrink-0" />
                    <span className="truncate font-semibold text-slate-900">{companyName}</span>
                    <span className="text-[10px] font-mono text-slate-400 ml-auto shrink-0">
                      /{companySlug}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Employee membership is automatically bound to this company workspace.
                  </p>
                </div>

                {/* Role Assignment */}
                <div>
                  <CustomDropdown
                    label="Workspace Access Role"
                    value={roleSlug}
                    onChange={setRoleSlug}
                    options={[
                      { value: 'employee', label: 'Employee', description: 'Standard Workspace Member', badge: 'Standard' },
                      { value: 'project-manager', label: 'Project Manager', description: 'Schedules & Milestones', badge: 'PM' },
                      { value: 'hr-officer', label: 'HR Officer', description: 'People & Onboarding', badge: 'HR' },
                      { value: 'company-admin', label: 'Company Administrator', description: 'Full Tenant Admin', badge: 'Admin' },
                    ]}
                    searchable={false}
                    fullWidth
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Department, Job Title & Manager */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#F95716]" />
                <span>3. Department, Designation &amp; Hierarchy</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Department */}
                <div>
                  <CustomDropdown
                    label="Department"
                    placeholder="Unassigned"
                    value={departmentId}
                    onChange={setDepartmentId}
                    options={[
                      { value: '', label: 'Unassigned', description: 'No primary department' },
                      ...departments.map((d) => ({
                        value: String(d.id),
                        label: d.name,
                        description: d.code ? `Code: ${d.code}` : undefined,
                        badge: d.code || undefined,
                      })),
                    ]}
                    searchable={departments.length > 5}
                    searchPlaceholder="Search departments..."
                    fullWidth
                    size="sm"
                  />
                </div>

                {/* Designation / Job Title */}
                <div>
                  <CustomDropdown
                    label="Job Title / Designation"
                    placeholder="Select Designation"
                    value={designationId}
                    onChange={setDesignationId}
                    options={[
                      { value: '', label: 'Select Designation', description: 'No specific job title' },
                      ...designations.map((des) => ({
                        value: String(des.id),
                        label: des.name,
                        description: des.level ? `Level ${des.level}` : undefined,
                        badge: des.level ? String(des.level) : undefined,
                      })),
                    ]}
                    searchable={designations.length > 5}
                    searchPlaceholder="Search designations..."
                    fullWidth
                    size="sm"
                  />
                </div>

                {/* Reporting Manager */}
                <div>
                  <CustomDropdown
                    label="Reporting Manager"
                    placeholder="None / Executive"
                    value={managerMembershipId}
                    onChange={setManagerMembershipId}
                    options={[
                      { value: '', label: 'None / Executive', description: 'Reports to executive leadership' },
                      ...managers.map((m) => ({
                        value: String(m.id),
                        label: m.user?.name || `Manager #${m.id}`,
                        description: m.user?.email || undefined,
                      })),
                    ]}
                    searchable={managers.length > 5}
                    searchPlaceholder="Search managers..."
                    fullWidth
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Employment Details */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-[#F95716]" />
                <span>4. Employment Terms &amp; Start Date</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <CustomDropdown
                    label="Type"
                    value={employmentType}
                    onChange={setEmploymentType}
                    options={[
                      { value: 'permanent', label: 'Permanent', badge: 'Full-time' },
                      { value: 'contractor', label: 'Contractor', badge: '1099/B2B' },
                      { value: 'fixed_term', label: 'Fixed Term', badge: 'Contract' },
                      { value: 'part_time', label: 'Part Time', badge: 'Hourly' },
                      { value: 'intern', label: 'Intern', badge: 'Seasonal' },
                    ]}
                    searchable={false}
                    fullWidth
                    size="sm"
                  />
                </div>

                <div>
                  <CustomDropdown
                    label="Arrangement"
                    value={workArrangement}
                    onChange={setWorkArrangement}
                    options={[
                      { value: 'remote', label: 'Remote', description: 'Work anywhere' },
                      { value: 'hybrid', label: 'Hybrid', description: 'Partial office' },
                      { value: 'on_site', label: 'On-Site', description: 'Full-time office' },
                    ]}
                    searchable={false}
                    fullWidth
                    size="sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11.5px] font-bold text-slate-700 mb-1">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200/90 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#F95716] shadow-2xs min-h-[34px] cursor-pointer"
                  />
                </div>

                <div>
                  <CustomDropdown
                    label="Initial Status"
                    value={initialStatus}
                    onChange={(val) => setInitialStatus(val as any)}
                    options={[
                      { value: 'active', label: 'Active', colorDot: '#10b981', description: 'Immediate portal access' },
                      { value: 'onboarding', label: 'Onboarding', colorDot: '#f59e0b', description: 'Welcome checklist mode' },
                    ]}
                    searchable={false}
                    fullWidth
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Right Live Preview: Col 8-12 */}
          <div className="lg:col-span-5 bg-gradient-to-b from-orange-50/60 via-slate-50/50 to-white rounded-3xl p-5 border border-slate-200/90 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold block">
                  LIVE PROFILE MANIFEST
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  Employee Identity Card
                </h4>
              </div>

              {/* Dynamic Employee Virtual Badge */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3.5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-orange-400/10 to-transparent rounded-bl-full pointer-events-none" />

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20 shrink-0">
                    {getInitials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-slate-900 text-sm truncate">
                      {name || 'New Employee'}
                    </h5>
                    <p className="text-xs text-slate-500 truncate font-mono">
                      {email || 'employee@company.com'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Designation
                    </span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {selectedDesigObj?.name || 'Team Member'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Department
                    </span>
                    <span className="font-semibold text-[#F95716] truncate block">
                      {selectedDeptObj?.name || 'General Operations'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Work Role
                    </span>
                    <span className="font-semibold text-slate-800 capitalize block">
                      {roleSlug.replace('-', ' ')}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Arrangement
                    </span>
                    <span className="font-semibold text-slate-800 capitalize block">
                      {workArrangement} • {employmentType}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Account Access:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Member</span>
                  </span>
                </div>
              </div>

              {/* Credential Readiness Checklist */}
              <div className="bg-white/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                  Credential Handshake
                </span>
                <div className="space-y-1.5 text-[11.5px]">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${email && email.includes('@') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {email && email.includes('@') ? '✓' : '•'}
                    </span>
                    <span>Valid login email format</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${password.length >= 6 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {password.length >= 6 ? '✓' : '•'}
                    </span>
                    <span>Encrypted login password prepared</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                    <span>Attached to {companyName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span>Required fields completed</span>
                <span className="font-mono text-slate-700">
                  {completedRequired} / {totalRequired}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#F95716] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Fields marked <span className="text-[#F95716] font-bold">*</span> are required
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-employee-form"
              disabled={loading || !name.trim() || !email.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Employee Account</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

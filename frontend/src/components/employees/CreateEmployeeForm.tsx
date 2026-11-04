import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  Eye,
  EyeOff,
  Key,
  Check,
  MapPin,
  CheckCircle2,
  Copy,
  RefreshCw,
  Phone,
  BadgeCheck,
  ShieldCheck,
  ExternalLink,
  Users,
  AlertTriangle,
  HeartPulse,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../../lib/api';
import { CustomDropdown } from '../ui/CustomDropdown';
import { CustomDatePicker } from '../ui/CustomCalendar';
import { EmployeeCredentials } from './CreateEmployeeModal';
import {
  ShiftTimingCard,
  ShiftItem,
  DepartmentItem,
  DesignationItem,
  ManagerItem,
  SHIFT_PRESETS,
} from './ShiftTimingCard';
import { EmployeeBadgePreview } from './EmployeeBadgePreview';

export interface CreateEmployeeFormProps {
  companySlug?: string;
  onSuccess?: (credentials: EmployeeCredentials, employee: any) => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
  departments?: DepartmentItem[];
  designations?: DesignationItem[];
  managers?: ManagerItem[];
  shifts?: ShiftItem[];
}

export const CreateEmployeeForm: React.FC<CreateEmployeeFormProps> = ({
  companySlug,
  onSuccess,
  onCancel,
  showCancelButton = true,
  departments: propDepartments,
  designations: propDesignations,
  managers: propManagers,
  shifts: propShifts,
}) => {
  const slug = companySlug || 'bitspark-ops';

  // Auxiliary state
  const [departments, setDepartments] = useState<DepartmentItem[]>(propDepartments || []);
  const [designations, setDesignations] = useState<DesignationItem[]>(propDesignations || []);
  const [managers, setManagers] = useState<ManagerItem[]>(propManagers || []);
  const [availableShifts, setAvailableShifts] = useState<ShiftItem[]>(propShifts || []);

  // Section 1: Core Identity
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState(() => `Finovo@${Math.floor(1000 + Math.random() * 9000)}!`);
  const [showPassword, setShowPassword] = useState(false);

  // Section 2: Organizational Placement
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [managerMembershipId, setManagerMembershipId] = useState('');
  const [roleSlug, setRoleSlug] = useState('employee');

  // Section 3: Shift Timing & Work Schedule
  const [shiftSelectionMode, setShiftSelectionMode] = useState<'preset' | 'existing' | 'custom'>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState('std_day');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [shiftName, setShiftName] = useState('Standard Day Shift');
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('18:00');
  const [shiftTimezone, setShiftTimezone] = useState('America/New_York');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState('15');
  const [breakDurationMinutes, setBreakDurationMinutes] = useState('60');

  // Section 4: Employment Terms & Location
  const [employmentType, setEmploymentType] = useState('permanent');
  const [workArrangement, setWorkArrangement] = useState('remote');
  const [workLocation, setWorkLocation] = useState('Headquarters');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [initialStatus, setInitialStatus] = useState<'active' | 'onboarding'>('active');
  const [probationMonths, setProbationMonths] = useState('3');
  const [baseSalary, setBaseSalary] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('USD');
  const [payFrequency, setPayFrequency] = useState('monthly');

  // Section 5: Demographics & Personal Details (Collapsible)
  const [showPersonalDetails, setShowPersonalDetails] = useState(true);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');

  // Section 6: Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Section 7: Security Options
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  // Submission & Success state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeCredentials | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Auto-fetch aux data if not provided
  useEffect(() => {
    let isMounted = true;
    const fetchAuxData = async () => {
      try {
        const [deptRes, desigRes, memberRes, shiftRes] = await Promise.allSettled([
          api.get(`/companies/${slug}/departments`),
          api.get(`/companies/${slug}/designations`),
          api.get(`/companies/${slug}/members?status=active&per_page=100`),
          api.get(`/companies/${slug}/attendance/shifts`),
        ]);

        if (!isMounted) return;

        if (!propDepartments && deptRes.status === 'fulfilled' && deptRes.value.data?.departments) {
          setDepartments(deptRes.value.data.departments);
        } else if (!propDepartments && departments.length === 0) {
          setDepartments([
            { id: 1, name: 'Engineering', code: 'ENG' },
            { id: 2, name: 'Product & Design', code: 'PROD' },
            { id: 3, name: 'Operations', code: 'OPS' },
            { id: 4, name: 'Sales & Marketing', code: 'MKT' },
            { id: 5, name: 'Human Resources', code: 'HR' },
          ]);
        }

        if (!propDesignations && desigRes.status === 'fulfilled' && desigRes.value.data?.designations) {
          setDesignations(desigRes.value.data.designations);
        } else if (!propDesignations && designations.length === 0) {
          setDesignations([
            { id: 1, name: 'Software Engineer', level: 'L2' },
            { id: 2, name: 'Senior Full Stack Engineer', level: 'L3' },
            { id: 3, name: 'Product Designer', level: 'L2' },
            { id: 4, name: 'Engineering Manager', level: 'M1' },
            { id: 5, name: 'HR Operations Lead', level: 'L3' },
          ]);
        }

        if (!propManagers && memberRes.status === 'fulfilled' && memberRes.value.data?.members) {
          const list = memberRes.value.data.members?.data || memberRes.value.data.members || [];
          setManagers(list);
        }

        if (!propShifts && shiftRes.status === 'fulfilled' && shiftRes.value.data?.shifts) {
          const sList: ShiftItem[] = shiftRes.value.data.shifts;
          setAvailableShifts(sList);
          if (sList.length > 0) {
            setSelectedShiftId(String(sList[0].id));
          }
        }
      } catch {
        // Fallbacks remain active
      }
    };

    fetchAuxData();
    return () => {
      isMounted = false;
    };
  }, [slug, propDepartments, propDesignations, propManagers, propShifts]);

  // Handle Preset Selection
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = SHIFT_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setShiftName(found.name);
      setShiftStartTime(found.startTime);
      setShiftEndTime(found.endTime);
    }
  };

  // Toggle Working Day
  const handleToggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

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

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh)) return timeStr;
    const period = hh >= 12 ? 'PM' : 'AM';
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${hour12.toString().padStart(2, '0')}:${(mm || 0).toString().padStart(2, '0')} ${period}`;
  };

  const calculatedProbationEndDate = useMemo(() => {
    if (!hireDate) return '';
    const months = parseInt(probationMonths, 10);
    if (isNaN(months) || months <= 0) return '';
    const d = new Date(hireDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  }, [hireDate, probationMonths]);

  const selectedDeptObj = useMemo(
    () => departments.find((d) => String(d.id) === departmentId),
    [departments, departmentId]
  );

  const selectedDesigObj = useMemo(
    () => designations.find((d) => String(d.id) === designationId),
    [designations, designationId]
  );

  // Field readiness & progress
  const readinessChecklist = useMemo(() => {
    const validName = Boolean(name.trim().length >= 2);
    const validEmail = Boolean(email.trim().includes('@') && email.trim().includes('.'));
    const validPassword = Boolean(password.length >= 6);
    const hasShift = Boolean(shiftStartTime && shiftEndTime);
    const hasDepartment = Boolean(departmentId);
    const hasDesignation = Boolean(designationId);
    const hasEmergency = Boolean(emergencyContactName && emergencyContactPhone);

    const items = [
      { id: 'name', label: 'Full legal name provided', done: validName, required: true },
      { id: 'email', label: 'Valid enterprise work email', done: validEmail, required: true },
      { id: 'password', label: 'Secure temporary credentials', done: validPassword, required: true },
      { id: 'shift', label: 'Shift schedule & timing assigned', done: hasShift, required: false },
      { id: 'dept', label: 'Department assignment selected', done: hasDepartment, required: false },
      { id: 'desig', label: 'Job designation / level mapped', done: hasDesignation, required: false },
      { id: 'emergency', label: 'Emergency contact registered', done: hasEmergency, required: false },
    ];

    const totalDone = items.filter((i) => i.done).length;
    const percentage = Math.round((totalDone / items.length) * 100);

    return {
      items,
      totalDone,
      total: items.length,
      percentage,
      isValid: validName && validEmail && validPassword,
    };
  }, [
    name,
    email,
    password,
    shiftStartTime,
    shiftEndTime,
    departmentId,
    designationId,
    emergencyContactName,
    emergencyContactPhone,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readinessChecklist.isValid) {
      setErrorMessage('Please provide a valid full name, email address, and temporary password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: Record<string, any> = {
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
        probation_end_date: calculatedProbationEndDate || undefined,
      };

      if (selectedShiftId && shiftSelectionMode === 'existing') {
        payload.shift_id = parseInt(selectedShiftId, 10);
      } else if (availableShifts.length > 0) {
        payload.shift_id = availableShifts[0].id;
      }

      if (dateOfBirth) payload.date_of_birth = dateOfBirth;
      if (gender) payload.gender = gender;
      if (maritalStatus) payload.marital_status = maritalStatus;
      if (nationalIdNumber) payload.national_id_number = nationalIdNumber.trim();
      if (personalEmail) payload.personal_email = personalEmail.trim().toLowerCase();
      if (personalPhone || phoneNumber) payload.personal_phone = (personalPhone || phoneNumber).trim();
      if (emergencyContactName) payload.emergency_contact_name = emergencyContactName.trim();
      if (emergencyContactRelationship) payload.emergency_contact_relationship = emergencyContactRelationship.trim();
      if (emergencyContactPhone) payload.emergency_contact_phone = emergencyContactPhone.trim();
      if (residentialAddress) payload.residential_address = residentialAddress.trim();

      const res = await api.post(`/companies/${slug}/employees`, payload);

      const creds: EmployeeCredentials = res.data.credentials || {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        company_slug: slug,
        company_name: res.data.company_name || 'Finovo Organization',
        role:
          roleSlug === 'company-admin'
            ? 'Company Administrator'
            : roleSlug === 'project-manager'
            ? 'Project Manager'
            : roleSlug === 'hr-officer'
            ? 'HR Officer'
            : 'Employee',
        login_url: `${window.location.origin}/login`,
      };

      setCreatedCredentials(creds);
      if (onSuccess) {
        onSuccess(creds, res.data.employee);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          'Failed to create employee profile. Please check that work email is unique and all required fields are filled.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (!createdCredentials) return;
    navigator.clipboard.writeText(createdCredentials.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCopyAll = () => {
    if (!createdCredentials) return;
    const text = `Finovo Workspace Account Credentials
------------------------------------
Employee: ${createdCredentials.name}
Organization: ${createdCredentials.company_name} (/${createdCredentials.company_slug})
Email / Username: ${createdCredentials.email}
Password: ${createdCredentials.password}
Access Role: ${createdCredentials.role}
Shift Timing: ${formatTime12h(shiftStartTime)} – ${formatTime12h(shiftEndTime)} (${workingDays.join(', ')})
Login Link: ${createdCredentials.login_url || window.location.origin + '/login'}
------------------------------------
Please sign in and change your temporary password if required.`;

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleResetForm = () => {
    setName('');
    setEmail('');
    setPhoneNumber('');
    setEmployeeNumber('');
    setDepartmentId('');
    setDesignationId('');
    setManagerMembershipId('');
    setRoleSlug('employee');
    setEmploymentType('permanent');
    setWorkArrangement('remote');
    setWorkLocation('Headquarters');
    setInitialStatus('active');
    setDateOfBirth('');
    setGender('');
    setMaritalStatus('');
    setNationalIdNumber('');
    setPersonalEmail('');
    setPersonalPhone('');
    setResidentialAddress('');
    setEmergencyContactName('');
    setEmergencyContactRelationship('');
    setEmergencyContactPhone('');
    setBaseSalary('');
    handleGeneratePassword();
    setCreatedCredentials(null);
    setErrorMessage(null);
  };

  // Success view
  if (createdCredentials) {
    return (
      <div className="max-w-4xl mx-auto py-6 sm:py-8 space-y-6 animate-in fade-in zoom-in-98 duration-200 font-['Inter',sans-serif]">
        {/* Top Success Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-500/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-600 block">
                ONBOARDING COMPLETE
              </span>
              <h2 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {createdCredentials.name} is ready
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Shift schedule assigned: <strong className="text-slate-800">{formatTime12h(shiftStartTime)} – {formatTime12h(shiftEndTime)}</strong> ({workingDays.join(', ')}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedAll ? 'Credentials Copied!' : 'Copy Credentials'}</span>
            </button>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#F95716]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Employee Access Credentials
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold font-mono">
                ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Target Workspace
                  </span>
                  <span className="font-semibold text-slate-800">{createdCredentials.company_name}</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                  /{createdCredentials.company_slug}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Work Email (Login ID)
                  </span>
                  <span className="font-mono font-medium text-slate-900 truncate block">
                    {createdCredentials.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(createdCredentials.email)}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Copy Email"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Temporary Password
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                    {showPassword ? createdCredentials.password : '••••••••••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedPassword ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-orange-50/50 border border-orange-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-600 block tracking-wider flex items-center gap-1">
                    <span>Shift Timing &amp; Schedule</span>
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatTime12h(shiftStartTime)} – {formatTime12h(shiftEndTime)}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {workingDays.join(', ')} • {shiftTimezone}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white text-orange-700 font-semibold border border-orange-200">
                  {shiftName}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Platform Login Link
                  </span>
                  <span className="font-mono text-xs text-blue-600 truncate block">
                    {createdCredentials.login_url}
                  </span>
                </div>
                <a
                  href={createdCredentials.login_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-[#F95716] transition-colors cursor-pointer"
                  title="Open Login Link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11.5px] text-amber-800 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Provide these credentials to the employee. They will be prompted to change their temporary password upon initial login and acknowledge workspace guidelines.
              </p>
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                IDENTITY SUMMARY
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20">
                  {getInitials(createdCredentials.name)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {createdCredentials.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {createdCredentials.email}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDeptObj?.name || 'General Operations'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Designation:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDesigObj?.name || 'Team Member'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Shift Schedule:</span>
                  <span className="font-semibold text-[#F95716]">
                    {formatTime12h(shiftStartTime)} – {formatTime12h(shiftEndTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Work Model:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {workArrangement} ({employmentType})
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to={`/app/${slug}/employees`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-all text-center"
              >
                <Users className="w-4 h-4" />
                <span>Return to Employee Directory</span>
              </Link>
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-slate-500" />
                <span>Add Another Employee</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3 shadow-2xs animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Employee Creation Error</span>
            <p className="mt-0.5 text-rose-600 leading-relaxed font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form on Left (Col 8), Live Preview on Right (Col 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Form: Col 1-8 */}
        <form onSubmit={handleSubmit} id="create-employee-form" className="lg:col-span-8 space-y-6">
          {/* Section 1: Core Identity & Contact Details */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Core Identity &amp; Contact Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Primary workforce identifiers and contact information
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#F95716] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 font-bold">
                REQUIRED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Full Legal Name <span className="text-[#F95716]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Work Email (Login Username) <span className="text-[#F95716]">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="alex.morgan@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Employee ID / Badge # <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. EMP-0042 (Auto-generated if blank)"
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Contact Phone <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="+1 (555) 019-2834"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shift Timing & Work Schedule */}
          <ShiftTimingCard
            shiftSelectionMode={shiftSelectionMode}
            setShiftSelectionMode={setShiftSelectionMode}
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            availableShifts={availableShifts}
            selectedShiftId={selectedShiftId}
            onSelectExistingShift={(shift) => {
              setSelectedShiftId(String(shift.id));
              setShiftName(shift.name);
              setShiftStartTime(shift.start_time.substring(0, 5));
              setShiftEndTime(shift.end_time.substring(0, 5));
              if (shift.timezone) setShiftTimezone(shift.timezone);
            }}
            shiftStartTime={shiftStartTime}
            setShiftStartTime={setShiftStartTime}
            shiftEndTime={shiftEndTime}
            setShiftEndTime={setShiftEndTime}
            shiftTimezone={shiftTimezone}
            setShiftTimezone={setShiftTimezone}
            workingDays={workingDays}
            onToggleWorkingDay={handleToggleDay}
            gracePeriodMinutes={gracePeriodMinutes}
            setGracePeriodMinutes={setGracePeriodMinutes}
            breakDurationMinutes={breakDurationMinutes}
            setBreakDurationMinutes={setBreakDurationMinutes}
            formatTime12h={formatTime12h}
          />

          {/* Section 3: Organizational Hierarchy & Access Role */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Organizational Hierarchy &amp; Permissions
                  </h3>
                  <p className="text-xs text-slate-400">
                    Department, job title, reporting manager, and access level
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <CustomDropdown
                  label="Department"
                  placeholder="Select Department"
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={[
                    { value: '', label: 'Unassigned / General Operations', description: 'No specific department' },
                    ...departments.map((d) => ({
                      value: String(d.id),
                      label: d.name,
                      description: d.code ? `Dept Code: ${d.code}` : undefined,
                      badge: d.code || undefined,
                    })),
                  ]}
                  searchable={departments.length > 4}
                  searchPlaceholder="Search departments..."
                  fullWidth
                  size="md"
                />
              </div>

              <div>
                <CustomDropdown
                  label="Job Title / Designation"
                  placeholder="Select Designation"
                  value={designationId}
                  onChange={setDesignationId}
                  options={[
                    { value: '', label: 'Select Designation', description: 'General team member' },
                    ...designations.map((des) => ({
                      value: String(des.id),
                      label: des.name,
                      description: des.level ? `Grade: ${des.level}` : undefined,
                      badge: des.level ? String(des.level) : undefined,
                    })),
                  ]}
                  searchable={designations.length > 4}
                  searchPlaceholder="Search designations..."
                  fullWidth
                  size="md"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <CustomDropdown
                  label="Reporting Manager"
                  placeholder="None / Executive"
                  value={managerMembershipId}
                  onChange={setManagerMembershipId}
                  options={[
                    { value: '', label: 'None / Executive', description: 'Direct report to leadership' },
                    ...managers.map((m) => ({
                      value: String(m.id),
                      label: m.user?.name || `Manager #${m.id}`,
                      description: m.user?.email || undefined,
                    })),
                  ]}
                  searchable={managers.length > 4}
                  searchPlaceholder="Search managers..."
                  fullWidth
                  size="md"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Workspace Access Role <span className="text-[#F95716]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    slug: 'employee',
                    title: 'Employee',
                    badge: 'Standard',
                    desc: 'Tasks, attendance check-ins, documents & communication.',
                    color: 'border-slate-200 hover:border-slate-300',
                    activeColor: 'border-[#F95716] bg-orange-50/20 ring-2 ring-[#F95716]/10',
                  },
                  {
                    slug: 'project-manager',
                    title: 'Project Manager',
                    badge: 'PM',
                    desc: 'Create projects, assign tasks, review milestones & team.',
                    color: 'border-slate-200 hover:border-slate-300',
                    activeColor: 'border-[#F95716] bg-orange-50/20 ring-2 ring-[#F95716]/10',
                  },
                  {
                    slug: 'hr-officer',
                    title: 'HR Officer',
                    badge: 'HR',
                    desc: 'Workforce records, onboarding, leave approvals & shifts.',
                    color: 'border-slate-200 hover:border-slate-300',
                    activeColor: 'border-[#F95716] bg-orange-50/20 ring-2 ring-[#F95716]/10',
                  },
                  {
                    slug: 'company-admin',
                    title: 'Company Admin',
                    badge: 'Admin',
                    desc: 'Full tenant control, billing, integrations & audit logs.',
                    color: 'border-slate-200 hover:border-slate-300',
                    activeColor: 'border-[#F95716] bg-orange-50/20 ring-2 ring-[#F95716]/10',
                  },
                ].map((role) => (
                  <div
                    key={role.slug}
                    onClick={() => setRoleSlug(role.slug)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                      roleSlug === role.slug ? role.activeColor : `${role.color} bg-white`
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{role.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                          {role.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{role.desc}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          roleSlug === role.slug
                            ? 'border-[#F95716] bg-[#F95716] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {roleSlug === role.slug && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Employment Terms, Compensation & Probation */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 font-bold">
                  4
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Employment Terms, Compensation &amp; Probation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Work arrangement, start date, probation duration, and base compensation
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <CustomDropdown
                  label="Employment Type"
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
                  size="md"
                />
              </div>

              <div>
                <CustomDropdown
                  label="Arrangement"
                  value={workArrangement}
                  onChange={setWorkArrangement}
                  options={[
                    { value: 'remote', label: 'Remote', description: 'Work from anywhere' },
                    { value: 'hybrid', label: 'Hybrid', description: 'Home & office' },
                    { value: 'on_site', label: 'On-Site', description: 'Full-time at facility' },
                  ]}
                  searchable={false}
                  fullWidth
                  size="md"
                />
              </div>

              <div>
                <CustomDatePicker
                  label="Hire / Start Date"
                  value={hireDate}
                  onChange={setHireDate}
                  placeholder="Select hire date"
                  required
                />
              </div>

              <div>
                <CustomDropdown
                  label="Probation Period"
                  value={probationMonths}
                  onChange={setProbationMonths}
                  options={[
                    { value: '0', label: 'No Probation', description: 'Immediate confirmed status' },
                    { value: '1', label: '1 Month', description: '30-day initial trial' },
                    { value: '3', label: '3 Months (Standard)', description: 'Standard 90-day evaluation', badge: 'Standard' },
                    { value: '6', label: '6 Months', description: 'Extended probationary window' },
                  ]}
                  fullWidth
                  size="md"
                />
                {calculatedProbationEndDate && (
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                    Ends: {calculatedProbationEndDate}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 pt-1">
              <div className="sm:col-span-2 lg:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Assigned Office / Facility Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Headquarters - San Francisco, CA"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 lg:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Base Compensation <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    placeholder="e.g. 75000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 lg:col-span-2">
                <CustomDropdown
                  label="Currency"
                  value={salaryCurrency}
                  onChange={setSalaryCurrency}
                  options={[
                    { value: 'USD', label: 'USD ($)', badge: '$' },
                    { value: 'EUR', label: 'EUR (€)', badge: '€' },
                    { value: 'GBP', label: 'GBP (£)', badge: '£' },
                    { value: 'PKR', label: 'PKR (₨)', badge: '₨' },
                    { value: 'CAD', label: 'CAD ($)', badge: '$' },
                  ]}
                  fullWidth
                  size="md"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <CustomDropdown
                  label="Frequency"
                  value={payFrequency}
                  onChange={setPayFrequency}
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'biweekly', label: 'Bi-weekly' },
                    { value: 'annual', label: 'Annual' },
                  ]}
                  fullWidth
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Demographics & Emergency Contact */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div
              className="flex items-center justify-between border-b border-slate-100 pb-3 cursor-pointer select-none"
              onClick={() => setShowPersonalDetails(!showPersonalDetails)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 font-bold">
                  5
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                      Personal Demographics &amp; Emergency Contact
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      HR RECORDS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    National ID, date of birth, marital status, emergency contact, and home address
                  </p>
                </div>
              </div>

              <button type="button" className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                {showPersonalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showPersonalDetails && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <CustomDatePicker
                      label="Date of Birth"
                      value={dateOfBirth}
                      onChange={setDateOfBirth}
                      placeholder="Select birth date"
                    />
                  </div>

                  <div>
                    <CustomDropdown
                      label="Gender"
                      value={gender}
                      onChange={setGender}
                      placeholder="Select Gender"
                      options={[
                        { value: '', label: 'Select Gender' },
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                        { value: 'Non-Binary', label: 'Non-Binary' },
                        { value: 'Prefer not to say', label: 'Prefer not to say' },
                      ]}
                      fullWidth
                      size="md"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
                    <CustomDropdown
                      label="Marital Status"
                      value={maritalStatus}
                      onChange={setMaritalStatus}
                      placeholder="Select Status"
                      options={[
                        { value: '', label: 'Select Status' },
                        { value: 'Single', label: 'Single' },
                        { value: 'Married', label: 'Married' },
                        { value: 'Divorced', label: 'Divorced' },
                        { value: 'Other', label: 'Other' },
                      ]}
                      fullWidth
                      size="md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      National ID / SSN / Tax Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 123-45-6789 or National ID"
                      value={nationalIdNumber}
                      onChange={(e) => setNationalIdNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Personal / Secondary Email
                    </label>
                    <input
                      type="email"
                      placeholder="personal.email@gmail.com"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Residential Home Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street Address, City, State / Province, Postal Code"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-800">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Emergency Contact Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maria Morgan"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs"
                    />
                  </div>

                  <div>
                    <CustomDropdown
                      label="Relationship"
                      value={emergencyContactRelationship}
                      onChange={setEmergencyContactRelationship}
                      placeholder="Select Relationship"
                      options={[
                        { value: '', label: 'Select Relationship' },
                        { value: 'Spouse', label: 'Spouse / Partner' },
                        { value: 'Parent', label: 'Parent' },
                        { value: 'Sibling', label: 'Sibling' },
                        { value: 'Child', label: 'Child' },
                        { value: 'Friend', label: 'Friend' },
                        { value: 'Guardian', label: 'Guardian' },
                      ]}
                      fullWidth
                      size="md"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 098-7654"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Security & Initial Credentials */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 font-bold">
                  6
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                    Security &amp; Initial Credentials
                  </h3>
                  <p className="text-xs text-slate-400">
                    Generate encrypted temporary credentials for immediate workspace onboarding
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Temporary Login Password <span className="text-[#F95716]">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex items-center gap-1.5 text-xs text-[#F95716] hover:text-[#ea4d10] font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate New Secure Password</span>
                </button>
              </div>

              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter or generate temporary password"
                  className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716] shadow-2xs transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={requirePasswordChange}
                    onChange={(e) => setRequirePasswordChange(e.target.checked)}
                    className="w-4 h-4 rounded text-[#F95716] focus:ring-[#F95716] border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Require password reset</span>
                    <span className="text-[11px] text-slate-400">Employee must choose new password on first login</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={sendWelcomeEmail}
                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#F95716] focus:ring-[#F95716] border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Send welcome notification</span>
                    <span className="text-[11px] text-slate-400">Dispatch access link to work email</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Optional bottom cancel button */}
          {showCancelButton && onCancel && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </form>

        {/* Right Column: Live Badge Preview (Col 4) */}
        <div className="lg:col-span-4">
          <EmployeeBadgePreview
            name={name}
            email={email}
            employeeNumber={employeeNumber}
            selectedDeptObj={selectedDeptObj}
            selectedDesigObj={selectedDesigObj}
            roleSlug={roleSlug}
            workArrangement={workArrangement}
            initialStatus={initialStatus}
            shiftStartTime={shiftStartTime}
            shiftEndTime={shiftEndTime}
            workingDays={workingDays}
            shiftTimezone={shiftTimezone}
            readinessPercentage={readinessChecklist.percentage}
            readinessItems={readinessChecklist.items}
            submitting={submitting}
            isValid={readinessChecklist.isValid}
            getInitials={getInitials}
            formatTime12h={formatTime12h}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateEmployeeForm;

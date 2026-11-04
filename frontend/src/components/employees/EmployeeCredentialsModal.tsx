import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Building,
  Key,
  Mail,
  X,
} from 'lucide-react';
import { EmployeeCredentials } from './CreateEmployeeModal';

export interface EmployeeCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: EmployeeCredentials | null;
}

export const EmployeeCredentialsModal: React.FC<EmployeeCredentialsModalProps> = ({
  isOpen,
  onClose,
  credentials,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  if (!isOpen || !credentials) return null;

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(credentials.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCopyAll = () => {
    const text = `Finovo Workspace Account Credentials
------------------------------------
Employee: ${credentials.name}
Organization: ${credentials.company_name} (/${credentials.company_slug})
Email / Username: ${credentials.email}
Password: ${credentials.password}
Access Role: ${credentials.role}
Login Link: ${credentials.login_url || window.location.origin + '/login'}
------------------------------------
Please sign in and change your temporary password if required.`;

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-['Inter',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden my-auto p-6 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-emerald-600 font-bold block">
                ACCOUNT CREATED &amp; ACTIVE
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                Employee Credentials Provisioned
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          The employee account for <strong className="text-slate-800">{credentials.name}</strong> has been generated and enrolled in <strong className="text-slate-800">{credentials.company_name}</strong>. Share these credentials with the employee to sign in.
        </p>

        {/* Credentials Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3 text-xs">
          {/* Organization */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Organization</span>
            </span>
            <span className="font-bold text-slate-800 font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {credentials.company_slug}
            </span>
          </div>

          {/* Role */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Assigned Role</span>
            </span>
            <span className="font-semibold text-slate-800 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[11px] border border-emerald-200/60">
              {credentials.role}
            </span>
          </div>

          {/* Email / Username */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Login Email</span>
            </span>
            <span className="font-mono text-slate-900 font-bold select-all">
              {credentials.email}
            </span>
          </div>

          {/* Password */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#F95716]" />
              <span>Temporary Password</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 select-all">
                {showPassword ? credentials.password : '••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="p-1 text-[#F95716] hover:text-orange-700 cursor-pointer"
                title="Copy password"
              >
                {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/70 text-[11px] text-orange-950 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#F95716] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            The employee can navigate to <strong>{window.location.origin}/login</strong> and use these credentials to access this workspace dashboard immediately.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700">Credentials Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Credentials</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <span>Done &amp; View Directory</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Key, X, Eye, EyeOff, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { EmployeeCredentials } from './CreateEmployeeModal';

export interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  companySlug: string;
  onSuccess: (credentials: EmployeeCredentials) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  employee,
  companySlug,
  onSuccess,
}) => {
  const [password, setPassword] = useState(() => `Finovo@${Math.floor(1000 + Math.random() * 9000)}!`);
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !employee) return null;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let newPass = 'Finovo@';
    for (let i = 0; i < 4; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newPass += '!';
    setPassword(newPass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post(`/companies/${companySlug}/employees/${employee.id}/reset-password`, {
        password: password.trim(),
      });

      const creds: EmployeeCredentials = res.data.credentials || {
        name: employee.user?.name || employee.employee_number,
        email: employee.user?.email || '',
        password: password.trim(),
        company_slug: companySlug,
        company_name: 'Bitspark Global Operations',
        role: employee.membership?.roles?.[0]?.name || 'Employee',
        login_url: `${window.location.origin}/login`,
      };

      onSuccess(creds);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset employee password.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-['Inter',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F95716] flex items-center justify-center border border-orange-100 shadow-2xs">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reset Credentials</h3>
              <p className="text-[11px] text-slate-400">
                {employee.user?.name || employee.employee_number} ({employee.user?.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 block">New Login Password</label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[10.5px] font-semibold text-[#F95716] hover:text-orange-700 cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate Random</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#F95716]/20 focus:border-[#F95716]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10.5px] text-slate-400">
              The employee can use this new password immediately to sign in.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Save &amp; Reset Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, KeyRound, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export const MfaChallengePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const challengeToken = searchParams.get('token') || '';
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setLoading(true);

    try {
      const payload: Record<string, string> = {
        challenge_token: challengeToken,
      };

      if (useRecovery) {
        payload.recovery_code = code.trim();
      } else {
        payload.code = code.trim();
      }

      const res = await api.post('/auth/mfa/challenge', payload);
      await login(res.data.token, res.data.user);
      navigate('/select-workspace');
    } catch (err: any) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Verification failed. Please check the authentication code.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroHeadlineMain="Two-factor verification for"
      heroHeadlineHighlight1="enterprise security &"
      heroHeadlineHighlight2="zero-trust access"
      heroSubtitle="Your account is protected by hardware or authenticator-based secondary credential validation."
    >
      <AuthCard
        title="Two-Factor Verification"
        subtitle={
          useRecovery
            ? 'Enter one of your 8-character backup recovery codes'
            : 'Enter the 6-digit code from your authenticator app'
        }
        serverError={serverError}
        footerContent={
          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        }
      >
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              {useRecovery ? 'Recovery Code' : 'Authentication Code'} <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                {useRecovery ? <KeyRound className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
              <input
                type="text"
                autoComplete="one-time-code"
                placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 placeholder-slate-400 text-xs pl-10 pr-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#f05a22] to-[#f97316] hover:from-[#e54e17] hover:to-[#ea6308] active:scale-[0.99] text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <span>Verify & Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode('');
                setServerError(null);
              }}
              className="text-xs text-[#f95716] hover:text-orange-700 font-medium transition-colors cursor-pointer"
            >
              {useRecovery ? 'Use authenticator app code instead' : 'Lost your device? Use a backup recovery code'}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

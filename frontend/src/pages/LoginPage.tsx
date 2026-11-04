import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import { MicrosoftLogo } from '../components/ui/MicrosoftLogo';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Please enter your work email or username'),
  password: z.string().min(1, 'Please enter your password'),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: true,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
        remember: data.remember,
      });

      if (res.data.mfa_required) {
        navigate(`/mfa/challenge?token=${encodeURIComponent(res.data.challenge_token)}`);
        return;
      }

      await login(res.data.token, res.data.user);
      navigate('/select-workspace');
    } catch (err: any) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome back"
        subtitle="Sign in to your Finovo Global workspace account"
        serverError={serverError}
        footerContent={
          <p className="text-xs text-slate-500 text-center mt-3">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-[#f95716] hover:text-orange-700 transition-colors">
              Sign up
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Email or Username <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoComplete="username"
                placeholder="name@company.com or username"
                className={`w-full rounded-xl bg-white border text-slate-800 placeholder-slate-400 text-xs pl-10 pr-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.email ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[11.5px] font-semibold text-slate-700">
                Password <span className="text-[#f95716]">*</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#f95716] hover:text-orange-700 transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className={`w-full rounded-xl bg-white border text-slate-800 placeholder-slate-400 text-xs pl-10 pr-10 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.password ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-[#f95716] focus:ring-orange-500/20 accent-[#f95716] cursor-pointer"
                {...register('remember')}
              />
              <span>Remember this device for 30 days</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1.5 py-3 px-4 rounded-xl bg-gradient-to-r from-[#f05a22] to-[#f97316] hover:from-[#e54e17] hover:to-[#ea6308] active:scale-[0.99] text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="relative py-1.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-white px-2.5 text-slate-400">OR</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] text-slate-700 text-xs font-semibold shadow-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <MicrosoftLogo className="w-4 h-4 shrink-0" />
            <span>Continue with Microsoft SSO</span>
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

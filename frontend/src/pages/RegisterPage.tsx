import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Please enter a valid work email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string().min(1, 'Please confirm your password'),
  terms: z.boolean().refine((val) => val === true, 'You must accept the terms of service'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      terms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/register', data);
      await login(res.data.token, res.data.user);
      navigate('/onboarding');
    } catch (err: any) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Registration failed. Please check your inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroHeadlineMain="Join the intelligent"
      heroHeadlineHighlight1="workspace for people,"
      heroHeadlineHighlight2="projects & operations"
    >
      <AuthCard
        title="Create an account"
        subtitle="Start managing your workspace on Finovo Global Enterprise OS"
        serverError={serverError}
        footerContent={
          <p className="text-xs text-slate-500 text-center mt-3">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#f95716] hover:text-orange-700 transition-colors">
              Sign in
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Full Name <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoComplete="name"
                placeholder="Alex Morgan"
                className={`w-full rounded-xl bg-white border text-slate-800 placeholder-slate-400 text-xs pl-10 pr-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.name ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register('name')}
              />
            </div>
            {errors.name && (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Work Email <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                autoComplete="email"
                placeholder="alex@company.com"
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
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Password <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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

          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Confirm Password <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter password"
                className={`w-full rounded-xl bg-white border text-slate-800 placeholder-slate-400 text-xs pl-10 pr-10 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.password_confirmation ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register('password_confirmation')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password_confirmation && (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.password_confirmation.message}</p>
            )}
          </div>

          <div className="pt-0.5">
            <label className="flex items-start gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#f95716] focus:ring-orange-500/20 accent-[#f95716] cursor-pointer shrink-0"
                {...register('terms')}
              />
              <span>
                I accept the{' '}
                <a href="#" className="text-[#f95716] underline hover:text-orange-700">Terms of Service</a>{' '}
                and{' '}
                <a href="#" className="text-[#f95716] underline hover:text-orange-700">Privacy Policy</a>.
              </span>
            </label>
            {errors.terms && (
              <p className="text-[10.5px] text-rose-500 mt-1">{errors.terms.message}</p>
            )}
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
                <span>Create Account & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

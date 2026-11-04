import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import api from '../lib/api';

const schema = z.object({
  email: z.string().trim().email('Please enter a valid work email address'),
});

type FormData = z.infer<typeof schema>;

export const ForgotPasswordPage: React.FC = () => {
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', data);
      setSuccess(res.data.message || 'If an account exists with this email, password reset instructions have been sent.');
    } catch (err: any) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Unable to process password reset. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroHeadlineMain="Secure recovery for your"
      heroHeadlineHighlight1="enterprise account &"
      heroHeadlineHighlight2="workspace access"
      heroSubtitle="Protecting your organizational data with multi-tier cryptographic verification and access security."
    >
      <AuthCard
        title="Reset password"
        subtitle="Enter your verified work email to receive password recovery instructions"
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
        {success ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{success}</p>
            </div>

            <Link to="/login" className="block w-full">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Return to Sign In
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  placeholder="name@company.com"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#f05a22] to-[#f97316] hover:from-[#e54e17] hover:to-[#ea6308] active:scale-[0.99] text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

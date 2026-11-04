import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Globe, Clock, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { AuthCard } from '../components/ui/AuthCard';
import { CustomSelect, SelectOption } from '../components/ui/CustomSelect';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const schema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  timezone: z.string().min(1, 'Please select a timezone'),
});

type FormData = z.infer<typeof schema>;

const BASE_TIMEZONES: SelectOption[] = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', description: 'Universal Standard Time', badge: 'UTC+0' },
  { value: 'America/New_York', label: 'America / New York', description: 'Eastern Time (US & Canada)', badge: 'UTC-5' },
  { value: 'America/Chicago', label: 'America / Chicago', description: 'Central Time (US & Canada)', badge: 'UTC-6' },
  { value: 'America/Denver', label: 'America / Denver', description: 'Mountain Time (US & Canada)', badge: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'America / Los Angeles', description: 'Pacific Time (US & Canada)', badge: 'UTC-8' },
  { value: 'America/Toronto', label: 'America / Toronto', description: 'Eastern Time (Canada)', badge: 'UTC-5' },
  { value: 'America/Sao_Paulo', label: 'America / São Paulo', description: 'Brasília Standard Time', badge: 'UTC-3' },
  { value: 'Europe/London', label: 'Europe / London', description: 'Greenwich Mean Time / BST', badge: 'UTC+0' },
  { value: 'Europe/Berlin', label: 'Europe / Berlin', description: 'Central European Time', badge: 'UTC+1' },
  { value: 'Europe/Paris', label: 'Europe / Paris', description: 'Central European Time', badge: 'UTC+1' },
  { value: 'Europe/Amsterdam', label: 'Europe / Amsterdam', description: 'Central European Time', badge: 'UTC+1' },
  { value: 'Europe/Madrid', label: 'Europe / Madrid', description: 'Central European Time', badge: 'UTC+1' },
  { value: 'Europe/Athens', label: 'Europe / Athens', description: 'Eastern European Time', badge: 'UTC+2' },
  { value: 'Asia/Dubai', label: 'Asia / Dubai', description: 'Gulf Standard Time (UAE, Oman)', badge: 'UTC+4' },
  { value: 'Asia/Riyadh', label: 'Asia / Riyadh', description: 'Arabian Standard Time (Saudi Arabia)', badge: 'UTC+3' },
  { value: 'Asia/Karachi', label: 'Asia / Karachi', description: 'Pakistan Standard Time', badge: 'UTC+5' },
  { value: 'Asia/Kolkata', label: 'Asia / Kolkata', description: 'India Standard Time', badge: 'UTC+5:30' },
  { value: 'Asia/Dhaka', label: 'Asia / Dhaka', description: 'Bangladesh Standard Time', badge: 'UTC+6' },
  { value: 'Asia/Bangkok', label: 'Asia / Bangkok', description: 'Indochina Time (Thailand, Vietnam)', badge: 'UTC+7' },
  { value: 'Asia/Singapore', label: 'Asia / Singapore', description: 'Singapore Standard Time', badge: 'UTC+8' },
  { value: 'Asia/Hong_Kong', label: 'Asia / Hong Kong', description: 'Hong Kong Time', badge: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Asia / Tokyo', description: 'Japan Standard Time', badge: 'UTC+9' },
  { value: 'Asia/Seoul', label: 'Asia / Seoul', description: 'Korea Standard Time', badge: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Australia / Sydney', description: 'Australian Eastern Time', badge: 'UTC+10' },
  { value: 'Pacific/Auckland', label: 'Pacific / Auckland', description: 'New Zealand Standard Time', badge: 'UTC+12' },
];

export const OnboardingPage: React.FC = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { refreshUser, companies } = useAuth();
  const navigate = useNavigate();

  const detectedTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const timezoneOptions = useMemo(() => {
    const exists = BASE_TIMEZONES.some((tz) => tz.value === detectedTz);
    if (!exists && detectedTz) {
      return [
        {
          value: detectedTz,
          label: `${detectedTz.replace('_', ' ')} (Detected)`,
          description: 'Local System Timezone',
          badge: 'Local',
        },
        ...BASE_TIMEZONES,
      ];
    }
    return BASE_TIMEZONES;
  }, [detectedTz]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      timezone: detectedTz,
    },
  });

  const currentTimezone = watch('timezone');
  const currentSlug = watch('slug');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('name', name, { shouldValidate: true });
    setValue('slug', generatedSlug, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setLoading(true);

    try {
      const res = await api.post('/companies', data);
      await refreshUser();
      navigate(`/app/${res.data.company.slug}/overview`);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else if (err.response?.data?.errors?.slug) {
        setServerError(err.response.data.errors.slug[0]);
      } else {
        setServerError('Unable to create organization. Please ensure the workspace slug is unique.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heroEyebrow="WORKSPACE ONBOARDING"
      heroHeadlineMain="Build your team's"
      heroHeadlineHighlight1="digital headquarters"
      heroHeadlineHighlight2="in minutes"
      heroSubtitle="Create your primary organization tenant to configure departments, invite colleagues, and orchestrate projects with complete visibility."
    >
      <AuthCard
        title="Create Organization"
        subtitle="Set up your company workspace to start onboarding your team"
        serverError={serverError}
        maxWidthClass="max-w-[450px]"
        footerContent={
          companies.length > 0 ? (
            <div className="mt-4 pt-3.5 border-t border-slate-100 text-center">
              <Link
                to="/select-workspace"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f95716] hover:text-orange-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to workspace selection
              </Link>
            </div>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Company Name */}
          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Organization Name <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="e.g. Acme Technologies"
                className={`w-full rounded-xl bg-white border text-slate-800 placeholder-slate-400 text-xs pl-10 pr-3.5 py-2.5 transition-all outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.name ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                onChange={handleNameChange}
              />
            </div>
            {errors.name && (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.name.message}</p>
            )}
          </div>

          {/* Workspace URL Slug */}
          <div className="space-y-1">
            <label className="block text-[11.5px] font-semibold text-slate-700">
              Workspace URL Slug <span className="text-[#f95716]">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="acme-technologies"
                className={`w-full rounded-xl bg-white border text-slate-800 font-mono placeholder-slate-400 text-xs pl-10 pr-3.5 py-2.5 transition-all outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-[#f95716] ${
                  errors.slug ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                }`}
                {...register('slug')}
              />
            </div>
            {errors.slug ? (
              <p className="text-[10.5px] text-rose-500 mt-0.5">{errors.slug.message}</p>
            ) : (
              <p className="text-[10.5px] text-slate-400 mt-0.5">
                Access URL:{' '}
                <span className="font-mono text-slate-600">
                  /app/{currentSlug || 'workspace-slug'}/overview
                </span>
              </p>
            )}
          </div>

          {/* Primary Timezone with CustomSelect */}
          <div className="space-y-1">
            <CustomSelect
              label="Primary Timezone"
              required
              options={timezoneOptions}
              value={currentTimezone}
              onChange={(val) => setValue('timezone', val, { shouldValidate: true })}
              leadingIcon={<Clock className="w-4 h-4" />}
              placeholder="Select organization timezone"
              searchPlaceholder="Search timezone or city..."
              error={errors.timezone?.message}
              helperText="Determines time reporting, attendance shifts, and billing cutoffs."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:from-[#d24c11] hover:via-[#e35d18] hover:to-[#eb7124] text-white font-semibold text-xs py-3 px-4 shadow-[0_6px_20px_rgba(249,87,22,0.28)] hover:shadow-[0_8px_24px_rgba(249,87,22,0.36)] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Creating Organization...</span>
              </>
            ) : (
              <>
                <span>Launch Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

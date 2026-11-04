import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Settings,
  Building,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  Calendar,
  Lock,
  Globe,
  Loader2
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';
import { dataPipeline } from '../lib/dataPipeline';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const CompanySettingsPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();

  // Pipeline Cache State
  const cacheKey = `company_settings_${companySlug}`;
  const cached = dataPipeline.get<any>(cacheKey);

  const [activeTab, setActiveTab] = useState<'general' | 'organization' | 'security'>('general');
  const [loading, setLoading] = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields initialized from cache if available for 0ms rendering
  const [companyName, setCompanyName] = useState(() => cached?.company?.name || '');
  const [timezone, setTimezone] = useState(() => cached?.company?.timezone || 'UTC');
  const [locale, setLocale] = useState(() => cached?.company?.locale || 'en');

  const [workingDays, setWorkingDays] = useState<string[]>(() => cached?.settings?.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [fiscalYearStart, setFiscalYearStart] = useState(() => cached?.settings?.fiscal_year_start || '01-01');
  const [dateFormat, setDateFormat] = useState(() => cached?.settings?.date_format || 'YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState(() => cached?.settings?.time_format || '12h');

  const [allowEmployeeInvites, setAllowEmployeeInvites] = useState(() => !!cached?.settings?.allow_employee_invites);
  const [enforceMfa, setEnforceMfa] = useState(() => !!cached?.settings?.enforce_mfa);
  const [sessionTimeout, setSessionTimeout] = useState(() => cached?.settings?.session_timeout_minutes || 1440);

  useEffect(() => {
    const fetchSettings = async () => {
      const currentCached = dataPipeline.get<any>(cacheKey);
      if (currentCached) {
        setLoading(false);
        setIsValidating(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await api.get(`/companies/${companySlug}/settings`);
        const { company, settings } = res.data;

        setCompanyName(company.name);
        setTimezone(company.timezone);
        setLocale(company.locale);

        if (settings) {
          if (settings.working_days) setWorkingDays(settings.working_days);
          if (settings.fiscal_year_start) setFiscalYearStart(settings.fiscal_year_start);
          if (settings.date_format) setDateFormat(settings.date_format);
          if (settings.time_format) setTimeFormat(settings.time_format);
          setAllowEmployeeInvites(!!settings.allow_employee_invites);
          setEnforceMfa(!!settings.enforce_mfa);
          if (settings.session_timeout_minutes) setSessionTimeout(settings.session_timeout_minutes);
        }

        dataPipeline.set(cacheKey, { company, settings }, 300000);
      } catch {
        // Handled
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    };

    if (companySlug) {
      fetchSettings();
    }
  }, [companySlug]);

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // 1. Update general company info
      await api.patch(`/companies/${companySlug}`, {
        name: companyName,
        timezone,
        locale,
      });

      // 2. Update company settings
      const settingsPayload = {
        working_days: workingDays,
        fiscal_year_start: fiscalYearStart,
        date_format: dateFormat,
        time_format: timeFormat,
        allow_employee_invites: allowEmployeeInvites,
        enforce_mfa: enforceMfa,
        session_timeout_minutes: sessionTimeout,
      };
      await api.patch(`/companies/${companySlug}/settings`, settingsPayload);

      dataPipeline.set(cacheKey, {
        company: { name: companyName, timezone, locale },
        settings: settingsPayload,
      }, 300000);

      setSuccessMessage('Workspace preferences saved successfully.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to update workspace settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Workspace Settings"
      subtitle="Configure regional preferences, working schedules, and enterprise security policies"
    >
      <div className="space-y-6 max-w-4xl">
        {/* Tab navigation */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-[#F95716] text-[#F95716]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            General Profile
          </button>
          <button
            onClick={() => setActiveTab('organization')}
            className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'organization'
                ? 'border-[#F95716] text-[#F95716]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Working Schedule & Format
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#F95716] text-[#F95716]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Security & Access Policy
          </button>
        </div>

        {/* Feedback alerts */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* SWR Revalidation Bar */}
        {isValidating && companyName && (
          <div className="h-0.5 -mt-4 mb-2 bg-slate-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-[pulse_1s_infinite] w-full" />
          </div>
        )}

        {(loading && !companyName) ? (
          <div className="py-24 flex items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#F95716]" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Tab 1: General */}
            {activeTab === 'general' && (
              <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Workspace Identity
                </h3>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Default Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                    >
                      <option value="UTC">UTC (Universal Coordinated)</option>
                      <option value="America/New_York">Eastern Time (US)</option>
                      <option value="America/Chicago">Central Time (US)</option>
                      <option value="America/Denver">Mountain Time (US)</option>
                      <option value="America/Los_Angeles">Pacific Time (US)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Paris">Central European Time</option>
                      <option value="Asia/Dubai">Gulf Standard Time</option>
                      <option value="Asia/Karachi">Pakistan Standard Time (PKT)</option>
                      <option value="Asia/Kolkata">India Standard Time (IST)</option>
                      <option value="Asia/Singapore">Singapore / Hong Kong</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Primary Locale
                    </label>
                    <select
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                    >
                      <option value="en">English (US/UK)</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Organization */}
            {activeTab === 'organization' && (
              <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-5">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Working Week & Schedulers
                </h3>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    Official Working Days
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isChecked = workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-orange-50 border-[#F95716] text-[#F95716]'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Fiscal Year Start
                    </label>
                    <input
                      type="text"
                      value={fiscalYearStart}
                      onChange={(e) => setFiscalYearStart(e.target.value)}
                      placeholder="01-01 (MM-DD)"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Date Format
                    </label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (UK/EU)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Time Format
                    </label>
                    <select
                      value={timeFormat}
                      onChange={(e) => setTimeFormat(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                    >
                      <option value="12h">12-hour (02:30 PM)</option>
                      <option value="24h">24-hour (14:30)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Security & Policies */}
            {activeTab === 'security' && (
              <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-5">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Workspace Security & Compliance
                </h3>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceMfa}
                      onChange={(e) => setEnforceMfa(e.target.checked)}
                      className="w-4 h-4 text-[#F95716] rounded border-slate-300 focus:ring-[#F95716] mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Enforce Multi-Factor Authentication (MFA)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Require all employees to bind TOTP authenticator credentials before accessing workspace data.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowEmployeeInvites}
                      onChange={(e) => setAllowEmployeeInvites(e.target.checked)}
                      className="w-4 h-4 text-[#F95716] rounded border-slate-300 focus:ring-[#F95716] mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Allow Standard Employees to Send Invitations</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        If unchecked, only Company Owners and Administrators may issue invitation tokens.
                      </p>
                    </div>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Session Idle Timeout (Minutes)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={10080}
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 1440)}
                      className="w-full sm:w-60 px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Default 1440 mins (24 hours). Minimum 15 mins.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-[#F95716] hover:bg-[#EA580C] rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
};

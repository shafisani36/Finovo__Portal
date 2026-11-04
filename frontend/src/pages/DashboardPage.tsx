import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, Users, FolderKanban, CheckSquare, Clock, ShieldCheck,
  LogOut, Plus, Send, ChevronDown, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import api from '../lib/api';

export const DashboardPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, companies, activeCompany, setActiveCompany, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Find current company from user's memberships
  const currentMembership = companies.find(
    (c) => c.company.slug === companySlug
  ) || activeCompany;

  const handleCompanySwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const slug = e.target.value;
    const target = companies.find((c) => c.company.slug === slug);
    if (target) {
      setActiveCompany(target);
      navigate(`/app/${slug}/dashboard`);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMembership?.company.id) return;

    setInviteLoading(true);
    setInviteSuccess(null);
    setInviteError(null);

    try {
      // Find employee role id (usually id 4 in seeder, or from role list)
      const res = await api.post(`/companies/${currentMembership.company.id}/invitations`, {
        email: inviteEmail.trim(),
        role_id: 4, // Default Employee Role
      });

      setInviteSuccess(`Invitation sent to ${inviteEmail}. Token: ${res.data.invitation_token}`);
      setInviteEmail('');
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to send invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#111A33_0%,#060911_70%)]">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#0B101E]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-[#0B101E] rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <span className="text-lg font-bold tracking-tight text-white hidden sm:inline">
                BITSpark OS
              </span>
            </div>

            {/* Workspace Switcher */}
            <div className="relative">
              <select
                value={currentMembership?.company.slug || ''}
                onChange={handleCompanySwitch}
                className="bg-[#101626] border border-[#1E283D] text-slate-200 text-xs font-semibold rounded-xl pl-3 pr-8 py-2 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.company.id} value={c.company.slug}>
                    {c.company.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white">{user?.name}</p>
              <p className="text-[11px] text-slate-400">{user?.email}</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              icon={<LogOut className="w-4 h-4" />}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Workspace Title & Role Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {currentMembership?.company.name || 'Workspace Dashboard'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {currentMembership?.roles[0]?.name || 'Member'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Workspace URL: <code className="text-slate-300">/app/{companySlug}</code> &bull; Timezone: {currentMembership?.company.timezone}
            </p>
          </div>

          <Link to="/onboarding">
            <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
              Add Organization
            </Button>
          </Link>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Active Employees</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-white">1</p>
            <p className="text-[11px] text-emerald-400 mt-1">Tenant isolation active</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
              <FolderKanban className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-[11px] text-slate-500 mt-1">Ready for Phase 3</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Pending Tasks</span>
              <CheckSquare className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">0</p>
            <p className="text-[11px] text-slate-500 mt-1">Ready for Phase 3</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Time Tracked</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">0.0h</p>
            <p className="text-[11px] text-slate-500 mt-1">Ready for Phase 4</p>
          </Card>
        </div>

        {/* Management & Team Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invite Team Member Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Invite Team Member</h3>
                <p className="text-xs text-slate-400">Send an invitation to join this company workspace.</p>
              </div>
            </div>

            {inviteSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="break-all">{inviteSuccess}</span>
              </div>
            )}

            {inviteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" loading={inviteLoading} size="md">
                Send Invite
              </Button>
            </form>
          </Card>

          {/* Security & MFA Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Security & Multi-Factor Auth</h3>
                <p className="text-xs text-slate-400">Protect account with TOTP authenticator app.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#101626] border border-[#1E283D] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">
                  Two-Factor Authentication: {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {user?.mfa_enabled
                    ? 'Your account requires an authenticator code on each login.'
                    : 'Add an extra layer of protection to your credentials.'}
                </p>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                user?.mfa_enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {user?.mfa_enabled ? 'Active' : 'Not Configured'}
              </span>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

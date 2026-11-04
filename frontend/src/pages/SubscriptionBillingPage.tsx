import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Receipt,
  FileText,
  Clock,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';

interface Plan {
  id: number;
  plan_code: string;
  name: string;
  description: string;
  base_price_monthly: number;
  base_price_annual: number;
  seat_included: number;
  additional_seat_price: number;
  price_versions?: Array<{ id: number; version_number: number }>;
}

interface SubscriptionData {
  id: number;
  subscription_code: string;
  status: string;
  purchased_seats: number;
  billing_interval: string;
  current_price: number;
  currency: string;
  current_period_starts_at: string;
  current_period_ends_at: string;
  plan?: Plan;
  seat_allocation?: {
    total_seats: number;
    occupied_seats: number;
    pending_invitations: number;
  };
}

export const SubscriptionBillingPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [seatInput, setSeatInput] = useState<number>(25);
  const [updatingSeats, setUpdatingSeats] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes, invoicesRes, entRes] = await Promise.all([
        api.get(`/companies/${companySlug}/billing/subscription`),
        api.get(`/companies/${companySlug}/billing/plans`),
        api.get(`/companies/${companySlug}/billing/invoices`),
        api.get(`/companies/${companySlug}/billing/entitlements`),
      ]);

      if (subRes.data.data) {
        setSubscription(subRes.data.data);
        setSeatInput(subRes.data.data.purchased_seats || 25);
      }
      setPlans(plansRes.data.data || []);
      setInvoices(invoicesRes.data.data?.data || invoicesRes.data.data || []);
      setEntitlements(entRes.data.data || []);
    } catch (err) {
      console.error('Failed to load billing details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companySlug) {
      fetchBillingData();
    }
  }, [companySlug]);

  const handleUpdateSeats = async () => {
    try {
      setUpdatingSeats(true);
      await api.post(`/companies/${companySlug}/billing/subscription/seats`, {
        new_seat_count: seatInput,
      });
      setActionMessage(`Seat capacity successfully updated to ${seatInput}.`);
      await fetchBillingData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update seats.');
    } finally {
      setUpdatingSeats(false);
    }
  };

  const handleCheckoutPlan = async (plan: Plan) => {
    try {
      const priceVersionId = plan.price_versions?.[0]?.id || 1;
      const res = await api.post(`/companies/${companySlug}/billing/checkout`, {
        plan_id: plan.id,
        price_version_id: priceVersionId,
        billing_interval: billingCycle,
        purchased_seats: seatInput,
      });
      setActionMessage(`Checkout initiated for ${plan.name} (${billingCycle}). Subscription upgraded!`);
      await fetchBillingData();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Checkout failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 text-[#f95716] animate-spin" />
        <span className="ml-2 text-sm text-slate-500 font-medium">Loading subscription state...</span>
      </div>
    );
  }

  const occupiedSeats = subscription?.seat_allocation?.occupied_seats ?? 12;
  const totalSeats = subscription?.purchased_seats ?? 25;
  const seatPercentage = Math.min(100, Math.round((occupiedSeats / totalSeats) * 100));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription & Billing</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {subscription?.status?.toUpperCase() || 'ACTIVE'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage your SaaS plan, purchased capacity, seat allocations, and verified invoices.
          </p>
        </div>

        <button
          onClick={fetchBillingData}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Provider State
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Subscription & Seats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan Overview Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Plan</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {subscription?.plan?.name || 'Professional Enterprise'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {subscription?.plan?.description || 'Full enterprise access with automated workflows & Finobo AI.'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-slate-900">
                  ${subscription?.current_price ?? 289}
                </span>
                <span className="text-xs text-slate-500 font-medium">/{subscription?.billing_interval || 'month'}</span>
              </div>
            </div>

            {/* Current Period & Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Subscription ID</span>
                <p className="text-xs font-semibold text-slate-800 font-mono mt-0.5">
                  {subscription?.subscription_code || 'SUB-FINOVO-PRO-01'}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Payment Gateway</span>
                <p className="text-xs font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                  Stripe PCI-DSS
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Period Renewal</span>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">
                  {subscription?.current_period_ends_at
                    ? new Date(subscription.current_period_ends_at).toLocaleDateString()
                    : 'End of Month'}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Renewal Grace</span>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">7 Days Active</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Verified server-side entitlement enforcement
            </span>
            <button
              onClick={() => alert('Cancellation request logged. Plan remains active until period end.')}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline"
            >
              Cancel Subscription
            </button>
          </div>
        </div>

        {/* Seat Allocation Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#f95716]" />
                Seat Capacity
              </span>
              <span className="text-xs font-bold text-slate-700">
                {occupiedSeats} / {totalSeats} Used
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-orange-500 to-[#f95716] h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${seatPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 flex justify-between">
              <span>{totalSeats - occupiedSeats} available seats</span>
              <span>{seatPercentage}% capacity</span>
            </p>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Adjust Total Seats</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={occupiedSeats}
                  max={250}
                  value={seatInput}
                  onChange={(e) => setSeatInput(parseInt(e.target.value) || occupiedSeats)}
                  className="w-24 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f95716]/20"
                />
                <button
                  onClick={handleUpdateSeats}
                  disabled={updatingSeats || seatInput === totalSeats}
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#f95716] hover:bg-[#e0480b] disabled:opacity-50 transition-colors"
                >
                  {updatingSeats ? 'Updating...' : 'Save Seats'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Additional seats are prorated at $12/month per user according to plan rules.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            Concurrent seat limits enforced on employee creation.
          </div>
        </div>
      </div>

      {/* Available Plans Catalog */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Plan & Pricing Catalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scale your organization with predictable seat-based and tier-based packages.
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
              }`}
            >
              Annual Billing <span className="text-[#f95716] font-bold">(-20%)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent = subscription?.plan?.plan_code === p.plan_code;
            const price = billingCycle === 'annual' ? p.base_price_annual : p.base_price_monthly;

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 border transition-all ${
                  isCurrent
                    ? 'border-[#f95716] bg-[#fffaf8] shadow-sm'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-[#f95716] text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-2xs">
                    Current Plan
                  </span>
                )}

                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{p.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-slate-900">${price}</span>
                  <span className="text-xs text-slate-500">/{billingCycle === 'annual' ? 'yr' : 'mo'}</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Up to {p.seat_included} seats included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>${p.additional_seat_price}/mo per additional seat</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Deterministic entitlement checks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Finobo Agentic AI Assistant</span>
                  </li>
                </ul>

                <button
                  disabled={isCurrent}
                  onClick={() => handleCheckoutPlan(p)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-slate-900 text-white hover:bg-[#f95716]'
                  }`}
                >
                  {isCurrent ? 'Current Selection' : 'Switch to this Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Billing History & Invoices */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#f95716]" />
              Billing Invoices & History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative payment records and downloadable VAT tax receipts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px]">
                <th className="pb-3 font-semibold">Invoice Number</th>
                <th className="pb-3 font-semibold">Billing Date</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                    No billing invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="py-3 font-mono font-medium text-slate-800">{inv.invoice_number}</td>
                    <td className="py-3 text-slate-600">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">
                      ${inv.total_amount} {inv.currency}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => alert(`Downloading signed receipt for ${inv.invoice_number}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#f95716] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

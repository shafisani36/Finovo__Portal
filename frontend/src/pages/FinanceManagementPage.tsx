import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/layouts/AppShell';
import { useAuth } from '../context/AuthContext';
import { dataPipeline } from '../lib/dataPipeline';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  CreditCard,
  Plus,
  Download,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  FileText,
  Sparkles,
  RefreshCw,
  Lock,
  Unlock,
  ChevronRight,
  Sliders,
  Compass
} from 'lucide-react';

interface OverviewData {
  currency: string;
  summary: {
    total_invoiced_revenue: number;
    total_cash_collected: number;
    outstanding_receivables: number;
    overdue_receivables: number;
    overdue_count: number;
    unapplied_payments: number;
  };
  cost_and_profitability: {
    labor_cost: number;
    operating_expenses: number;
    total_actual_cost: number;
    gross_profit: number;
    gross_margin_percent: number;
  };
  unbilled_revenue_recovery: {
    unbilled_hours: number;
    unbilled_estimated_value: number;
    unbilled_entries_count: number;
  };
}

interface ProjectItem {
  id: number;
  name: string;
  project_code: string;
  budget_amount: string | null;
}

interface DigitalTwinData {
  project: {
    id: number;
    name: string;
    project_code: string;
    currency: string;
  };
  digital_twin: {
    approved_budget: number;
    actual_labor_cost: number;
    actual_expenses: number;
    total_actual_cost: number;
    budget_consumption_percent: number;
    contract_value: number;
    invoiced_revenue: number;
    actual_gross_profit: number;
    actual_gross_margin_percent: number;
    remaining_task_hours_estimate: number;
    forecast_final_cost: number;
    forecast_profit: number;
    forecast_margin_percent: number;
    forecast_budget_overrun: number;
  };
  margin_leaks: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    recommendation: string;
  }>;
  explainability: {
    labor_sources_count: number;
    expense_sources_count: number;
    standard_labor_cost_rate: number;
    last_calculated_at: string;
  };
}

interface InvoiceItem {
  id: number;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  status: string;
  project?: {
    name: string;
    project_code: string;
  };
}

interface PaymentItem {
  id: number;
  payment_reference: string;
  amount: string;
  unapplied_amount: string;
  allocated_amount: string;
  payment_method: string;
  received_date: string;
  status: string;
}

interface ExpenseItem {
  id: number;
  merchant: string;
  category: string;
  amount: string;
  expense_date: string;
  status: string;
  user: {
    name: string;
  };
  project?: {
    name: string;
  };
}

interface PeriodCloseItem {
  id: number;
  period_name: string;
  period_start: string;
  period_end: string;
  status: string;
  closed_at: string;
  closed_by?: {
    name: string;
  };
  snapshot_metrics: {
    total_debits: number;
    total_credits: number;
  };
}

export const FinanceManagementPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.company?.id;

  const [activeTab, setActiveTab] = useState<'overview' | 'profitability' | 'invoices' | 'payments' | 'expenses' | 'close'>('overview');

  // Cache Pipeline State
  const cacheKey = `finance_overview_${companyId}`;
  const cached = dataPipeline.get<any>(cacheKey);

  const [loading, setLoading] = useState(!cached);
  const [isValidating, setIsValidating] = useState(false);

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(() => cached?.overview ?? null);
  const [projects, setProjects] = useState<ProjectItem[]>(() => dataPipeline.get<ProjectItem[]>(`finance_projects_${companyId}`) || []);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(() => cached?.invoices ?? []);
  const [payments, setPayments] = useState<PaymentItem[]>(() => cached?.payments ?? []);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => cached?.expenses ?? []);
  const [periodCloses, setPeriodCloses] = useState<PeriodCloseItem[]>(() => cached?.periodCloses ?? []);

  // Modals & Action States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invClientName, setInvClientName] = useState('');
  const [invAmount, setInvAmount] = useState('1500');
  const [invDesc, setInvDesc] = useState('Engineering Delivery Sprint');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payAmount, setPayAmount] = useState('');

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expMerchant, setExpMerchant] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('hosting');
  const [expDesc, setExpDesc] = useState('');

  const [showBudgetRevModal, setShowBudgetRevModal] = useState(false);
  const [revAmount, setRevAmount] = useState('');
  const [revReason, setRevReason] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchOverviewData();
      fetchProjects();
    }
  }, [companyId]);

  const fetchOverviewData = async (force = false) => {
    if (!companyId) return;
    const currentCached = !force ? dataPipeline.get<any>(cacheKey) : null;
    if (currentCached) {
      setOverview(currentCached.overview);
      setInvoices(currentCached.invoices);
      setPayments(currentCached.payments);
      setExpenses(currentCached.expenses);
      setPeriodCloses(currentCached.periodCloses);
      setLoading(false);
      setIsValidating(true);
    } else {
      setLoading(true);
    }

    try {
      const [ovRes, invRes, payRes, expRes, closeRes] = await Promise.all([
        fetch(`/api/v1/companies/${companyId}/finance/overview`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/finance/invoices`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/finance/payments`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/finance/expenses`, { credentials: 'include' }),
        fetch(`/api/v1/companies/${companyId}/finance/period-closes`, { credentials: 'include' }),
      ]);

      let newOv = null;
      let newInv: InvoiceItem[] = [];
      let newPay: PaymentItem[] = [];
      let newExp: ExpenseItem[] = [];
      let newClose: PeriodCloseItem[] = [];

      if (ovRes.ok) {
        const d = await ovRes.json();
        newOv = d.data;
        setOverview(newOv);
      }
      if (invRes.ok) {
        const d = await invRes.json();
        newInv = d.data || [];
        setInvoices(newInv);
      }
      if (payRes.ok) {
        const d = await payRes.json();
        newPay = d.data || [];
        setPayments(newPay);
      }
      if (expRes.ok) {
        const d = await expRes.json();
        newExp = d.data || [];
        setExpenses(newExp);
      }
      if (closeRes.ok) {
        const d = await closeRes.json();
        newClose = d.data || [];
        setPeriodCloses(newClose);
      }

      dataPipeline.set(cacheKey, {
        overview: newOv,
        invoices: newInv,
        payments: newPay,
        expenses: newExp,
        periodCloses: newClose,
      }, 120000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/projects`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        const prjList = d.data || [];
        setProjects(prjList);
        if (prjList.length > 0) {
          setSelectedProjectId(prjList[0].id);
          fetchDigitalTwin(prjList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDigitalTwin = async (projectId: number) => {
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/projects/${projectId}/profitability`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setDigitalTwin(d.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncLaborCosts = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/projects/${selectedProjectId}/sync-labor-costs`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        fetchDigitalTwin(selectedProjectId);
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviseBudget = async () => {
    if (!selectedProjectId || !revAmount) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/projects/${selectedProjectId}/budget-revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          new_amount: parseFloat(revAmount),
          reason: revReason || 'Client approved scope adjustment and budget revision.',
        }),
      });
      if (res.ok) {
        setShowBudgetRevModal(false);
        setRevAmount('');
        setRevReason('');
        fetchDigitalTwin(selectedProjectId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateInvoice = async () => {
    if (!invClientName.trim()) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/invoices/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_name: invClientName,
          project_id: selectedProjectId,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          tax_rate: 10,
          custom_lines: [
            { description: invDesc, quantity: 1, unit_rate: parseFloat(invAmount) || 1000 },
          ],
        }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvClientName('');
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleIssueInvoice = async (invoiceId: number) => {
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/invoices/${invoiceId}/issue`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async () => {
    if (!payRef.trim() || !payAmount) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payment_reference: payRef,
          amount: parseFloat(payAmount),
          payment_method: 'bank_transfer',
          received_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPayRef('');
        setPayAmount('');
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitExpense = async () => {
    if (!expMerchant.trim() || !expAmount) return;
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          merchant: expMerchant,
          amount: parseFloat(expAmount),
          category: expCategory,
          description: expDesc || 'Cloud infrastructure provisioning',
          expense_date: new Date().toISOString().split('T')[0],
          project_id: selectedProjectId,
        }),
      });
      if (res.ok) {
        setShowExpenseModal(false);
        setExpMerchant('');
        setExpAmount('');
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveExpense = async (expenseId: number) => {
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/finance/expenses/${expenseId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        fetchOverviewData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppShell
      title="Finance, Project Costing & Billing"
      subtitle="Operational project profitability, balanced subledger, billing recovery engine and margin intelligence"
      actions={
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/companies/${companyId}/finance/export`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Audited P&L
          </a>
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 mb-6 gap-2 overflow-x-auto text-xs font-bold">
        {[
          { key: 'overview', label: 'Financial Overview', icon: DollarSign },
          { key: 'profitability', label: 'Project Profitability & Digital Twin', icon: TrendingUp },
          { key: 'invoices', label: 'Client Invoices & Recovery Engine', icon: Receipt },
          { key: 'payments', label: 'Cash & Payments', icon: CreditCard },
          { key: 'expenses', label: 'Project Expenses & Approvals', icon: FileText },
          { key: 'close', label: 'Safe Financial Close', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#F95716] text-[#F95716]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isValidating && overview && (
        <div className="h-0.5 -mt-6 mb-4 bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 animate-[pulse_1s_infinite] w-full" />
        </div>
      )}

      {(loading && !overview) ? (
        <div className="p-12 text-center text-slate-400">Loading financial intelligence data...</div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Invoiced Revenue</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900">${overview.summary.total_invoiced_revenue.toLocaleString()}</span>
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cash Collected</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900">${overview.summary.total_cash_collected.toLocaleString()}</span>
                    <CreditCard className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Receivables</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-amber-600">${overview.summary.outstanding_receivables.toLocaleString()}</span>
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gross Margin %</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-bold text-emerald-600">{overview.cost_and_profitability.gross_margin_percent}%</span>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Billable Revenue Recovery Engine Banner */}
              <div className="p-5 rounded-2xl bg-linear-to-r from-orange-50 to-amber-50 border border-orange-200/70 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">Billable Revenue Recovery Engine Active</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Identified <span className="font-bold text-slate-900">{overview.unbilled_revenue_recovery.unbilled_hours} approved billable hours</span> across active projects with an estimated recoverable value of <span className="font-bold text-emerald-700">${overview.unbilled_revenue_recovery.unbilled_estimated_value.toLocaleString()}</span> waiting to be billed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs whitespace-nowrap"
                >
                  Generate Invoice &rarr;
                </button>
              </div>

              {/* Operational Cost vs Profitability Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Operational Cost Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Approved Labor Costs (M06)</span>
                      <span className="font-bold text-slate-900">${overview.cost_and_profitability.labor_cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Project & Operating Expenses</span>
                      <span className="font-bold text-slate-900">${overview.cost_and_profitability.operating_expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 font-bold">
                      <span className="text-slate-800">Total Actual Costs</span>
                      <span className="text-slate-900">${overview.cost_and_profitability.total_actual_cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Cash Flow & Collections</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Overdue Receivables ({overview.summary.overdue_count} Invoices)</span>
                      <span className="font-bold text-red-600">${overview.summary.overdue_receivables.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Unapplied Payments</span>
                      <span className="font-bold text-blue-600">${overview.summary.unapplied_payments.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 font-bold">
                      <span className="text-slate-800">Gross Operating Profit</span>
                      <span className="text-emerald-700">${overview.cost_and_profitability.gross_profit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECT PROFITABILITY & DIGITAL TWIN */}
          {activeTab === 'profitability' && (
            <div className="space-y-6">
              {/* Project Selector Bar */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Active Project:</span>
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedProjectId(id);
                      fetchDigitalTwin(id);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.project_code})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncLaborCosts}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    Sync Labor Costs
                  </button>
                  <button
                    onClick={() => setShowBudgetRevModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Revise Budget
                  </button>
                </div>
              </div>

              {digitalTwin && (
                <>
                  {/* Digital Twin KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold uppercase text-slate-400">Approved Budget</span>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        ${digitalTwin.digital_twin.approved_budget.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Burn: {digitalTwin.digital_twin.budget_consumption_percent}%
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold uppercase text-slate-400">Actual Cost To Date</span>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        ${digitalTwin.digital_twin.total_actual_cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Labor: ${digitalTwin.digital_twin.actual_labor_cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold uppercase text-slate-400">Forecast Final Cost</span>
                      <div className="text-xl font-bold text-purple-600 mt-1">
                        ${digitalTwin.digital_twin.forecast_final_cost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Overrun: ${digitalTwin.digital_twin.forecast_budget_overrun.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold uppercase text-slate-400">Forecast Gross Margin</span>
                      <div className="text-xl font-bold text-emerald-600 mt-1">
                        {digitalTwin.digital_twin.forecast_margin_percent}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Profit: ${digitalTwin.digital_twin.forecast_profit.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Margin Leak Detector Alerts */}
                  {digitalTwin.margin_leaks.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Margin Leak Detector Signals</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {digitalTwin.margin_leaks.map((leak, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-bold text-slate-900">{leak.title}</span>
                            </div>
                            <p className="text-xs text-slate-600">{leak.description}</p>
                            <p className="text-[11px] font-semibold text-amber-900 pt-1">
                              Action: {leak.recommendation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Explainability Card */}
                  <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-900">Financial Explainability Layer</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Costs derived from {digitalTwin.explainability.labor_sources_count} approved M06 time entries (blended ${digitalTwin.explainability.standard_labor_cost_rate}/hr rate) and {digitalTwin.explainability.expense_sources_count} approved operational expenses. Last model run at {new Date(digitalTwin.explainability.last_calculated_at).toLocaleTimeString()}.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: INVOICES & BILLABLE RECOVERY ENGINE */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Client Invoices & Receivables</h3>
                  <p className="text-xs text-slate-400">Post balanced double-entry accounting transactions upon issuance</p>
                </div>
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Invoice
                </button>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                {invoices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No invoices generated yet.</div>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{inv.invoice_number}</span>
                          <span className="text-xs text-slate-600">• {inv.client_name}</span>
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-600">
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Issued: {inv.issue_date} • Due: {inv.due_date} {inv.project ? `• ${inv.project.name}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900">${parseFloat(inv.total_amount).toLocaleString()}</span>
                          <div className="text-[10px] text-slate-400">Due: ${parseFloat(inv.balance_due).toLocaleString()}</div>
                        </div>

                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleIssueInvoice(inv.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Issue Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENTS & CASH */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Client Payments & Collections</h3>
                  <p className="text-xs text-slate-400">Record incoming client wire transfers, checks and credit card settlements</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record Payment
                </button>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No payment receipts recorded yet.</div>
                ) : (
                  payments.map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{p.payment_reference}</span>
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-50 text-blue-700">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Method: {p.payment_method} • Received: {p.received_date}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900">${parseFloat(p.amount).toLocaleString()}</span>
                        <div className="text-[10px] text-slate-400">Unapplied: ${parseFloat(p.unapplied_amount).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: EXPENSES & RECEIPTS */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Project Expenses & Approvals</h3>
                  <p className="text-xs text-slate-400">Capture receipts and automatically allocate approved expenses to project budgets</p>
                </div>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Submit Expense
                </button>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                {expenses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No project expenses submitted yet.</div>
                ) : (
                  expenses.map((exp) => (
                    <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{exp.merchant}</span>
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-600">
                            {exp.category}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-50 text-emerald-700">
                            {exp.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Submitted by {exp.user.name} on {exp.expense_date} {exp.project ? `• ${exp.project.name}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-900">${parseFloat(exp.amount).toLocaleString()}</span>
                        {exp.status === 'submitted' && (
                          <button
                            onClick={() => handleApproveExpense(exp.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SAFE FINANCIAL CLOSE */}
          {activeTab === 'close' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-900 text-white">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Safe Financial Close & General Ledger Verification</h3>
                    <p className="text-xs text-slate-500">
                      Enforces the fundamental double-entry invariant (<span className="font-mono font-bold">Debits = Credits</span>) before closing monthly or quarterly accounting periods.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Closed Financial Periods</h4>
                  <div className="space-y-2">
                    {periodCloses.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No financial periods closed yet.</div>
                    ) : (
                      periodCloses.map((c) => (
                        <div key={c.id} className="p-3 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{c.period_name}</span>
                            <span className="text-slate-400 ml-2">({c.period_start} to {c.period_end})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-600 font-mono">Balanced Debits/Credits: ${c.snapshot_metrics?.total_debits?.toLocaleString()}</span>
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-200 text-slate-700">
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: DRAFT INVOICE */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Generate Client Invoice</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={invClientName}
                  onChange={(e) => setInvClientName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Line Description</label>
                <input
                  type="text"
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowInvoiceModal(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleCreateInvoice} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600">Create Draft</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Record Incoming Client Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Reference</label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-887766"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Received Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleRecordPayment} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600">Save Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Submit Project Expense</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Merchant / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. AWS Cloud Infrastructure"
                  value={expMerchant}
                  onChange={(e) => setExpMerchant(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                >
                  <option value="hosting">Hosting & Cloud Infrastructure</option>
                  <option value="software_licenses">Software Licenses</option>
                  <option value="travel">Travel & Client Visit</option>
                  <option value="hardware">Hardware & Devices</option>
                  <option value="general">General Operating</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 250"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Staging database cluster"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowExpenseModal(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmitExpense} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVISE BUDGET */}
      {showBudgetRevModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Revise Project Approved Budget</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">New Approved Budget ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 35000"
                  value={revAmount}
                  onChange={(e) => setRevAmount(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Justification Reason</label>
                <textarea
                  placeholder="Document client change order approval or sprint expansion..."
                  value={revReason}
                  onChange={(e) => setRevReason(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 h-20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBudgetRevModal(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleReviseBudget} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#F95716] text-white hover:bg-orange-600">Approve Revision</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

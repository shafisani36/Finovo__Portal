<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FinanceExpense;
use App\Models\FinanceInvoice;
use App\Models\FinancePayment;
use App\Models\FinanceProjectCostEntry;
use App\Models\Project;
use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceDashboardController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    public function overview(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        // 1. Invoices & Receivables
        $invoices = FinanceInvoice::where('company_id', $company->id)->get();
        $totalInvoiced = (float) $invoices->whereNotIn('status', ['draft', 'voided'])->sum('total_amount');
        $totalPaid = (float) $invoices->whereNotIn('status', ['draft', 'voided'])->sum('paid_amount');
        $outstandingReceivables = (float) $invoices->whereIn('status', ['issued', 'partially_paid', 'overdue'])->sum('balance_due');
        
        $today = Carbon::now()->toDateString();
        $overdueInvoices = $invoices->filter(fn($inv) => in_array($inv->status, ['issued', 'partially_paid', 'overdue']) && $inv->due_date < $today);
        $overdueAmount = (float) $overdueInvoices->sum('balance_due');

        // 2. Costs & Expenses
        $costEntries = FinanceProjectCostEntry::where('company_id', $company->id)->get();
        $laborCost = (float) $costEntries->where('source_type', 'time_entry')->sum('amount');
        $otherCosts = (float) $costEntries->where('source_type', '!=', 'time_entry')->sum('amount');
        
        $approvedExpenses = (float) FinanceExpense::where('company_id', $company->id)
            ->where('status', 'approved')
            ->sum('amount');

        $totalActualCost = $laborCost + $otherCosts + $approvedExpenses;

        // 3. Profitability & Margin
        $grossProfit = $totalInvoiced - $totalActualCost;
        $grossMarginPercent = $totalInvoiced > 0 ? round(($grossProfit / $totalInvoiced) * 100, 1) : 0.0;

        // 4. Cash Collections
        $totalCashReceived = (float) FinancePayment::where('company_id', $company->id)
            ->where('status', '!=', 'refunded')
            ->sum('amount');
        $unappliedCash = (float) FinancePayment::where('company_id', $company->id)
            ->where('status', '!=', 'refunded')
            ->sum('unapplied_amount');

        // 5. Unbilled Work Recovery Indicator
        $invoicedTimeEntryIds = \DB::table('finance_invoice_lines')
            ->where('company_id', $company->id)
            ->whereNotNull('time_entry_id')
            ->pluck('time_entry_id');

        $unbilledEntries = TimeEntry::where('company_id', $company->id)
            ->where('is_billable', true)
            ->where('approval_status', 'approved')
            ->whereNotIn('id', $invoicedTimeEntryIds)
            ->get();

        $unbilledHours = round($unbilledEntries->sum('duration_seconds') / 3600, 1);
        $unbilledEstimatedValue = $unbilledHours * 85.0; // standard benchmark rate

        return response()->json([
            'status' => 'success',
            'data' => [
                'currency' => 'USD',
                'summary' => [
                    'total_invoiced_revenue' => $totalInvoiced,
                    'total_cash_collected' => $totalCashReceived,
                    'outstanding_receivables' => $outstandingReceivables,
                    'overdue_receivables' => $overdueAmount,
                    'overdue_count' => $overdueInvoices->count(),
                    'unapplied_payments' => $unappliedCash,
                ],
                'cost_and_profitability' => [
                    'labor_cost' => $laborCost,
                    'operating_expenses' => $approvedExpenses + $otherCosts,
                    'total_actual_cost' => $totalActualCost,
                    'gross_profit' => $grossProfit,
                    'gross_margin_percent' => $grossMarginPercent,
                ],
                'unbilled_revenue_recovery' => [
                    'unbilled_hours' => $unbilledHours,
                    'unbilled_estimated_value' => $unbilledEstimatedValue,
                    'unbilled_entries_count' => $unbilledEntries->count(),
                ],
            ],
        ]);
    }

    public function exportReport(Company $company, Request $request): StreamedResponse
    {
        $this->resolveMembership($company, $request);

        $projects = Project::where('company_id', $company->id)->get();
        $invoices = FinanceInvoice::where('company_id', $company->id)->get();
        $costEntries = FinanceProjectCostEntry::where('company_id', $company->id)->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="finovo_financial_report_' . date('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($projects, $invoices, $costEntries) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Project Code',
                'Project Name',
                'Budget Amount',
                'Actual Labor Cost',
                'Actual Other Costs',
                'Total Cost',
                'Invoiced Revenue',
                'Gross Profit',
                'Gross Margin %',
            ]);

            foreach ($projects as $prj) {
                $prjInvoices = $invoices->where('project_id', $prj->id)->whereNotIn('status', ['draft', 'voided']);
                $invoiced = (float) $prjInvoices->sum('total_amount');

                $prjCosts = $costEntries->where('project_id', $prj->id);
                $labor = (float) $prjCosts->where('source_type', 'time_entry')->sum('amount');
                $other = (float) $prjCosts->where('source_type', '!=', 'time_entry')->sum('amount');
                $totalCost = $labor + $other;

                $profit = $invoiced - $totalCost;
                $margin = $invoiced > 0 ? round(($profit / $invoiced) * 100, 1) : 0;

                fputcsv($handle, [
                    $prj->project_code,
                    $prj->name,
                    $prj->budget_amount ?? 0,
                    $labor,
                    $other,
                    $totalCost,
                    $invoiced,
                    $profit,
                    $margin . '%',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}

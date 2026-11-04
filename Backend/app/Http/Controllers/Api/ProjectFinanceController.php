<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\FinanceAuditEvent;
use App\Models\FinanceBillingContract;
use App\Models\FinanceBudgetRevision;
use App\Models\FinanceEmployeeCostRate;
use App\Models\FinanceInvoice;
use App\Models\FinanceProjectBudget;
use App\Models\FinanceProjectCostEntry;
use App\Models\Project;
use App\Models\Task;
use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectFinanceController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    // =========================================================================
    // 1. PROJECT PROFITABILITY DIGITAL TWIN & MARGIN LEAK DETECTOR (Features A, B, D)
    // =========================================================================

    public function getProfitability(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $project = Project::where('company_id', $company->id)->findOrFail($projectId);

        // 1. Approved Budget
        $budgetRecord = FinanceProjectBudget::where('company_id', $company->id)
            ->where('project_id', $project->id)
            ->first();

        $approvedBudget = $budgetRecord ? (float) $budgetRecord->approved_budget : (float) ($project->budget_amount ?? 0);

        // 2. Costs to date
        $costEntries = FinanceProjectCostEntry::where('company_id', $company->id)
            ->where('project_id', $project->id)
            ->get();

        $actualLaborCost = (float) $costEntries->where('source_type', 'time_entry')->sum('amount');
        $actualExpenses = (float) $costEntries->where('source_type', '!=', 'time_entry')->sum('amount');
        $totalActualCost = $actualLaborCost + $actualExpenses;

        // 3. Recognized Revenue (Invoiced)
        $invoices = FinanceInvoice::where('company_id', $company->id)
            ->where('project_id', $project->id)
            ->whereNotIn('status', ['draft', 'voided'])
            ->get();

        $invoicedRevenue = (float) $invoices->sum('total_amount');
        $contractValue = (float) ($project->budget_amount ? $project->budget_amount * 1.3 : $invoicedRevenue * 1.2);

        $actualGrossProfit = $invoicedRevenue - $totalActualCost;
        $actualGrossMargin = $invoicedRevenue > 0 ? round(($actualGrossProfit / $invoicedRevenue) * 100, 1) : 0.0;

        // 4. Remaining Effort & Forecast Final Cost (Alg 8.3 & Digital Twin)
        $tasks = Task::where('company_id', $company->id)->where('project_id', $project->id)->get();
        $remainingHours = 0;
        foreach ($tasks as $task) {
            if ($task->status !== 'completed') {
                $estimated = $task->estimated_hours ?? 10;
                $remainingHours += max(0, $estimated);
            }
        }

        $standardCostRate = 50.0; // benchmark blended developer cost rate
        $forecastRemainingLabor = $remainingHours * $standardCostRate;
        $forecastRemainingExpenses = 0.0;
        $forecastFinalCost = $totalActualCost + $forecastRemainingLabor + $forecastRemainingExpenses;

        $forecastOverrun = max(0.0, $forecastFinalCost - $approvedBudget);
        $forecastProfit = $contractValue - $forecastFinalCost;
        $forecastMargin = $contractValue > 0 ? round(($forecastProfit / $contractValue) * 100, 1) : 0.0;
        $budgetConsumptionPercent = $approvedBudget > 0 ? round(($totalActualCost / $approvedBudget) * 100, 1) : 0.0;

        // 5. Margin Leak Detector (Feature B)
        $leaks = [];
        if ($forecastOverrun > 0) {
            $leaks[] = [
                'type' => 'budget_overrun_risk',
                'severity' => 'high',
                'title' => 'Projected Budget Overrun',
                'description' => "Forecast final cost (${$forecastFinalCost}) exceeds approved budget by ${$forecastOverrun}.",
                'recommendation' => 'Request client change request or re-scope non-critical sprint deliverables.',
            ];
        }

        $unbilledHours = TimeEntry::where('company_id', $company->id)
            ->where('project_id', $project->id)
            ->where('is_billable', true)
            ->where('approval_status', 'approved')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('finance_invoice_lines')
                  ->whereColumn('finance_invoice_lines.time_entry_id', 'time_entries.id');
            })
            ->sum('duration_seconds') / 3600;

        if ($unbilledHours > 0) {
            $leaks[] = [
                'type' => 'unbilled_approved_hours',
                'severity' => 'medium',
                'title' => 'Unbilled Billable Hours Detected',
                'description' => round($unbilledHours, 1) . ' approved billable hours have not yet been invoiced.',
                'recommendation' => 'Generate draft invoice via the Billable Revenue Recovery Engine.',
            ];
        }

        if ($budgetConsumptionPercent > 80 && ($project->progress_percent ?? 0) < 50) {
            $leaks[] = [
                'type' => 'burn_rate_mismatch',
                'severity' => 'high',
                'title' => 'Budget Burn Outpacing Delivery Progress',
                'description' => "Consumed {$budgetConsumptionPercent}% of budget but only {$project->progress_percent}% deliverables completed.",
                'recommendation' => 'Conduct immediate architectural and velocity review with project team.',
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'project_code' => $project->project_code,
                    'currency' => $project->currency ?? 'USD',
                ],
                'digital_twin' => [
                    'approved_budget' => $approvedBudget,
                    'actual_labor_cost' => $actualLaborCost,
                    'actual_expenses' => $actualExpenses,
                    'total_actual_cost' => $totalActualCost,
                    'budget_consumption_percent' => $budgetConsumptionPercent,
                    'contract_value' => $contractValue,
                    'invoiced_revenue' => $invoicedRevenue,
                    'actual_gross_profit' => $actualGrossProfit,
                    'actual_gross_margin_percent' => $actualGrossMargin,
                    'remaining_task_hours_estimate' => round($remainingHours, 1),
                    'forecast_final_cost' => $forecastFinalCost,
                    'forecast_profit' => $forecastProfit,
                    'forecast_margin_percent' => $forecastMargin,
                    'forecast_budget_overrun' => $forecastOverrun,
                ],
                'margin_leaks' => $leaks,
                'explainability' => [
                    'labor_sources_count' => $costEntries->where('source_type', 'time_entry')->count(),
                    'expense_sources_count' => $costEntries->where('source_type', '!=', 'time_entry')->count(),
                    'standard_labor_cost_rate' => $standardCostRate,
                    'last_calculated_at' => Carbon::now()->toIso8601String(),
                ],
            ],
        ]);
    }

    // =========================================================================
    // 2. PROJECT BUDGETS & REVISIONS (FR-02)
    // =========================================================================

    public function getBudget(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $budget = FinanceProjectBudget::where('company_id', $company->id)
            ->where('project_id', $projectId)
            ->with(['revisions.approver:id,name'])
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => $budget,
        ]);
    }

    public function setBudget(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'approved_budget' => 'required|numeric|min:0',
            'labor_budget' => 'nullable|numeric|min:0',
            'expense_budget' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|size:3',
        ]);

        $project = Project::where('company_id', $company->id)->findOrFail($projectId);

        $budget = FinanceProjectBudget::updateOrCreate(
            [
                'company_id' => $company->id,
                'project_id' => $project->id,
            ],
            [
                'approved_budget' => $validated['approved_budget'],
                'labor_budget' => $validated['labor_budget'] ?? ($validated['approved_budget'] * 0.75),
                'expense_budget' => $validated['expense_budget'] ?? ($validated['approved_budget'] * 0.25),
                'currency' => $validated['currency'] ?? 'USD',
                'status' => 'active',
            ]
        );

        $project->update(['budget_amount' => $validated['approved_budget']]);

        return response()->json([
            'status' => 'success',
            'message' => 'Project budget established.',
            'data' => $budget,
        ]);
    }

    public function reviseBudget(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'new_amount' => 'required|numeric|min:0',
            'reason' => 'required|string|min:10',
        ]);

        $budget = FinanceProjectBudget::where('company_id', $company->id)
            ->where('project_id', $projectId)
            ->firstOrFail();

        $previousAmount = $budget->approved_budget;

        DB::transaction(function () use ($company, $request, $budget, $previousAmount, $validated, $projectId) {
            $budget->update([
                'approved_budget' => $validated['new_amount'],
                'current_revision' => $budget->current_revision + 1,
                'status' => 'revised',
            ]);

            FinanceBudgetRevision::create([
                'company_id' => $company->id,
                'project_budget_id' => $budget->id,
                'previous_amount' => $previousAmount,
                'new_amount' => $validated['new_amount'],
                'reason' => $validated['reason'],
                'approved_by_user_id' => $request->user()->id,
            ]);

            Project::where('company_id', $company->id)
                ->where('id', $projectId)
                ->update(['budget_amount' => $validated['new_amount']]);

            FinanceAuditEvent::create([
                'company_id' => $company->id,
                'actor_user_id' => $request->user()->id,
                'action' => 'budget_revised',
                'entity_type' => 'FinanceProjectBudget',
                'entity_id' => $budget->id,
                'details' => [
                    'previous_amount' => $previousAmount,
                    'new_amount' => $validated['new_amount'],
                    'reason' => $validated['reason'],
                ],
            ]);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Budget revised and audited successfully.',
            'data' => $budget->fresh(['revisions.approver:id,name']),
        ]);
    }

    // =========================================================================
    // 3. LABOR COSTING ENGINE (FR-04 & Alg 8.1)
    // =========================================================================

    public function getCosts(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $costs = FinanceProjectCostEntry::where('company_id', $company->id)
            ->where('project_id', $projectId)
            ->orderBy('incurred_date', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $costs,
        ]);
    }

    public function syncLaborCosts(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $project = Project::where('company_id', $company->id)->findOrFail($projectId);

        // Fetch approved time entries for project that don't yet have cost entries
        $timeEntries = TimeEntry::where('company_id', $company->id)
            ->where('project_id', $project->id)
            ->where('approval_status', 'approved')
            ->get();

        $syncedCount = 0;
        foreach ($timeEntries as $te) {
            $existing = FinanceProjectCostEntry::where('company_id', $company->id)
                ->where('source_type', 'time_entry')
                ->where('source_id', $te->id)
                ->first();

            if ($existing) continue;

            // Resolve employee cost rate from finance_employee_cost_rates
            $rateRecord = FinanceEmployeeCostRate::where('company_id', $company->id)
                ->where('employee_id', $te->employment_record_id)
                ->where('effective_from', '<=', $te->started_at->toDateString())
                ->where(function ($q) use ($te) {
                    $q->whereNull('effective_to')
                      ->orWhere('effective_to', '>=', $te->started_at->toDateString());
                })
                ->orderBy('effective_from', 'desc')
                ->first();

            $costRate = $rateRecord ? (float) $rateRecord->internal_cost_rate : 45.0; // standard default internal rate
            $hours = round($te->duration_seconds / 3600, 2);
            $amount = round($hours * $costRate, 2);

            FinanceProjectCostEntry::create([
                'company_id' => $company->id,
                'project_id' => $project->id,
                'source_type' => 'time_entry',
                'source_id' => $te->id,
                'description' => "Labor: {$te->description} (" . round($hours, 2) . " hrs @ \${$costRate}/hr)",
                'cost_rate' => $costRate,
                'hours' => $hours,
                'amount' => $amount,
                'currency' => 'USD',
                'incurred_date' => $te->started_at->toDateString(),
            ]);

            $syncedCount++;
        }

        return response()->json([
            'status' => 'success',
            'message' => "Synced {$syncedCount} approved labor time entries into project costing ledger.",
            'synced_count' => $syncedCount,
        ]);
    }

    // =========================================================================
    // 4. BILLING CONTRACTS (FR-03)
    // =========================================================================

    public function getBillingContract(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $contract = FinanceBillingContract::where('company_id', $company->id)
            ->where('project_id', $projectId)
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => $contract,
        ]);
    }

    public function updateBillingContract(Company $company, $projectId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'contract_type' => 'required|string|in:hourly,fixed_price,milestone,retainer',
            'billing_rate' => 'required|numeric|min:0',
            'budget_cap' => 'nullable|numeric|min:0',
            'client_id' => 'nullable|exists:client_organizations,id',
        ]);

        $project = Project::where('company_id', $company->id)->findOrFail($projectId);

        $contract = FinanceBillingContract::updateOrCreate(
            [
                'company_id' => $company->id,
                'project_id' => $project->id,
            ],
            [
                'client_id' => $validated['client_id'] ?? null,
                'contract_type' => $validated['contract_type'],
                'billing_rate' => $validated['billing_rate'],
                'budget_cap' => $validated['budget_cap'] ?? null,
                'is_active' => true,
            ]
        );

        return response()->json([
            'status' => 'success',
            'data' => $contract,
        ]);
    }
}

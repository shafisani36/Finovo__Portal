<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FinanceAuditEvent;
use App\Models\FinanceExpense;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceLedgerTransaction;
use App\Models\FinanceProjectCostEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    public function listExpenses(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = FinanceExpense::where('company_id', $company->id)
            ->with(['user:id,name,email', 'project:id,name,project_code', 'approver:id,name']);

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $expenses = $query->orderBy('expense_date', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $expenses,
        ]);
    }

    public function submitExpense(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'category' => 'required|string|in:travel,software_licenses,hardware,meals,hosting,contractor,general',
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'merchant' => 'required|string|max:255',
            'description' => 'required|string',
            'receipt_path' => 'nullable|string',
        ]);

        $expense = FinanceExpense::create([
            'company_id' => $company->id,
            'user_id' => $request->user()->id,
            'project_id' => $validated['project_id'] ?? null,
            'category' => $validated['category'],
            'amount' => $validated['amount'],
            'currency' => 'USD',
            'expense_date' => $validated['expense_date'],
            'merchant' => $validated['merchant'],
            'description' => $validated['description'],
            'receipt_path' => $validated['receipt_path'] ?? null,
            'status' => 'submitted',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Expense submitted for management approval.',
            'data' => $expense->load('user:id,name'),
        ], 201);
    }

    public function approveExpense(Company $company, $expenseId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $expense = FinanceExpense::where('company_id', $company->id)->findOrFail($expenseId);

        if ($expense->status !== 'submitted') {
            return response()->json([
                'status' => 'error',
                'message' => 'Only submitted expenses can be approved.',
            ], 422);
        }

        DB::transaction(function () use ($company, $request, $expense) {
            $expense->update([
                'status' => 'approved',
                'approved_by_user_id' => $request->user()->id,
                'approved_at' => Carbon::now(),
            ]);

            // If allocated to a project, create project cost entry
            if ($expense->project_id) {
                FinanceProjectCostEntry::create([
                    'company_id' => $company->id,
                    'project_id' => $expense->project_id,
                    'source_type' => 'expense',
                    'source_id' => $expense->id,
                    'description' => "Expense [{$expense->category}]: {$expense->merchant} - {$expense->description}",
                    'cost_rate' => 0.00,
                    'hours' => null,
                    'amount' => $expense->amount,
                    'currency' => 'USD',
                    'incurred_date' => $expense->expense_date,
                ]);
            }

            // Balanced Double-Entry Subledger Posting (Alg 7.5)
            // Debit: 5100_OPERATING_EXPENSE
            // Credit: 2000_ACCOUNTS_PAYABLE
            $tx = FinanceLedgerTransaction::create([
                'company_id' => $company->id,
                'transaction_code' => 'TX-EXP-' . $expense->id,
                'description' => "Expense Approved #{$expense->id} for {$expense->merchant}",
                'transaction_date' => $expense->expense_date,
                'source_type' => 'expense_approved',
                'source_id' => $expense->id,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '5100_OPERATING_EXPENSE',
                'account_name' => 'Project & Operating Expenses',
                'entry_type' => 'debit',
                'amount' => $expense->amount,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '2000_ACCOUNTS_PAYABLE',
                'account_name' => 'Accounts Payable',
                'entry_type' => 'credit',
                'amount' => $expense->amount,
            ]);

            FinanceAuditEvent::create([
                'company_id' => $company->id,
                'actor_user_id' => $request->user()->id,
                'action' => 'expense_approved',
                'entity_type' => 'FinanceExpense',
                'entity_id' => $expense->id,
                'details' => ['amount' => $expense->amount, 'category' => $expense->category],
            ]);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Expense approved, cost allocated to project, and posted to ledger.',
            'data' => $expense->fresh(['approver:id,name']),
        ]);
    }

    public function rejectExpense(Company $company, $expenseId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'reason' => 'required|string|min:5',
        ]);

        $expense = FinanceExpense::where('company_id', $company->id)->findOrFail($expenseId);

        $expense->update([
            'status' => 'rejected',
            'rejection_reason' => $validated['reason'],
            'approved_by_user_id' => $request->user()->id,
            'approved_at' => Carbon::now(),
        ]);

        FinanceAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'expense_rejected',
            'entity_type' => 'FinanceExpense',
            'entity_id' => $expense->id,
            'details' => ['reason' => $validated['reason']],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Expense rejected.',
            'data' => $expense->fresh(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FinanceAuditEvent;
use App\Models\FinanceInvoice;
use App\Models\FinanceLedgerEntry;
use App\Models\FinancePeriodClose;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialCloseController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    public function listCloses(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $closes = FinancePeriodClose::where('company_id', $company->id)
            ->with('closedBy:id,name')
            ->orderBy('period_end', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $closes,
        ]);
    }

    public function closePeriod(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'period_name' => 'required|string|max:50',
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
        ]);

        // 1. Verify that Subledger Debits == Credits (Alg 7.5 & 8.7)
        $totalDebits = (float) FinanceLedgerEntry::where('company_id', $company->id)
            ->where('entry_type', 'debit')
            ->sum('amount');

        $totalCredits = (float) FinanceLedgerEntry::where('company_id', $company->id)
            ->where('entry_type', 'credit')
            ->sum('amount');

        $imbalance = abs($totalDebits - $totalCredits);
        if ($imbalance > 0.01) {
            return response()->json([
                'status' => 'error',
                'message' => "Financial Close Blocked: General ledger imbalance detected (\${$imbalance}). Debits must equal Credits before closing.",
            ], 422);
        }

        // 2. Snapshot metrics
        $invoicesCount = FinanceInvoice::where('company_id', $company->id)->count();
        $snapshot = [
            'total_debits' => $totalDebits,
            'total_credits' => $totalCredits,
            'invoices_count' => $invoicesCount,
            'reconciled_at' => Carbon::now()->toIso8601String(),
        ];

        $close = FinancePeriodClose::create([
            'company_id' => $company->id,
            'period_name' => $validated['period_name'],
            'period_start' => $validated['period_start'],
            'period_end' => $validated['period_end'],
            'closed_by_user_id' => $request->user()->id,
            'closed_at' => Carbon::now(),
            'snapshot_metrics' => $snapshot,
            'status' => 'closed',
        ]);

        FinanceAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'period_closed',
            'entity_type' => 'FinancePeriodClose',
            'entity_id' => $close->id,
            'details' => ['period_name' => $close->period_name],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Financial reporting period closed and metrics snapshot persisted.',
            'data' => $close->load('closedBy:id,name'),
        ], 201);
    }

    public function reopenPeriod(Company $company, $closeId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'reason' => 'required|string|min:10',
        ]);

        $close = FinancePeriodClose::where('company_id', $company->id)->findOrFail($closeId);
        $close->update(['status' => 'reopened']);

        FinanceAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'period_reopened',
            'entity_type' => 'FinancePeriodClose',
            'entity_id' => $close->id,
            'details' => ['reason' => $validated['reason']],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Financial reporting period reopened with audit reason.',
            'data' => $close,
        ]);
    }
}

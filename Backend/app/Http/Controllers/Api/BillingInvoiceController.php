<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FinanceAuditEvent;
use App\Models\FinanceInvoice;
use App\Models\FinanceInvoiceLine;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceLedgerTransaction;
use App\Models\FinancePayment;
use App\Models\FinancePaymentAllocation;
use App\Models\Project;
use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BillingInvoiceController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    // =========================================================================
    // 1. INVOICES LIFECYCLE & BILLABLE REVENUE RECOVERY ENGINE (FR-05 & Feature C)
    // =========================================================================

    public function listInvoices(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = FinanceInvoice::where('company_id', $company->id)
            ->with(['client:id,name', 'project:id,name,project_code']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        $invoices = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $invoices,
        ]);
    }

    public function showInvoice(Company $company, $invoiceId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $invoice = FinanceInvoice::where('company_id', $company->id)
            ->with([
                'client:id,name',
                'project:id,name,project_code',
                'lines.timeEntry',
                'allocations.payment',
            ])
            ->findOrFail($invoiceId);

        return response()->json([
            'status' => 'success',
            'data' => $invoice,
        ]);
    }

    public function getBillingCandidates(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        // Fetch all consumed time_entry_ids across all valid invoice lines
        $consumedIds = FinanceInvoiceLine::where('company_id', $company->id)
            ->whereNotNull('time_entry_id')
            ->pluck('time_entry_id');

        // Query approved billable time entries not yet invoiced
        $query = TimeEntry::where('company_id', $company->id)
            ->where('is_billable', true)
            ->where('approval_status', 'approved')
            ->whereNotIn('id', $consumedIds)
            ->with(['project:id,name,project_code', 'membership.user:id,name']);

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        $candidates = $query->orderBy('started_at', 'asc')->get();

        $formatted = $candidates->map(function ($te) {
            $hours = round($te->duration_seconds / 3600, 2);
            $rate = 95.0; // standard billable rate
            return [
                'time_entry_id' => $te->id,
                'project_id' => $te->project_id,
                'project_name' => $te->project?->name ?? 'Internal',
                'employee_name' => $te->membership?->user?->name ?? 'Staff',
                'description' => $te->description ?: 'Engineering delivery work',
                'hours' => $hours,
                'rate' => $rate,
                'subtotal' => round($hours * $rate, 2),
                'date' => $te->started_at->toDateString(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'candidates' => $formatted,
                'total_hours' => round($formatted->sum('hours'), 2),
                'total_potential_revenue' => round($formatted->sum('subtotal'), 2),
            ],
        ]);
    }

    public function createDraftInvoice(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'client_name' => 'required|string|max:255',
            'client_id' => 'nullable|exists:client_organizations,id',
            'project_id' => 'nullable|exists:projects,id',
            'issue_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:issue_date',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'payment_terms' => 'nullable|string',
            'notes' => 'nullable|string',
            'time_entry_ids' => 'nullable|array',
            'custom_lines' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($company, $request, $validated) {
            $taxRate = (float) ($validated['tax_rate'] ?? 0.00);
            $discount = (float) ($validated['discount_amount'] ?? 0.00);

            // Compute subtotal from time entries and custom lines
            $subtotal = 0.00;
            $linesData = [];

            // 1. Time entry lines
            if (!empty($validated['time_entry_ids'])) {
                $timeEntries = TimeEntry::where('company_id', $company->id)
                    ->whereIn('id', $validated['time_entry_ids'])
                    ->get();

                foreach ($timeEntries as $te) {
                    $hours = round($te->duration_seconds / 3600, 2);
                    $rate = 95.0; // standard billable rate
                    $lineTotal = round($hours * $rate, 2);
                    $subtotal += $lineTotal;

                    $linesData[] = [
                        'time_entry_id' => $te->id,
                        'description' => "Billable Service: {$te->description} (" . round($hours, 2) . " hrs)",
                        'quantity' => $hours,
                        'unit_rate' => $rate,
                        'line_total' => $lineTotal,
                    ];
                }
            }

            // 2. Custom lines
            if (!empty($validated['custom_lines'])) {
                foreach ($validated['custom_lines'] as $cl) {
                    $qty = (float) ($cl['quantity'] ?? 1);
                    $rate = (float) ($cl['unit_rate'] ?? 0);
                    $lineTotal = round($qty * $rate, 2);
                    $subtotal += $lineTotal;

                    $linesData[] = [
                        'time_entry_id' => null,
                        'description' => $cl['description'] ?? 'Professional Services',
                        'quantity' => $qty,
                        'unit_rate' => $rate,
                        'line_total' => $lineTotal,
                    ];
                }
            }

            $taxAmount = round(($subtotal - $discount) * ($taxRate / 100), 2);
            $totalAmount = max(0.00, round($subtotal - $discount + $taxAmount, 2));

            $invoiceNumber = 'INV-' . strtoupper(Str::random(4)) . '-' . rand(1000, 9999);

            $invoice = FinanceInvoice::create([
                'company_id' => $company->id,
                'invoice_number' => $invoiceNumber,
                'client_id' => $validated['client_id'] ?? null,
                'project_id' => $validated['project_id'] ?? null,
                'client_name' => $validated['client_name'],
                'issue_date' => $validated['issue_date'],
                'due_date' => $validated['due_date'],
                'currency' => 'USD',
                'subtotal' => $subtotal,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'discount_amount' => $discount,
                'total_amount' => $totalAmount,
                'paid_amount' => 0.00,
                'balance_due' => $totalAmount,
                'status' => 'draft',
                'payment_terms' => $validated['payment_terms'] ?? 'Net 30',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($linesData as $ld) {
                FinanceInvoiceLine::create([
                    'company_id' => $company->id,
                    'invoice_id' => $invoice->id,
                    'time_entry_id' => $ld['time_entry_id'],
                    'description' => $ld['description'],
                    'quantity' => $ld['quantity'],
                    'unit_rate' => $ld['unit_rate'],
                    'line_total' => $ld['line_total'],
                ]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Draft invoice generated.',
                'data' => $invoice->load('lines'),
            ], 201);
        });
    }

    public function issueInvoice(Company $company, $invoiceId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $invoice = FinanceInvoice::where('company_id', $company->id)->findOrFail($invoiceId);

        if ($invoice->status !== 'draft') {
            return response()->json([
                'status' => 'error',
                'message' => 'Only draft invoices can be issued.',
            ], 422);
        }

        DB::transaction(function () use ($company, $request, $invoice) {
            $invoice->update([
                'status' => 'issued',
                'issued_at' => Carbon::now(),
            ]);

            // Balanced Double-Entry Subledger Posting (Alg 7.5)
            // Debit: 1200_ACCOUNTS_RECEIVABLE
            // Credit: 4000_PROJECT_REVENUE
            $tx = FinanceLedgerTransaction::create([
                'company_id' => $company->id,
                'transaction_code' => 'TX-INV-' . $invoice->id,
                'description' => "Invoice Issued #{$invoice->invoice_number} to {$invoice->client_name}",
                'transaction_date' => $invoice->issue_date,
                'source_type' => 'invoice_issued',
                'source_id' => $invoice->id,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '1200_ACCOUNTS_RECEIVABLE',
                'account_name' => 'Accounts Receivable',
                'entry_type' => 'debit',
                'amount' => $invoice->total_amount,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '4000_PROJECT_REVENUE',
                'account_name' => 'Project Service Revenue',
                'entry_type' => 'credit',
                'amount' => $invoice->total_amount,
            ]);

            FinanceAuditEvent::create([
                'company_id' => $company->id,
                'actor_user_id' => $request->user()->id,
                'action' => 'invoice_issued',
                'entity_type' => 'FinanceInvoice',
                'entity_id' => $invoice->id,
                'details' => [
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount' => $invoice->total_amount,
                ],
            ]);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Invoice issued and posted to balanced general ledger.',
            'data' => $invoice->fresh(),
        ]);
    }

    // =========================================================================
    // 2. CLIENT PAYMENTS & ALLOCATION (FR-06 & Alg 8.5)
    // =========================================================================

    public function listPayments(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $payments = FinancePayment::where('company_id', $company->id)
            ->with(['client:id,name', 'allocations.invoice:id,invoice_number'])
            ->orderBy('received_date', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $payments,
        ]);
    }

    public function recordPayment(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_reference' => 'required|string|max:100',
            'payment_method' => 'required|string|in:bank_transfer,credit_card,check,wire',
            'received_date' => 'required|date',
            'client_id' => 'nullable|exists:client_organizations,id',
            'notes' => 'nullable|string',
        ]);

        $payment = FinancePayment::create([
            'company_id' => $company->id,
            'client_id' => $validated['client_id'] ?? null,
            'payment_reference' => $validated['payment_reference'],
            'amount' => $validated['amount'],
            'currency' => 'USD',
            'payment_method' => $validated['payment_method'],
            'received_date' => $validated['received_date'],
            'allocated_amount' => 0.00,
            'unapplied_amount' => $validated['amount'],
            'status' => 'cleared',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Payment receipt recorded.',
            'data' => $payment,
        ], 201);
    }

    public function allocatePayment(Company $company, $paymentId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'invoice_id' => 'required|exists:finance_invoices,id',
            'allocated_amount' => 'required|numeric|min:0.01',
        ]);

        $payment = FinancePayment::where('company_id', $company->id)->findOrFail($paymentId);
        $invoice = FinanceInvoice::where('company_id', $company->id)->findOrFail($validated['invoice_id']);

        $allocAmount = (float) $validated['allocated_amount'];

        if ($allocAmount > (float) $payment->unapplied_amount) {
            return response()->json([
                'status' => 'error',
                'message' => 'Allocated amount exceeds unapplied payment balance.',
            ], 422);
        }

        if ($allocAmount > (float) $invoice->balance_due) {
            return response()->json([
                'status' => 'error',
                'message' => 'Allocated amount exceeds remaining invoice balance due.',
            ], 422);
        }

        DB::transaction(function () use ($company, $request, $payment, $invoice, $allocAmount) {
            // 1. Create allocation record
            FinancePaymentAllocation::create([
                'company_id' => $company->id,
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'allocated_amount' => $allocAmount,
            ]);

            // 2. Update Invoice Balance
            $newPaid = $invoice->paid_amount + $allocAmount;
            $newBalance = max(0.00, $invoice->total_amount - $newPaid);
            $newStatus = $newBalance <= 0.00 ? 'paid' : 'partially_paid';

            $invoice->update([
                'paid_amount' => $newPaid,
                'balance_due' => $newBalance,
                'status' => $newStatus,
            ]);

            // 3. Update Payment Balance
            $newAllocated = $payment->allocated_amount + $allocAmount;
            $newUnapplied = max(0.00, $payment->amount - $newAllocated);
            $newPaymentStatus = $newUnapplied <= 0.00 ? 'fully_allocated' : 'partial_allocated';

            $payment->update([
                'allocated_amount' => $newAllocated,
                'unapplied_amount' => $newUnapplied,
                'status' => $newPaymentStatus,
            ]);

            // 4. Balanced Double-Entry Subledger Posting
            // Debit: 1100_CASH
            // Credit: 1200_ACCOUNTS_RECEIVABLE
            $tx = FinanceLedgerTransaction::create([
                'company_id' => $company->id,
                'transaction_code' => 'TX-PAY-' . $payment->id . '-' . $invoice->id,
                'description' => "Payment Applied: {$payment->payment_reference} to Invoice {$invoice->invoice_number}",
                'transaction_date' => Carbon::now()->toDateString(),
                'source_type' => 'payment_received',
                'source_id' => $payment->id,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '1100_CASH',
                'account_name' => 'Cash & Bank Clearing',
                'entry_type' => 'debit',
                'amount' => $allocAmount,
            ]);

            FinanceLedgerEntry::create([
                'company_id' => $company->id,
                'transaction_id' => $tx->id,
                'account_code' => '1200_ACCOUNTS_RECEIVABLE',
                'account_name' => 'Accounts Receivable',
                'entry_type' => 'credit',
                'amount' => $allocAmount,
            ]);

            FinanceAuditEvent::create([
                'company_id' => $company->id,
                'actor_user_id' => $request->user()->id,
                'action' => 'payment_allocated',
                'entity_type' => 'FinancePayment',
                'entity_id' => $payment->id,
                'details' => [
                    'invoice_id' => $invoice->id,
                    'allocated_amount' => $allocAmount,
                    'remaining_balance_due' => $newBalance,
                ],
            ]);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Payment allocated and subledger updated.',
            'data' => [
                'payment' => $payment->fresh(),
                'invoice' => $invoice->fresh(),
            ],
        ]);
    }
}

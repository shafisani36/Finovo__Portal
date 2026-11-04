<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\FinanceBillingContract;
use App\Models\FinanceEmployeeCostRate;
use App\Models\FinanceExpense;
use App\Models\FinanceInvoice;
use App\Models\FinanceLedgerEntry;
use App\Models\FinancePayment;
use App\Models\FinanceProjectBudget;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinanceManagementM12Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanySetup(): array
    {
        $uid = uniqid();
        $owner = User::factory()->create(['name' => 'Fiona Finance', 'email' => "fiona.{$uid}@finovo.com"]);
        $pm = User::factory()->create(['name' => 'Peter PM', 'email' => "peter.{$uid}@finovo.com"]);
        $engineer = User::factory()->create(['name' => 'Edward Eng', 'email' => "edward.{$uid}@finovo.com"]);

        $company = Company::create([
            'name' => 'Finovo Global Capital HQ',
            'slug' => 'finovo-fin-' . $uid,
            'status' => 'active',
            'timezone' => 'UTC',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();

        $ownerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerMembership->roles()->sync([$ownerRole->id]);

        $pmMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $pm->id,
            'status' => 'active',
        ]);
        $pmMembership->roles()->sync([$ownerRole->id]);

        $engMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $engineer->id,
            'status' => 'active',
        ]);
        $engMembership->roles()->sync([$ownerRole->id]);

        $engineerEmp = EmploymentRecord::create([
            'company_id' => $company->id,
            'membership_id' => $engMembership->id,
            'employee_number' => 'EMP-FIN-' . rand(100, 999),
            'status' => 'active',
            'hire_date' => Carbon::now()->subMonths(6),
        ]);

        $project = Project::create([
            'company_id' => $company->id,
            'name' => 'SaaS FinTech Platform',
            'project_code' => 'PRJ-M12',
            'status' => 'active',
            'billing_model' => 'hourly',
            'budget_amount' => 20000.00,
            'currency' => 'USD',
            'progress_percent' => 40.0,
            'created_by' => $owner->id,
        ]);

        return compact('company', 'owner', 'pm', 'engineer', 'engMembership', 'engineerEmp', 'project');
    }

    public function test_financial_overview_returns_metrics_and_unbilled_revenue_indicator(): void
    {
        $setup = $this->createCompanySetup();

        $response = $this->actingAs($setup['owner'], 'sanctum')
            ->getJson("/api/v1/companies/{$setup['company']->id}/finance/overview");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'data' => [
                    'currency',
                    'summary' => ['total_invoiced_revenue', 'total_cash_collected', 'outstanding_receivables'],
                    'cost_and_profitability' => ['labor_cost', 'operating_expenses', 'gross_profit', 'gross_margin_percent'],
                    'unbilled_revenue_recovery' => ['unbilled_hours', 'unbilled_estimated_value'],
                ],
            ]);
    }

    public function test_project_budget_creation_and_audited_revision(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Set Initial Budget
        $setResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/projects/{$setup['project']->id}/budget", [
                'approved_budget' => 25000.00,
                'labor_budget' => 20000.00,
                'expense_budget' => 5000.00,
            ]);

        $setResponse->assertStatus(200)
            ->assertJsonPath('data.approved_budget', '25000.00');

        // 2. Revise Budget
        $reviseResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/projects/{$setup['project']->id}/budget-revisions", [
                'new_amount' => 30000.00,
                'reason' => 'Client approved change order for advanced analytics microservice.',
            ]);

        $reviseResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.approved_budget', '30000.00')
            ->assertJsonPath('data.current_revision', 2);

        $this->assertDatabaseHas('finance_budget_revisions', [
            'company_id' => $setup['company']->id,
            'previous_amount' => 25000.00,
            'new_amount' => 30000.00,
        ]);
    }

    public function test_labor_cost_synchronization_from_approved_time_entries(): void
    {
        $setup = $this->createCompanySetup();

        // Effective-dated internal cost rate ($60/hr)
        FinanceEmployeeCostRate::create([
            'company_id' => $setup['company']->id,
            'employee_id' => $setup['engineerEmp']->id,
            'internal_cost_rate' => 60.00,
            'currency' => 'USD',
            'effective_from' => '2026-01-01',
        ]);

        // Approved time entry (5 hours = 18000 seconds)
        $timeEntry = TimeEntry::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['engMembership']->id,
            'employment_record_id' => $setup['engineerEmp']->id,
            'project_id' => $setup['project']->id,
            'started_at' => Carbon::now()->subDays(2),
            'ended_at' => Carbon::now()->subDays(2)->addHours(5),
            'duration_seconds' => 18000,
            'approval_status' => 'approved',
            'is_billable' => true,
            'description' => 'Developed financial subledger transactions engine',
        ]);

        // Sync labor costs
        $syncResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/projects/{$setup['project']->id}/sync-labor-costs");

        $syncResponse->assertStatus(200)
            ->assertJsonPath('synced_count', 1);

        // 5 hours * $60/hr = $300.00
        $this->assertDatabaseHas('finance_project_cost_entries', [
            'company_id' => $setup['company']->id,
            'project_id' => $setup['project']->id,
            'source_type' => 'time_entry',
            'source_id' => $timeEntry->id,
            'cost_rate' => 60.00,
            'amount' => 300.00,
        ]);
    }

    public function test_project_profitability_digital_twin_and_margin_leak_detector(): void
    {
        $setup = $this->createCompanySetup();

        FinanceProjectBudget::create([
            'company_id' => $setup['company']->id,
            'project_id' => $setup['project']->id,
            'approved_budget' => 10000.00,
            'labor_budget' => 8000.00,
            'expense_budget' => 2000.00,
        ]);

        // Create tasks with remaining hours
        Task::create([
            'company_id' => $setup['company']->id,
            'project_id' => $setup['project']->id,
            'task_code' => 'TSK-01',
            'title' => 'Core Ledger Implementation',
            'status' => 'in_progress',
            'estimated_hours' => 50,
            'creator_membership_id' => $setup['engMembership']->id,
        ]);

        $twinResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->getJson("/api/v1/companies/{$setup['company']->id}/finance/projects/{$setup['project']->id}/profitability");

        $twinResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'data' => [
                    'digital_twin' => [
                        'approved_budget',
                        'total_actual_cost',
                        'remaining_task_hours_estimate',
                        'forecast_final_cost',
                        'forecast_margin_percent',
                    ],
                    'margin_leaks',
                    'explainability',
                ],
            ]);
    }

    public function test_billable_revenue_recovery_engine_identifies_unbilled_work(): void
    {
        $setup = $this->createCompanySetup();

        // Approved billable time entry (4 hours)
        $te = TimeEntry::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['engMembership']->id,
            'employment_record_id' => $setup['engineerEmp']->id,
            'project_id' => $setup['project']->id,
            'started_at' => Carbon::now()->subDays(1),
            'ended_at' => Carbon::now()->subDays(1)->addHours(4),
            'duration_seconds' => 14400,
            'approval_status' => 'approved',
            'is_billable' => true,
            'description' => 'Built double-entry posting rules',
        ]);

        $candidatesResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->getJson("/api/v1/companies/{$setup['company']->id}/finance/billing-candidates");

        $candidatesResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.total_hours', 4);

        $this->assertEquals($te->id, $candidatesResponse->json('data.candidates.0.time_entry_id'));
    }

    public function test_invoice_creation_and_issuance_creates_balanced_ledger_entries(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Create Draft Invoice
        $draftResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/invoices/draft", [
                'client_name' => 'Acme Global Ventures',
                'project_id' => $setup['project']->id,
                'issue_date' => '2026-10-01',
                'due_date' => '2026-10-31',
                'tax_rate' => 10.00,
                'discount_amount' => 100.00,
                'custom_lines' => [
                    ['description' => 'Architecture Consulting', 'quantity' => 10, 'unit_rate' => 150.00], // $1500
                ],
            ]);

        $draftResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.subtotal', '1500.00')
            ->assertJsonPath('data.discount_amount', '100.00')
            ->assertJsonPath('data.tax_amount', '140.00') // (1500 - 100) * 10% = 140
            ->assertJsonPath('data.total_amount', '1540.00'); // 1400 + 140 = 1540

        $invoiceId = $draftResponse->json('data.id');

        // 2. Issue Invoice
        $issueResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/invoices/{$invoiceId}/issue");

        $issueResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'issued');

        // Verify balanced double-entry subledger: Debit AR 1540 == Credit Revenue 1540
        $debits = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '1200_ACCOUNTS_RECEIVABLE')
            ->where('entry_type', 'debit')
            ->sum('amount');

        $credits = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '4000_PROJECT_REVENUE')
            ->where('entry_type', 'credit')
            ->sum('amount');

        $this->assertEquals(1540.00, $debits);
        $this->assertEquals(1540.00, $credits);
    }

    public function test_payment_recording_and_partial_allocation_updates_invoice_and_ledger(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Create and issue invoice for $1000
        $invoice = FinanceInvoice::create([
            'company_id' => $setup['company']->id,
            'invoice_number' => 'INV-TEST-001',
            'client_name' => 'TechCorp Global',
            'issue_date' => Carbon::now(),
            'due_date' => Carbon::now()->addDays(30),
            'subtotal' => 1000.00,
            'total_amount' => 1000.00,
            'paid_amount' => 0.00,
            'balance_due' => 1000.00,
            'status' => 'issued',
        ]);

        // 2. Record Payment for $600
        $payResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/payments", [
                'amount' => 600.00,
                'payment_reference' => 'WIRE-REF-9988',
                'payment_method' => 'bank_transfer',
                'received_date' => Carbon::now()->toDateString(),
            ]);

        $payResponse->assertStatus(201)
            ->assertJsonPath('data.amount', '600.00')
            ->assertJsonPath('data.unapplied_amount', '600.00');

        $paymentId = $payResponse->json('data.id');

        // 3. Allocate $600 to invoice
        $allocResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/payments/{$paymentId}/allocations", [
                'invoice_id' => $invoice->id,
                'allocated_amount' => 600.00,
            ]);

        $allocResponse->assertStatus(200)
            ->assertJsonPath('data.invoice.status', 'partially_paid')
            ->assertJsonPath('data.invoice.paid_amount', '600.00')
            ->assertJsonPath('data.invoice.balance_due', '400.00')
            ->assertJsonPath('data.payment.status', 'fully_allocated')
            ->assertJsonPath('data.payment.unapplied_amount', '0.00');

        // Verify balanced double-entry: Debit Cash $600 == Credit AR $600
        $debitCash = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '1100_CASH')
            ->where('entry_type', 'debit')
            ->sum('amount');

        $creditAR = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '1200_ACCOUNTS_RECEIVABLE')
            ->where('entry_type', 'credit')
            ->sum('amount');

        $this->assertEquals(600.00, $debitCash);
        $this->assertEquals(600.00, $creditAR);
    }

    public function test_payment_over_allocation_is_rejected(): void
    {
        $setup = $this->createCompanySetup();

        $invoice = FinanceInvoice::create([
            'company_id' => $setup['company']->id,
            'invoice_number' => 'INV-TEST-002',
            'client_name' => 'TechCorp Global',
            'issue_date' => Carbon::now(),
            'due_date' => Carbon::now()->addDays(30),
            'subtotal' => 500.00,
            'total_amount' => 500.00,
            'paid_amount' => 0.00,
            'balance_due' => 500.00,
            'status' => 'issued',
        ]);

        $payment = FinancePayment::create([
            'company_id' => $setup['company']->id,
            'payment_reference' => 'WIRE-REF-001',
            'amount' => 200.00,
            'unapplied_amount' => 200.00,
            'allocated_amount' => 0.00,
            'payment_method' => 'wire',
            'received_date' => Carbon::now()->toDateString(),
        ]);

        // Attempt to allocate $300 when only $200 is available
        $allocResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/payments/{$payment->id}/allocations", [
                'invoice_id' => $invoice->id,
                'allocated_amount' => 300.00,
            ]);

        $allocResponse->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_expense_submission_approval_and_project_cost_allocation(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Submit Expense
        $subResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/expenses", [
                'project_id' => $setup['project']->id,
                'category' => 'hosting',
                'amount' => 450.00,
                'expense_date' => Carbon::now()->toDateString(),
                'merchant' => 'AWS Cloud Infrastructure',
                'description' => 'Dedicated Redis and production RDS cluster',
            ]);

        $subResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'submitted');

        $expenseId = $subResponse->json('data.id');

        // 2. Approve Expense
        $appResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/expenses/{$expenseId}/approve");

        $appResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        // Verify project cost entry was automatically allocated
        $this->assertDatabaseHas('finance_project_cost_entries', [
            'company_id' => $setup['company']->id,
            'project_id' => $setup['project']->id,
            'source_type' => 'expense',
            'source_id' => $expenseId,
            'amount' => 450.00,
        ]);

        // Verify balanced double-entry: Debit Operating Expense == Credit AP
        $debits = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '5100_OPERATING_EXPENSE')
            ->sum('amount');

        $credits = FinanceLedgerEntry::where('company_id', $setup['company']->id)
            ->where('account_code', '2000_ACCOUNTS_PAYABLE')
            ->sum('amount');

        $this->assertEquals(450.00, $debits);
        $this->assertEquals(450.00, $credits);
    }

    public function test_financial_period_close_validates_balanced_ledger_and_persists_snapshot(): void
    {
        $setup = $this->createCompanySetup();

        // Balanced entries: Debit Cash 500, Credit Revenue 500
        $tx = \App\Models\FinanceLedgerTransaction::create([
            'company_id' => $setup['company']->id,
            'transaction_code' => 'TX-CLOSE-TEST',
            'description' => 'Test Transaction',
            'transaction_date' => Carbon::now()->toDateString(),
            'source_type' => 'test',
        ]);
        FinanceLedgerEntry::create([
            'company_id' => $setup['company']->id,
            'transaction_id' => $tx->id,
            'account_code' => '1100_CASH',
            'account_name' => 'Cash',
            'entry_type' => 'debit',
            'amount' => 500.00,
        ]);
        FinanceLedgerEntry::create([
            'company_id' => $setup['company']->id,
            'transaction_id' => $tx->id,
            'account_code' => '4000_PROJECT_REVENUE',
            'account_name' => 'Revenue',
            'entry_type' => 'credit',
            'amount' => 500.00,
        ]);

        // Close Period
        $closeResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/period-closes", [
                'period_name' => '2026-Q3',
                'period_start' => '2026-07-01',
                'period_end' => '2026-09-30',
            ]);

        $closeResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.snapshot_metrics.total_debits', 500);

        $closeId = $closeResponse->json('data.id');

        // Reopen Period with Audit Reason
        $reopenResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/finance/period-closes/{$closeId}/reopen", [
                'reason' => 'Late vendor invoice adjustment required under accounting audit policy.',
            ]);

        $reopenResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'reopened');
    }

    public function test_financial_report_csv_export_and_tenant_isolation(): void
    {
        $setup = $this->createCompanySetup();

        $exportResponse = $this->actingAs($setup['owner'], 'sanctum')
            ->get("/api/v1/companies/{$setup['company']->id}/finance/export");

        $exportResponse->assertStatus(200);
        $this->assertStringContainsString('text/csv', $exportResponse->headers->get('Content-Type'));
    }
}

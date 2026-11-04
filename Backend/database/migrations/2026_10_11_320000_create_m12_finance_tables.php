<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Finance Company Settings
        Schema::create('finance_company_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->string('base_currency', 3)->default('USD');
            $table->unsignedTinyInteger('fiscal_year_start_month')->default(1);
            $table->decimal('default_tax_rate', 5, 2)->default(10.00);
            $table->unsignedSmallInteger('overdue_grace_days')->default(15);
            $table->timestamps();
        });

        // 2. Employee Internal Cost Rates (Effective-dated)
        Schema::create('finance_employee_cost_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->decimal('internal_cost_rate', 12, 2);
            $table->string('currency', 3)->default('USD');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'effective_from'], 'idx_emp_cost_rate');
        });

        // 3. Billing Contracts
        Schema::create('finance_billing_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('client_organizations')->nullOnDelete();
            $table->string('contract_type')->default('hourly'); // hourly, fixed_price, milestone, retainer
            $table->decimal('billing_rate', 12, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->decimal('budget_cap', 14, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'project_id']);
        });

        // 4. Project Budgets
        Schema::create('finance_project_budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->decimal('approved_budget', 14, 2);
            $table->string('currency', 3)->default('USD');
            $table->decimal('labor_budget', 14, 2)->default(0.00);
            $table->decimal('expense_budget', 14, 2)->default(0.00);
            $table->string('status')->default('active'); // active, revised, closed
            $table->unsignedInteger('current_revision')->default(1);
            $table->timestamps();

            $table->unique(['company_id', 'project_id']);
        });

        // 5. Budget Revisions
        Schema::create('finance_budget_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_budget_id')->constrained('finance_project_budgets')->cascadeOnDelete();
            $table->decimal('previous_amount', 14, 2);
            $table->decimal('new_amount', 14, 2);
            $table->text('reason');
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'project_budget_id']);
        });

        // 6. Project Cost Entries (Labor & Non-Labor)
        Schema::create('finance_project_cost_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('source_type'); // time_entry, expense, direct_allocation
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('description');
            $table->decimal('cost_rate', 12, 2)->default(0.00);
            $table->decimal('hours', 8, 2)->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3)->default('USD');
            $table->date('incurred_date');
            $table->timestamps();

            $table->index(['company_id', 'project_id', 'incurred_date'], 'idx_proj_cost_entries');
            $table->index(['source_type', 'source_id']);
        });

        // 7. Client Invoices
        Schema::create('finance_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('invoice_number');
            $table->foreignId('client_id')->nullable()->constrained('client_organizations')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('client_name');
            $table->date('issue_date');
            $table->date('due_date');
            $table->string('currency', 3)->default('USD');
            $table->decimal('subtotal', 14, 2);
            $table->decimal('tax_rate', 5, 2)->default(0.00);
            $table->decimal('tax_amount', 14, 2)->default(0.00);
            $table->decimal('discount_amount', 14, 2)->default(0.00);
            $table->decimal('total_amount', 14, 2);
            $table->decimal('paid_amount', 14, 2)->default(0.00);
            $table->decimal('balance_due', 14, 2);
            $table->string('status')->default('draft'); // draft, issued, partially_paid, paid, overdue, voided, credited
            $table->string('payment_terms')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'invoice_number']);
            $table->index(['company_id', 'status', 'due_date']);
        });

        // 8. Invoice Lines
        Schema::create('finance_invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('finance_invoices')->cascadeOnDelete();
            $table->foreignId('time_entry_id')->nullable()->constrained('time_entries')->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1.00);
            $table->decimal('unit_rate', 12, 2)->default(0.00);
            $table->decimal('line_total', 14, 2);
            $table->timestamps();

            $table->index(['company_id', 'invoice_id']);
            $table->index(['company_id', 'time_entry_id']);
        });

        // 9. Client Payments
        Schema::create('finance_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('client_organizations')->nullOnDelete();
            $table->string('payment_reference');
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3)->default('USD');
            $table->string('payment_method')->default('bank_transfer'); // bank_transfer, credit_card, check, wire
            $table->date('received_date');
            $table->decimal('allocated_amount', 14, 2)->default(0.00);
            $table->decimal('unapplied_amount', 14, 2);
            $table->string('status')->default('cleared'); // cleared, partial_allocated, fully_allocated, refunded
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 10. Payment Allocations
        Schema::create('finance_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained('finance_payments')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('finance_invoices')->cascadeOnDelete();
            $table->decimal('allocated_amount', 14, 2);
            $table->timestamps();

            $table->index(['company_id', 'payment_id', 'invoice_id'], 'idx_payment_alloc');
        });

        // 11. Expenses & Receipts
        Schema::create('finance_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('category'); // travel, software_licenses, hardware, meals, hosting, contractor, general
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3)->default('USD');
            $table->date('expense_date');
            $table->string('merchant');
            $table->text('description');
            $table->string('receipt_path')->nullable();
            $table->string('receipt_hash')->nullable();
            $table->string('status')->default('submitted'); // draft, submitted, approved, rejected, reimbursed
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status', 'project_id']);
        });

        // 12. Double-Entry Balanced Subledger: Transactions & Entries
        Schema::create('finance_ledger_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('transaction_code');
            $table->string('description');
            $table->date('transaction_date');
            $table->string('source_type'); // invoice_issued, payment_received, expense_approved
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'transaction_date']);
        });

        Schema::create('finance_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained('finance_ledger_transactions')->cascadeOnDelete();
            $table->string('account_code'); // 1100_CASH, 1200_ACCOUNTS_RECEIVABLE, 4000_PROJECT_REVENUE, 5000_LABOR_EXPENSE, 5100_OPERATING_EXPENSE
            $table->string('account_name');
            $table->string('entry_type'); // debit, credit
            $table->decimal('amount', 14, 2);
            $table->timestamps();

            $table->index(['company_id', 'account_code']);
        });

        // 13. Financial Period Closes
        Schema::create('finance_period_closes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('period_name');
            $table->date('period_start');
            $table->date('period_end');
            $table->foreignId('closed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->json('snapshot_metrics')->nullable();
            $table->string('status')->default('closed'); // closed, reopened
            $table->timestamps();

            $table->unique(['company_id', 'period_name']);
        });

        // 14. Finance Audit Events
        Schema::create('finance_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // budget_revised, invoice_issued, payment_allocated, expense_approved, period_closed
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('details')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'action']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('finance_audit_events');
        Schema::dropIfExists('finance_period_closes');
        Schema::dropIfExists('finance_ledger_entries');
        Schema::dropIfExists('finance_ledger_transactions');
        Schema::dropIfExists('finance_expenses');
        Schema::dropIfExists('finance_payment_allocations');
        Schema::dropIfExists('finance_payments');
        Schema::dropIfExists('finance_invoice_lines');
        Schema::dropIfExists('finance_invoices');
        Schema::dropIfExists('finance_project_cost_entries');
        Schema::dropIfExists('finance_budget_revisions');
        Schema::dropIfExists('finance_project_budgets');
        Schema::dropIfExists('finance_billing_contracts');
        Schema::dropIfExists('finance_employee_cost_rates');
        Schema::dropIfExists('finance_company_settings');
    }
};

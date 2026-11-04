<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M09: Deterministic Payroll Engine (DECIMAL(19,4) Precision).
     */
    public function up(): void
    {
        // 1. Employee Compensation Packages (Effective-Dated Half-Open Intervals)
        if (!Schema::hasTable('compensation_packages')) {
            Schema::create('compensation_packages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('currency', 3)->default('USD');
                $table->decimal('base_salary', 19, 4);
                $table->string('pay_frequency', 30)->default('monthly'); // monthly, biweekly, semi_monthly, weekly
                $table->json('components')->nullable(); // allowances, recurring benefits, fixed bonuses
                $table->date('effective_from');
                $table->date('effective_to')->nullable(); // null = currently active
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id', 'is_active'], 'comp_pkg_comp_emp_act_idx');
                $table->index(['effective_from', 'effective_to'], 'comp_pkg_dates_idx');
            });
        }

        // 2. Payroll Runs
        if (!Schema::hasTable('payroll_runs')) {
            Schema::create('payroll_runs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('run_number', 60);
                $table->date('period_start');
                $table->date('period_end');
                $table->date('pay_date');
                $table->string('currency', 3)->default('USD');
                $table->string('status', 30)->default('draft'); // draft, calculating, calculated, approved, finalized, paid, cancelled
                $table->decimal('total_gross', 19, 4)->default(0.0000);
                $table->decimal('total_deductions', 19, 4)->default(0.0000);
                $table->decimal('total_statutory', 19, 4)->default(0.0000);
                $table->decimal('total_net', 19, 4)->default(0.0000);
                $table->decimal('total_employer_contributions', 19, 4)->default(0.0000);
                $table->unsignedInteger('employee_count')->default(0);
                $table->foreignId('prepared_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('approved_at')->nullable();
                $table->foreignId('finalized_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('finalized_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'run_number'], 'pr_comp_num_uniq');
                $table->index(['company_id', 'status'], 'pr_comp_stat_idx');
            });
        }

        // 3. Payroll Line Items (Atomic Ledger Breakdown per Employee)
        if (!Schema::hasTable('payroll_line_items')) {
            Schema::create('payroll_line_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
                $table->string('item_type', 40); // earning, deduction, statutory_tax, statutory_social, employer_tax, reimbursement
                $table->string('code', 60);
                $table->string('name', 150);
                $table->decimal('rate', 19, 4)->nullable();
                $table->decimal('hours', 8, 2)->nullable();
                $table->decimal('amount', 19, 4);
                $table->boolean('is_taxable')->default(true);
                $table->json('calculation_trace')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'payroll_run_id', 'employment_record_id'], 'pli_comp_run_emp_idx');
                $table->index(['payroll_run_id', 'item_type'], 'pli_run_type_idx');
            });
        }

        // 4. Payslips
        if (!Schema::hasTable('payslips')) {
            Schema::create('payslips', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
                $table->string('payslip_number', 60);
                $table->decimal('gross_pay', 19, 4);
                $table->decimal('total_deductions', 19, 4);
                $table->decimal('net_pay', 19, 4);
                $table->string('currency', 3)->default('USD');
                $table->string('status', 30)->default('draft'); // draft, published, viewed
                $table->string('payment_method', 50)->default('direct_deposit');
                $table->string('bank_account_mask', 50)->nullable();
                $table->dateTime('published_at')->nullable();
                $table->timestamps();

                $table->unique(['payroll_run_id', 'employment_record_id'], 'ps_run_emp_uniq');
                $table->index(['company_id', 'membership_id'], 'ps_comp_mem_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('payroll_line_items');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('compensation_packages');
    }
};

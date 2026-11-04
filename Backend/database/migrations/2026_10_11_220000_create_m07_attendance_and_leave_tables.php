<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Shifts (Reusable shift definitions and work schedules)
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('code', 50)->nullable();
            $table->string('timezone', 50)->default('UTC');
            $table->time('start_time'); // e.g. 09:00:00
            $table->time('end_time');   // e.g. 18:00:00
            $table->integer('grace_period_minutes')->default(15);
            $table->decimal('half_day_hours', 4, 2)->default(4.00);
            $table->integer('break_duration_minutes')->default(60);
            $table->boolean('is_overnight')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
            $table->index(['company_id', 'is_active']);
        });

        // 2. Shift Assignments (Assigning employees to shifts with date ranges)
        Schema::create('shift_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->foreignId('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->foreignId('assigned_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'effective_from'], 'shift_assign_comp_mem_eff_idx');
        });

        // 3. Attendance Policies
        Schema::create('attendance_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->boolean('require_shift_assignment')->default(false);
            $table->integer('auto_clock_out_hours')->default(14);
            $table->integer('late_tolerance_minutes')->default(15);
            $table->integer('early_departure_tolerance_minutes')->default(15);
            $table->boolean('enable_offline_sync')->default(true);
            $table->timestamps();
        });

        // 4. Attendance Records (One daily summary per employee per work date)
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->date('work_date');
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('status', 30)->default('present')->index(); 
            // present, late, early_departure, partial, absent, on_leave, holiday, rest_day, needs_review
            $table->dateTime('first_clock_in_at')->nullable();
            $table->dateTime('last_clock_out_at')->nullable();
            $table->integer('worked_seconds')->default(0);
            $table->integer('break_seconds')->default(0);
            $table->integer('late_seconds')->default(0);
            $table->integer('early_departure_seconds')->default(0);
            $table->boolean('is_overtime')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['company_id', 'membership_id', 'work_date'], 'att_rec_comp_mem_date_unq');
            $table->index(['company_id', 'work_date', 'status'], 'att_rec_comp_date_stat_idx');
        });

        // 5. Attendance Events (Immutable clock-in, clock-out, break events)
        Schema::create('attendance_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('attendance_record_id')->constrained('attendance_records')->cascadeOnDelete();
            $table->string('event_type', 30)->index(); // clock_in, clock_out, break_start, break_end, adjustment
            $table->dateTime('occurred_at');
            $table->dateTime('received_at');
            $table->string('source', 30)->default('web'); // web, mobile, desktop, manual, admin
            $table->string('device_id', 100)->nullable();
            $table->string('idempotency_key', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'occurred_at'], 'att_evt_comp_mem_occ_idx');
            $table->index(['company_id', 'idempotency_key'], 'att_evt_comp_idem_idx');
        });

        // 6. Attendance Breaks (Attendance-specific break intervals)
        Schema::create('attendance_breaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('attendance_record_id')->constrained('attendance_records')->cascadeOnDelete();
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->string('break_type', 50)->default('meal'); // meal, rest, medical
            $table->boolean('is_paid')->default(false);
            $table->integer('duration_seconds')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'attendance_record_id'], 'att_brk_comp_rec_idx');
        });

        // 7. Attendance Correction Requests
        Schema::create('attendance_correction_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('attendance_record_id')->nullable()->constrained('attendance_records')->nullOnDelete();
            $table->date('requested_work_date');
            $table->dateTime('proposed_clock_in_at')->nullable();
            $table->dateTime('proposed_clock_out_at')->nullable();
            $table->text('reason');
            $table->string('status', 30)->default('pending')->index(); // pending, approved, rejected
            $table->foreignId('reviewer_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->text('decision_reason')->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'status'], 'att_corr_comp_mem_stat_idx');
        });

        // 8. Leave Types (Company leave categories)
        Schema::create('leave_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('code', 50)->nullable();
            $table->boolean('is_paid')->default(true);
            $table->boolean('requires_balance')->default(true);
            $table->boolean('allow_half_day')->default(true);
            $table->boolean('allow_partial_day')->default(false);
            $table->string('color', 30)->default('#F95716');
            $table->integer('max_consecutive_days')->default(30);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
            $table->index(['company_id', 'is_active']);
        });

        // 9. Leave Policies
        Schema::create('leave_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->decimal('annual_accrual_days', 5, 2)->default(14.00);
            $table->string('accrual_frequency', 30)->default('annually'); // annually, monthly, upfront
            $table->decimal('carry_forward_limit_days', 5, 2)->default(5.00);
            $table->boolean('negative_balance_allowed')->default(false);
            $table->integer('min_notice_days')->default(1);
            $table->boolean('probation_eligible')->default(false);
            $table->date('effective_from')->nullable();
            $table->timestamps();
        });

        // 10. Leave Balances (Current projected balance)
        Schema::create('leave_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->foreignId('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->integer('year');
            $table->decimal('opening_days', 5, 2)->default(0.00);
            $table->decimal('accrued_days', 5, 2)->default(0.00);
            $table->decimal('used_days', 5, 2)->default(0.00);
            $table->decimal('reserved_days', 5, 2)->default(0.00); // Pending requests
            $table->decimal('carried_over_days', 5, 2)->default(0.00);
            $table->decimal('adjusted_days', 5, 2)->default(0.00);
            $table->decimal('available_days', 5, 2)->default(0.00);
            $table->timestamps();

            $table->unique(['company_id', 'membership_id', 'leave_type_id', 'year'], 'leave_bal_mem_type_yr_unq');
            $table->index(['company_id', 'membership_id'], 'leave_bal_comp_mem_idx');
        });

        // 11. Leave Balance Transactions (Append-only Ledger)
        Schema::create('leave_balance_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->string('transaction_type', 30)->index(); // accrual, reservation, usage, release, adjustment, carry_over, expiry
            $table->decimal('days', 5, 2);
            $table->decimal('balance_after', 5, 2);
            $table->string('reference_type', 100)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'leave_type_id'], 'leave_bal_tx_mem_type_idx');
        });

        // 12. Leave Requests
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->foreignId('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('requested_units', 5, 2); // days
            $table->string('day_portion', 30)->default('full'); // full, first_half, second_half
            $table->text('reason');
            $table->string('status', 30)->default('submitted')->index(); // draft, submitted, approved, rejected, cancelled
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->foreignId('reviewed_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'status'], 'leave_req_comp_mem_stat_idx');
            $table->index(['company_id', 'start_date', 'end_date'], 'leave_req_comp_dates_idx');
        });

        // 13. Leave Request Days (Per-day breakdown)
        Schema::create('leave_request_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('leave_request_id')->constrained('leave_requests')->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('units', 4, 2)->default(1.00); // 1.00 for full day, 0.50 for half day
            $table->boolean('is_working_day')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'leave_request_id'], 'leave_day_comp_req_idx');
            $table->index(['company_id', 'work_date'], 'leave_day_comp_date_idx');
        });

        // 14. Leave Approvals (Audit decision log)
        Schema::create('leave_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('leave_request_id')->constrained('leave_requests')->cascadeOnDelete();
            $table->foreignId('reviewer_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('action', 30); // approved, rejected, cancelled
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'leave_request_id'], 'leave_appr_comp_req_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_approvals');
        Schema::dropIfExists('leave_request_days');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('leave_balance_transactions');
        Schema::dropIfExists('leave_balances');
        Schema::dropIfExists('leave_policies');
        Schema::dropIfExists('leave_types');
        Schema::dropIfExists('attendance_correction_requests');
        Schema::dropIfExists('attendance_breaks');
        Schema::dropIfExists('attendance_events');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('attendance_policies');
        Schema::dropIfExists('shift_assignments');
        Schema::dropIfExists('shifts');
    }
};

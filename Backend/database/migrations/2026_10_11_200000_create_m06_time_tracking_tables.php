<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tracker Devices (Desktop Client Hardware & App Binding)
        Schema::create('tracker_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('device_uid', 100);
            $table->string('device_name', 150);
            $table->string('os_version', 100)->nullable();
            $table->string('app_version', 50)->nullable();
            $table->string('status', 30)->default('active')->index(); // active, revoked
            $table->dateTime('last_sync_at')->nullable();
            $table->dateTime('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'device_uid'], 'tracker_devices_company_uid_unique');
            $table->index(['company_id', 'membership_id', 'status']);
        });

        // 2. Company Time Policies
        Schema::create('time_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->boolean('allow_concurrent_sessions')->default(false);
            $table->integer('max_manual_entry_hours')->default(12);
            $table->integer('idle_timeout_minutes')->default(15);
            $table->boolean('require_timesheet_approval')->default(true);
            $table->boolean('enforce_separation_of_duties')->default(true); // Requester cannot approve own timesheet
            $table->string('timesheet_frequency', 30)->default('weekly'); // daily, weekly, biweekly, monthly
            $table->string('timezone', 50)->default('UTC');
            $table->timestamps();
        });

        // 3. Work Sessions (Active / Historical Stopwatch Runs)
        Schema::create('work_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->foreignId('tracker_device_id')->nullable()->constrained('tracker_devices')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('activity_type', 50)->default('task'); // task, meeting, training, internal
            $table->string('status', 30)->default('running')->index(); // running, paused, stopped
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->dateTime('last_event_at')->nullable();
            $table->integer('duration_seconds')->default(0);
            $table->string('idempotency_key', 100)->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'status']);
            $table->index(['company_id', 'idempotency_key']);
            $table->index(['company_id', 'started_at']);
        });

        // 4. Time Breaks (Rest, Lunch, Pauses within session)
        Schema::create('time_breaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('work_session_id')->constrained('work_sessions')->cascadeOnDelete();
            $table->string('break_type', 50)->default('pause'); // pause, lunch, rest, meeting
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->integer('duration_seconds')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'work_session_id']);
        });

        // 5. Timesheets (Periodical Submission and Approval Container)
        Schema::create('timesheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 30)->default('draft')->index(); // draft, submitted, approved, rejected
            $table->integer('total_tracked_seconds')->default(0);
            $table->integer('total_submitted_seconds')->default(0);
            $table->integer('total_approved_seconds')->default(0);
            $table->integer('total_billable_seconds')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->foreignId('approved_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'membership_id', 'period_start', 'period_end'], 'timesheets_period_unique');
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'membership_id', 'status']);
        });

        // 6. Time Entries (Granular recorded intervals)
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('work_session_id')->nullable()->constrained('work_sessions')->nullOnDelete();
            $table->foreignId('timesheet_id')->nullable()->constrained('timesheets')->nullOnDelete();
            $table->dateTime('started_at');
            $table->dateTime('ended_at');
            $table->integer('duration_seconds');
            $table->string('source', 30)->default('timer')->index(); // timer, manual, adjustment
            $table->string('approval_status', 30)->default('draft')->index(); // draft, submitted, approved, rejected
            $table->boolean('is_billable')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'started_at']);
            $table->index(['company_id', 'task_id']);
            $table->index(['company_id', 'project_id']);
            $table->index(['company_id', 'timesheet_id']);
        });

        // 7. Timesheet Approvals (Full Audit History of Reviews)
        Schema::create('timesheet_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('timesheet_id')->constrained('timesheets')->cascadeOnDelete();
            $table->foreignId('reviewer_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('action', 30); // approved, rejected, reopened
            $table->unsignedInteger('version_at_action');
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'timesheet_id']);
        });

        // 8. Time Entry Adjustments (Post-Approval or Manual Correction Workflow)
        Schema::create('time_entry_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('time_entry_id')->constrained('time_entries')->cascadeOnDelete();
            $table->foreignId('requester_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('reviewer_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->integer('original_duration_seconds');
            $table->integer('proposed_duration_seconds');
            $table->dateTime('original_started_at');
            $table->dateTime('proposed_started_at');
            $table->dateTime('original_ended_at');
            $table->dateTime('proposed_ended_at');
            $table->text('reason');
            $table->string('status', 30)->default('pending')->index(); // pending, approved, rejected
            $table->text('decision_reason')->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'time_entry_id', 'status']);
        });

        // 9. Time Sync Batches (Offline Desktop Tracker Batch Reconciliation)
        Schema::create('time_sync_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('tracker_device_id')->nullable()->constrained('tracker_devices')->nullOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('batch_uid', 100)->unique();
            $table->integer('events_count')->default(0);
            $table->string('status', 30)->default('completed')->index(); // completed, partial_conflicts, failed
            $table->json('conflicts_payload')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_sync_batches');
        Schema::dropIfExists('time_entry_adjustments');
        Schema::dropIfExists('timesheet_approvals');
        Schema::dropIfExists('time_entries');
        Schema::dropIfExists('timesheets');
        Schema::dropIfExists('time_breaks');
        Schema::dropIfExists('work_sessions');
        Schema::dropIfExists('time_policies');
        Schema::dropIfExists('tracker_devices');
    }
};

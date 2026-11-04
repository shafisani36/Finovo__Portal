<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('monitoring_reconciliation_cases');
        Schema::dropIfExists('monitoring_disputes');
        Schema::dropIfExists('monitoring_context_annotations');
        Schema::dropIfExists('monitoring_device_heartbeats');
        Schema::dropIfExists('monitoring_intervals');
        Schema::dropIfExists('monitoring_events');
        Schema::dropIfExists('monitoring_policy_acknowledgments');
        Schema::dropIfExists('monitoring_policy_assignments');
        Schema::dropIfExists('monitoring_policies');

        // 1. Versioned Monitoring Policies
        Schema::create('monitoring_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 150);
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(false);
            $table->boolean('allow_app_category_collection')->default(true);
            $table->boolean('allow_foreground_app')->default(true);
            $table->boolean('allow_input_activity')->default(true);
            $table->unsignedInteger('idle_threshold_seconds')->default(300); // 5 min idle
            $table->boolean('allow_offline_queue')->default(true);
            $table->unsignedInteger('offline_grace_hours')->default(48);
            $table->unsignedInteger('retention_days')->default(90);
            $table->string('min_client_version', 50)->default('1.0.0');
            $table->json('settings')->nullable();
            $table->dateTime('effective_from')->nullable();
            $table->dateTime('effective_until')->nullable();
            $table->foreignId('created_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'is_active'], 'mon_pol_co_act_idx');
        });

        // 2. Policy Assignments (Targeting company, department, role, or individual)
        Schema::create('monitoring_policy_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_id')->constrained('monitoring_policies')->cascadeOnDelete();
            $table->string('target_type', 50)->default('company'); // company, department, role, employee
            $table->unsignedBigInteger('target_id')->nullable();
            $table->timestamps();

            $table->index(['policy_id', 'target_type'], 'mon_pol_asgn_typ_idx');
        });

        // 3. Employee Policy Acknowledgments (Transparency & Consent)
        Schema::create('monitoring_policy_acknowledgments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('policy_id')->constrained('monitoring_policies')->cascadeOnDelete();
            $table->unsignedInteger('policy_version');
            $table->dateTime('acknowledged_at');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['membership_id', 'policy_id', 'policy_version'], 'mon_pol_ack_mem_ver_uniq');
        });

        // 4. Permitted Monitoring Events (Raw observations, idempotency & minimization)
        Schema::create('monitoring_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('tracker_device_id')->nullable()->constrained('tracker_devices')->nullOnDelete();
            $table->string('event_uid', 100);
            $table->string('event_type', 50); // heartbeat, activity_presence, idle_interval, category_changed, context_changed, break_state
            $table->dateTime('client_occurred_at');
            $table->dateTime('server_received_at');
            $table->unsignedBigInteger('client_sequence')->default(0);
            $table->unsignedInteger('policy_version')->default(1);
            $table->string('category', 50)->nullable(); // development, communication, documentation, design, meeting, unclassified
            $table->unsignedInteger('idle_duration_seconds')->nullable();
            $table->string('context_type', 50)->nullable();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('work_session_id')->nullable()->constrained('work_sessions')->nullOnDelete();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'event_uid'], 'mon_events_co_uid_uniq');
            $table->index(['company_id', 'membership_id', 'client_occurred_at'], 'mon_evt_co_mem_occ_idx');
        });

        // 5. Normalized Derived Intervals (Half-open intervals [start, end) & Context Confidence)
        Schema::create('monitoring_intervals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('tracker_device_id')->nullable()->constrained('tracker_devices')->nullOnDelete();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->string('signal_state', 30)->default('active_signal'); // active_signal, idle_signal, explicit_break, unknown, not_collected
            $table->string('app_category', 50)->nullable();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('work_session_id')->nullable()->constrained('work_sessions')->nullOnDelete();
            $table->foreignId('attendance_record_id')->nullable()->constrained('attendance_records')->nullOnDelete();
            $table->string('context_confidence', 40)->default('unknown'); // well_contextualized, partially_contextualized, needs_review, unknown
            $table->string('quality_state', 30)->default('complete'); // complete, partial, conflicted
            $table->unsignedInteger('derivation_version')->default(1);
            $table->json('source_summary')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'start_time', 'end_time'], 'mon_intv_co_mem_time_idx');
        });

        // 6. Device Heartbeats and Health
        Schema::create('monitoring_device_heartbeats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('tracker_device_id')->constrained('tracker_devices')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->dateTime('received_at');
            $table->string('app_version', 50);
            $table->string('os_version', 100)->nullable();
            $table->unsignedInteger('pending_sync_count')->default(0);
            $table->string('last_sync_status', 50)->default('ok');
            $table->boolean('is_online')->default(true);
            $table->timestamps();

            $table->index(['tracker_device_id', 'received_at'], 'mon_hb_dev_rec_idx');
        });

        // 7. Context Annotations (Employee context correction without rewriting raw signals)
        Schema::create('monitoring_context_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('monitoring_interval_id')->nullable()->constrained('monitoring_intervals')->nullOnDelete();
            $table->date('annotation_date');
            $table->dateTime('start_time')->nullable();
            $table->dateTime('end_time')->nullable();
            $table->string('annotation_type', 50); // offline_work, call_meeting, reading_research, context_correction
            $table->text('explanation');
            $table->foreignId('suggested_project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('suggested_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'annotation_date'], 'mon_ann_co_mem_date_idx');
        });

        // 8. Monitoring Disputes (Employee flags discrepancy for manager review)
        Schema::create('monitoring_disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('monitoring_interval_id')->nullable()->constrained('monitoring_intervals')->nullOnDelete();
            $table->text('dispute_reason');
            $table->string('status', 30)->default('pending'); // pending, under_review, approved, rejected
            $table->foreignId('reviewed_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->text('reviewer_comment')->nullable();
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'status'], 'mon_disp_co_mem_stat_idx');
        });

        // 9. Work Context Engine Reconciliation Cases (Detect discrepancies across M06/M07/M08)
        Schema::create('monitoring_reconciliation_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->date('case_date');
            $table->string('case_type', 50); // m06_overlap_mismatch, m07_clock_gap, unassociated_activity, long_idle_interval
            $table->string('severity', 30)->default('info'); // info, warning, review_required
            $table->foreignId('m06_session_id')->nullable()->constrained('work_sessions')->nullOnDelete();
            $table->foreignId('m07_attendance_id')->nullable()->constrained('attendance_records')->nullOnDelete();
            $table->foreignId('interval_id')->nullable()->constrained('monitoring_intervals')->nullOnDelete();
            $table->string('title', 255);
            $table->text('explanation');
            $table->string('status', 30)->default('unresolved'); // unresolved, reviewed, resolved
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'membership_id', 'case_date'], 'mon_rec_co_mem_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_reconciliation_cases');
        Schema::dropIfExists('monitoring_disputes');
        Schema::dropIfExists('monitoring_context_annotations');
        Schema::dropIfExists('monitoring_device_heartbeats');
        Schema::dropIfExists('monitoring_intervals');
        Schema::dropIfExists('monitoring_events');
        Schema::dropIfExists('monitoring_policy_acknowledgments');
        Schema::dropIfExists('monitoring_policy_assignments');
        Schema::dropIfExists('monitoring_policies');
    }
};

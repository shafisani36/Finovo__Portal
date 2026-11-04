<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M05 (Recruitment & ATS) and M06 (Lifecycle & DAG Execution Engine).
     */
    public function up(): void
    {
        // =========================================================================
        // M05: RECRUITMENT & APPLICANT TRACKING
        // =========================================================================

        // 1. Job Requisitions
        if (!Schema::hasTable('job_requisitions')) {
            Schema::create('job_requisitions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->foreignId('job_position_id')->nullable()->constrained('job_positions')->nullOnDelete();
                $table->string('requisition_number', 50);
                $table->string('title', 150);
                $table->unsignedInteger('headcount')->default(1);
                $table->string('employment_type', 40)->default('full_time');
                $table->decimal('min_salary', 15, 2)->nullable();
                $table->decimal('max_salary', 15, 2)->nullable();
                $table->string('currency', 3)->default('USD');
                $table->string('status', 30)->default('draft'); // draft, submitted, approved, rejected, open, filled, cancelled
                $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('approved_at')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->text('job_description')->nullable();
                $table->text('requirements')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'requisition_number'], 'req_comp_num_uniq');
                $table->index(['company_id', 'status'], 'req_comp_stat_idx');
            });
        }

        // 2. Candidates
        if (!Schema::hasTable('candidates')) {
            Schema::create('candidates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('first_name', 100);
                $table->string('last_name', 100);
                $table->string('email', 150);
                $table->string('phone', 30)->nullable();
                $table->string('resume_url', 255)->nullable();
                $table->string('portfolio_url', 255)->nullable();
                $table->string('source', 50)->default('career_site');
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'email'], 'cand_comp_email_idx');
            });
        }

        // 3. Candidate Applications
        if (!Schema::hasTable('candidate_applications')) {
            Schema::create('candidate_applications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
                $table->foreignId('job_requisition_id')->constrained('job_requisitions')->cascadeOnDelete();
                $table->string('current_stage', 40)->default('applied'); // applied, screening, interviewing, offer_extended, offer_accepted, offer_declined, hired, rejected, withdrawn
                $table->text('stage_notes')->nullable();
                $table->string('rejection_reason', 255)->nullable();
                $table->foreignId('converted_employment_record_id')->nullable()->constrained('employment_records')->nullOnDelete();
                $table->dateTime('converted_at')->nullable();
                $table->timestamps();

                $table->unique(['candidate_id', 'job_requisition_id'], 'cand_app_uniq');
                $table->index(['company_id', 'current_stage'], 'cand_app_stat_idx');
            });
        }

        // 4. Interview Scorecards
        if (!Schema::hasTable('interview_scorecards')) {
            Schema::create('interview_scorecards', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('candidate_application_id')->constrained('candidate_applications')->cascadeOnDelete();
                $table->foreignId('interviewer_membership_id')->constrained('company_memberships')->cascadeOnDelete();
                $table->string('interview_stage', 60);
                $table->string('overall_recommendation', 30); // strong_yes, yes, neutral, no, strong_no
                $table->json('criteria_scores');
                $table->text('summary_notes')->nullable();
                $table->dateTime('submitted_at');
                $table->timestamps();

                $table->index(['company_id', 'candidate_application_id'], 'sc_comp_app_idx');
            });
        }

        // 5. Candidate Offers
        if (!Schema::hasTable('candidate_offers')) {
            Schema::create('candidate_offers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('candidate_application_id')->constrained('candidate_applications')->cascadeOnDelete();
                $table->decimal('base_salary', 15, 2);
                $table->string('currency', 3)->default('USD');
                $table->decimal('bonus_percentage', 5, 2)->nullable();
                $table->unsignedInteger('equity_units')->nullable();
                $table->date('proposed_start_date');
                $table->date('expiration_date')->nullable();
                $table->string('status', 30)->default('draft'); // draft, pending_approval, approved, sent, accepted, declined, rescinded
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('approved_at')->nullable();
                $table->dateTime('accepted_at')->nullable();
                $table->string('offer_document_url', 255)->nullable();
                $table->json('terms_snapshot')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'candidate_application_id'], 'co_comp_app_idx');
            });
        }

        // =========================================================================
        // M06: LIFECYCLE MANAGEMENT (DAG WORKFLOW ENGINE)
        // =========================================================================

        // 6. Lifecycle Instances
        if (!Schema::hasTable('lifecycle_instances')) {
            Schema::create('lifecycle_instances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('type', 30); // onboarding, offboarding, transfer, promotion
                $table->string('status', 30)->default('in_progress'); // pending, in_progress, completed, cancelled
                $table->date('target_date');
                $table->dateTime('completed_at')->nullable();
                $table->foreignId('initiated_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id', 'type'], 'lci_comp_emp_type_idx');
            });
        }

        // 7. Lifecycle Tasks (DAG execution node with explicit prerequisite constraints)
        if (!Schema::hasTable('lifecycle_tasks')) {
            Schema::create('lifecycle_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('lifecycle_instance_id')->constrained('lifecycle_instances')->cascadeOnDelete();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('task_key', 80);
                $table->string('title', 150);
                $table->text('description')->nullable();
                $table->string('assigned_role_slug', 60)->nullable();
                $table->foreignId('assigned_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
                $table->string('status', 30)->default('ready'); // blocked, ready, in_progress, completed, skipped
                $table->json('prerequisite_task_keys')->nullable(); // JSON array of prerequisite task_keys
                $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('completed_at')->nullable();
                $table->date('due_date')->nullable();
                $table->text('execution_notes')->nullable();
                $table->timestamps();

                $table->index(['lifecycle_instance_id', 'status'], 'lct_inst_stat_idx');
                $table->unique(['lifecycle_instance_id', 'task_key'], 'lct_inst_key_uniq');
            });
        }

        // 8. Employee Asset Allocations
        if (!Schema::hasTable('employee_asset_allocations')) {
            Schema::create('employee_asset_allocations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('asset_name', 150);
                $table->string('asset_tag', 60)->nullable();
                $table->string('serial_number', 100)->nullable();
                $table->string('category', 40)->default('hardware'); // hardware, peripheral, security_key, mobile, badge
                $table->dateTime('allocated_at');
                $table->dateTime('returned_at')->nullable();
                $table->string('status', 30)->default('allocated'); // allocated, returned, lost, damaged
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id', 'status'], 'asset_comp_emp_stat_idx');
            });
        }

        // 9. Access Revocation Requests
        if (!Schema::hasTable('access_revocation_requests')) {
            Schema::create('access_revocation_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('lifecycle_instance_id')->nullable()->constrained('lifecycle_instances')->nullOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('system_identifier', 100);
                $table->string('revocation_type', 40)->default('standard'); // immediate_kill_switch, scheduled_at_exit, soft_deprovision
                $table->string('status', 30)->default('pending'); // pending, completed, failed
                $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('executed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('executed_at')->nullable();
                $table->json('audit_log')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status'], 'arr_comp_stat_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_revocation_requests');
        Schema::dropIfExists('employee_asset_allocations');
        Schema::dropIfExists('lifecycle_tasks');
        Schema::dropIfExists('lifecycle_instances');
        Schema::dropIfExists('candidate_offers');
        Schema::dropIfExists('interview_scorecards');
        Schema::dropIfExists('candidate_applications');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('job_requisitions');
    }
};

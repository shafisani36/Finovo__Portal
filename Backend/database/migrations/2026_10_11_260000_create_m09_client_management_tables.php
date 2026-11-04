<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('client_files');
        Schema::dropIfExists('client_onboarding_runs');
        Schema::dropIfExists('client_contracts');
        Schema::dropIfExists('client_requests');
        Schema::dropIfExists('client_decisions');
        Schema::dropIfExists('client_deliverable_reviews');
        Schema::dropIfExists('client_project_engagements');
        Schema::dropIfExists('client_invitations');
        Schema::dropIfExists('client_memberships');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('client_organizations');

        // 1. Client Organizations
        Schema::create('client_organizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('reference_code', 50);
            $table->string('name', 150);
            $table->string('status', 30)->default('active'); // active, prospect, onboarding, on_hold, archived
            $table->string('industry', 100)->nullable();
            $table->text('business_description')->nullable();
            $table->text('billing_address')->nullable();
            $table->string('country', 100)->nullable();
            $table->string('timezone', 50)->default('UTC');
            $table->foreignId('account_manager_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->boolean('portal_enabled')->default(true);
            $table->string('portal_domain', 150)->nullable();
            $table->json('custom_fields')->nullable();
            $table->string('health_status', 30)->default('healthy'); // healthy, attention_required, critical
            $table->dateTime('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'reference_code'], 'clt_org_co_ref_uniq');
            $table->index(['company_id', 'status'], 'clt_org_co_stat_idx');
        });

        // 2. Client Contacts
        Schema::create('client_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('email', 150);
            $table->string('phone', 50)->nullable();
            $table->string('job_title', 100)->nullable();
            $table->string('department', 100)->nullable();
            $table->string('contact_role', 50)->default('primary'); // primary, billing, technical, decision_maker, reviewer, stakeholder
            $table->boolean('is_primary')->default(false);
            $table->string('status', 30)->default('active'); // active, inactive, invited
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'client_organization_id', 'status'], 'clt_cnt_co_org_stat_idx');
        });

        // 3. Client Portal Memberships (Maps M01 User to Client Organization)
        Schema::create('client_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('portal_role', 50)->default('viewer'); // admin, reviewer, billing, viewer
            $table->string('status', 30)->default('active'); // active, suspended, revoked
            $table->json('permissions')->nullable();
            $table->foreignId('invited_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->dateTime('last_active_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'client_organization_id', 'user_id'], 'clt_mem_co_org_usr_uniq');
        });

        // 4. Client Invitations
        Schema::create('client_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('client_contacts')->nullOnDelete();
            $table->string('email', 150);
            $table->string('token_hash', 64);
            $table->string('portal_role', 50)->default('reviewer');
            $table->string('status', 30)->default('pending'); // pending, accepted, expired, revoked
            $table->dateTime('expires_at');
            $table->foreignId('invited_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->dateTime('accepted_at')->nullable();
            $table->foreignId('accepted_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('token_hash', 'clt_inv_tok_idx');
            $table->index(['company_id', 'status'], 'clt_inv_co_stat_idx');
        });

        // 5. Client Project Engagements
        Schema::create('client_project_engagements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('client_project_name', 150)->nullable();
            $table->string('client_visible_status', 50)->default('in_progress'); // planned, in_progress, awaiting_review, completed, on_hold
            $table->string('visibility_mode', 30)->default('standard'); // minimal, standard, full_transparency
            $table->boolean('show_milestones')->default(true);
            $table->boolean('show_deliverables')->default(true);
            $table->boolean('show_financials')->default(false);
            $table->string('status', 30)->default('active');
            $table->timestamps();

            $table->unique(['client_organization_id', 'project_id'], 'clt_proj_eng_org_prj_uniq');
        });

        // 6. Deliverable Reviews (Version-Locked Deliverable Approval)
        Schema::create('client_deliverable_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('project_deliverable_id')->constrained('project_deliverables')->cascadeOnDelete();
            $table->string('version_label', 50)->default('v1.0');
            $table->string('version_hash', 64);
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->string('file_url', 255)->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->foreignId('submitted_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->dateTime('submitted_at');
            $table->dateTime('due_date')->nullable();
            $table->string('review_status', 30)->default('submitted'); // submitted, under_review, changes_requested, approved, rejected, superseded
            $table->foreignId('decision_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('decision_at')->nullable();
            $table->text('decision_comment')->nullable();
            $table->timestamps();

            $table->index(['client_organization_id', 'project_id', 'review_status'], 'clt_deliv_rev_org_prj_stat');
        });

        // 7. Client Decision Ledger
        Schema::create('client_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained('project_milestones')->nullOnDelete();
            $table->string('decision_code', 50);
            $table->string('title', 200);
            $table->text('context_description');
            $table->foreignId('requested_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->foreignId('assigned_contact_id')->nullable()->constrained('client_contacts')->nullOnDelete();
            $table->dateTime('due_date');
            $table->string('status', 30)->default('requested'); // draft, requested, answered, approved, rejected, closed
            $table->string('outcome_decision', 50)->nullable(); // approved, rejected, alternative_chosen
            $table->text('outcome_rationale')->nullable();
            $table->foreignId('responded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('responded_at')->nullable();
            $table->text('impact_summary')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'decision_code'], 'clt_dec_co_code_uniq');
            $table->index(['client_organization_id', 'status', 'due_date'], 'clt_dec_org_stat_due_idx');
        });

        // 8. Client Requests & Change Requests
        Schema::create('client_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('request_code', 50);
            $table->string('category', 50)->default('change_request'); // change_request, support_issue, feature_request, clarification
            $table->string('title', 200);
            $table->text('description');
            $table->string('priority', 30)->default('medium'); // low, medium, high, urgent
            $table->string('client_status', 30)->default('submitted'); // submitted, in_triage, accepted, in_progress, completed, declined
            $table->string('internal_status', 30)->default('new'); // new, triaged, converted_to_task, resolved, rejected
            $table->decimal('estimated_cost_hours', 8, 2)->nullable();
            $table->decimal('estimated_budget_amount', 12, 2)->nullable();
            $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('triaged_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'request_code'], 'clt_req_co_code_uniq');
            $table->index(['client_organization_id', 'project_id', 'client_status'], 'clt_req_org_prj_stat_idx');
        });

        // 9. Client Contracts & Agreements
        Schema::create('client_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->string('contract_code', 50);
            $table->string('title', 150);
            $table->string('contract_type', 50)->default('msa'); // msa, sow, sla, nda, retainer
            $table->string('status', 30)->default('active'); // draft, pending_signature, active, expiring_soon, expired, terminated
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('renewal_date')->nullable();
            $table->unsignedInteger('notice_days')->default(30);
            $table->decimal('contract_value', 14, 2)->nullable();
            $table->string('currency', 10)->default('USD');
            $table->string('document_url', 255)->nullable();
            $table->boolean('client_visible')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'contract_code'], 'clt_ctr_co_code_uniq');
            $table->index(['client_organization_id', 'status', 'end_date'], 'clt_ctr_org_stat_end_idx');
        });

        // 10. Client Onboarding Runs (Blueprint & Checklists)
        Schema::create('client_onboarding_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->string('template_name', 100)->default('Standard Software House Client Onboarding');
            $table->string('status', 30)->default('in_progress'); // in_progress, completed, stalled
            $table->unsignedInteger('completed_items_count')->default(0);
            $table->unsignedInteger('total_items_count')->default(5);
            $table->json('checklist_items')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();

            $table->index(['client_organization_id', 'status'], 'clt_onb_org_stat_idx');
        });

        // 11. Secure Client File Shares
        Schema::create('client_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_organization_id')->constrained('client_organizations')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('title', 150);
            $table->string('file_path', 255);
            $table->string('file_name', 150);
            $table->unsignedBigInteger('file_size_bytes')->default(0);
            $table->string('mime_type', 100)->default('application/octet-stream');
            $table->string('classification', 50)->default('client_shared'); // internal_only, client_shared, confidential
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamps();

            $table->index(['client_organization_id', 'classification'], 'clt_fl_org_class_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_files');
        Schema::dropIfExists('client_onboarding_runs');
        Schema::dropIfExists('client_contracts');
        Schema::dropIfExists('client_requests');
        Schema::dropIfExists('client_decisions');
        Schema::dropIfExists('client_deliverable_reviews');
        Schema::dropIfExists('client_project_engagements');
        Schema::dropIfExists('client_invitations');
        Schema::dropIfExists('client_memberships');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('client_organizations');
    }
};

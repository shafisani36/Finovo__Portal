<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M04 - Project Management Module.
     */
    public function up(): void
    {
        // 1. Projects Table
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('project_code', 50)->index();
            $table->string('name');
            $table->string('client_name')->nullable();
            $table->foreignId('manager_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->string('project_type', 50)->default('web_application'); // web_application, mobile_app, saas, maintenance, internal
            $table->string('priority', 30)->default('medium'); // low, medium, high, critical
            $table->string('status', 30)->default('draft')->index(); // draft, planning, active, on_hold, completed, closed, archived, cancelled
            $table->string('health_status', 30)->default('healthy')->index(); // healthy, at_risk, critical, unknown
            $table->string('billing_model', 50)->default('fixed_price'); // fixed_price, time_and_materials, internal
            $table->decimal('budget_amount', 12, 2)->nullable();
            $table->string('currency', 10)->default('USD');
            $table->text('description')->nullable();
            $table->text('scope_overview')->nullable();
            $table->date('start_date')->nullable();
            $table->date('target_end_date')->nullable();
            $table->date('actual_completion_date')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('closure_notes')->nullable();
            $table->decimal('progress_percent', 5, 2)->default(0.00);
            $table->integer('version')->default(1);
            $table->timestamps();

            $table->unique(['company_id', 'project_code']);
        });

        // 2. Project Members Table
        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('project_role', 50)->default('developer'); // project_manager, tech_lead, qa_lead, designer, developer, client_guest
            $table->integer('allocation_percent')->default(100);
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'membership_id']);
        });

        // 3. Project Milestones Table
        Schema::create('project_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('owner_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->string('status', 30)->default('planned')->index(); // planned, in_progress, review_ready, completed, blocked
            $table->decimal('weight', 5, 2)->default(1.0);
            $table->date('baseline_due_date')->nullable();
            $table->date('forecast_due_date')->nullable();
            $table->timestamp('actual_completed_at')->nullable();
            $table->text('acceptance_criteria')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 4. Milestone Dependencies Table (DAG enforcement)
        Schema::create('project_milestone_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('predecessor_milestone_id')->constrained('project_milestones')->cascadeOnDelete();
            $table->foreignId('successor_milestone_id')->constrained('project_milestones')->cascadeOnDelete();
            $table->string('dependency_type', 30)->default('finish_to_start');
            $table->timestamps();

            $table->unique(['predecessor_milestone_id', 'successor_milestone_id'], 'milestone_dep_unique');
        });

        // 5. Deliverables Table
        Schema::create('project_deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained('project_milestones')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('acceptance_status', 30)->default('pending'); // pending, submitted, accepted, rejected
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamps();
        });

        // 6. Scope Baselines & Revisions Table (Immutable history)
        Schema::create('project_scope_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->integer('revision_number')->default(1);
            $table->text('business_objective')->nullable();
            $table->text('in_scope')->nullable();
            $table->text('out_of_scope')->nullable();
            $table->text('assumptions')->nullable();
            $table->text('constraints')->nullable();
            $table->string('status', 30)->default('approved'); // draft, proposed, approved, superseded
            $table->foreignId('approved_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('change_summary')->nullable();
            $table->timestamps();
        });

        // 7. Project Change Requests Table
        Schema::create('project_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('request_type', 50); // scope_change, schedule_change, budget_change
            $table->string('title');
            $table->text('reason');
            $table->text('impact_summary')->nullable();
            $table->json('proposed_payload');
            $table->string('status', 30)->default('submitted')->index(); // submitted, approved, rejected, withdrawn
            $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();
        });

        // 8. Project Risks, Issues & Blockers Table
        Schema::create('project_risks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('type', 30)->default('risk')->index(); // risk, issue, blocker, dependency
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('severity', 30)->default('medium'); // low, medium, high, critical
            $table->string('probability', 30)->default('medium'); // low, medium, high
            $table->string('status', 30)->default('open')->index(); // open, in_progress, mitigated, resolved, closed
            $table->foreignId('owner_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->text('mitigation_plan')->nullable();
            $table->date('target_resolution_date')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        // 9. Project Decisions Register Table
        Schema::create('project_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('title');
            $table->text('decision');
            $table->text('rationale')->nullable();
            $table->foreignId('decided_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->date('decided_at');
            $table->timestamps();
        });

        // 10. Project Documents Table
        Schema::create('project_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('document_name');
            $table->string('document_type', 50)->default('specification'); // specification, architecture, contract, meeting_notes, deliverable_evidence
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('visibility', 30)->default('internal'); // internal, team_only, client_visible
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_documents');
        Schema::dropIfExists('project_decisions');
        Schema::dropIfExists('project_risks');
        Schema::dropIfExists('project_change_requests');
        Schema::dropIfExists('project_scope_revisions');
        Schema::dropIfExists('project_deliverables');
        Schema::dropIfExists('project_milestone_dependencies');
        Schema::dropIfExists('project_milestones');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('projects');
    }
};

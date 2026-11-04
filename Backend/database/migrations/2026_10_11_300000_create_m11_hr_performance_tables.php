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
        // 1. Performance Review Cycles
        Schema::create('performance_review_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('title');
            $table->string('cycle_type')->default('annual'); // annual, quarterly, probation, project_end, checkin
            $table->text('description')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->date('self_review_deadline')->nullable();
            $table->date('manager_review_deadline')->nullable();
            $table->string('status')->default('draft'); // draft, active, review_closed, calibration, finalized, archived
            $table->foreignId('template_id')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 2. Review Templates
        Schema::create('review_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('title');
            $table->string('role_type')->default('general'); // engineering, general, management, sales
            $table->unsignedInteger('version')->default(1);
            $table->json('sections')->nullable(); // structured sections and questions
            $table->json('rating_scale')->nullable(); // 1-5 definitions, criteria
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_published']);
        });

        // 3. Performance Reviews (Instance per employee in a cycle)
        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('cycle_id')->constrained('performance_review_cycles')->cascadeOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('review_templates')->nullOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('employment_records')->nullOnDelete(); // manager
            $table->string('status')->default('scheduled'); 
            // scheduled, self_review, manager_review, calibration, ready_for_release, released, acknowledged, appeal_pending, amended, archived
            $table->unsignedInteger('version')->default(1);

            // Self-assessment
            $table->decimal('self_rating', 4, 2)->nullable();
            $table->text('self_summary')->nullable();
            $table->json('self_responses')->nullable();
            $table->timestamp('self_submitted_at')->nullable();

            // Manager assessment
            $table->decimal('manager_rating', 4, 2)->nullable();
            $table->text('manager_summary')->nullable();
            $table->json('manager_responses')->nullable();
            $table->timestamp('manager_submitted_at')->nullable();

            // Calibration & Final
            $table->decimal('final_rating', 4, 2)->nullable();
            $table->decimal('calibrated_rating', 4, 2)->nullable();
            $table->text('calibration_notes')->nullable();
            $table->foreignId('calibrated_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            // Quality Indicator & Guards
            $table->decimal('quality_score', 5, 2)->default(0.00); // 0 - 100%
            $table->json('quality_flags')->nullable();

            // Finalization & Acknowledgment
            $table->timestamp('released_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->text('employee_acknowledgment_comment')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'cycle_id', 'employee_id'], 'perf_review_unique_cycle_emp');
            $table->index(['company_id', 'status']);
            $table->index(['employee_id', 'status']);
        });

        // 4. Evidence Links (Passport)
        Schema::create('review_evidence_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('review_id')->constrained('performance_reviews')->cascadeOnDelete();
            $table->string('evidence_type'); // task, project, training, feedback, client_deliverable
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('source_url')->nullable();
            $table->foreignId('linked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'review_id']);
        });

        // 5. Goals & OKRs
        Schema::create('employee_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('measurement_type')->default('percentage'); // numeric, percentage, milestone, qualitative, learning
            $table->decimal('baseline_value', 12, 2)->default(0);
            $table->decimal('target_value', 12, 2)->default(100);
            $table->decimal('current_value', 12, 2)->default(0);
            $table->string('unit')->nullable(); // %, points, defects, courses
            $table->date('due_date')->nullable();
            $table->string('status')->default('in_progress'); // proposed, in_progress, completed, cancelled, blocked
            $table->unsignedTinyInteger('weight')->default(10); // weight in review
            $table->json('milestones')->nullable();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'status']);
        });

        // 6. Competency Frameworks
        Schema::create('competency_frameworks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name'); // Frontend Engineering, Backend Architecture, Leadership
            $table->string('role_target')->nullable(); // Junior, Mid, Senior, Lead
            $table->unsignedInteger('version')->default(1);
            $table->json('competencies'); // [{ name: "System Design", min_level: 4, observable_behaviors: [...] }]
            $table->timestamps();

            $table->index(['company_id', 'name']);
        });

        // 7. Employee Competency Assessments (Skill-Gap Engine)
        Schema::create('employee_competency_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->foreignId('framework_id')->nullable()->constrained('competency_frameworks')->nullOnDelete();
            $table->string('competency_name');
            $table->unsignedTinyInteger('current_level')->default(1); // 1-5 scale
            $table->unsignedTinyInteger('target_level')->default(3);  // 1-5 scale
            $table->integer('gap_score')->default(0); // target - current (or 0 if current >= target)
            $table->text('evidence_notes')->nullable();
            $table->foreignId('assessed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'employee_id']);
        });

        // 8. Employee Development Plans & Mentorship
        Schema::create('employee_development_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('title');
            $table->string('target_competency')->nullable();
            $table->text('learning_action');
            $table->foreignId('mentor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->string('status')->default('active'); // active, completed, on_hold
            $table->text('outcome_reflection')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'status']);
        });

        // 9. Structured Feedback & Recognition
        Schema::create('employee_feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->foreignId('author_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('feedback_type')->default('recognition'); // recognition, constructive, peer, coaching
            $table->text('content');
            $table->string('visibility')->default('public'); // public, private_manager, confidential_hr
            $table->string('badge')->nullable(); // Star, Innovator, TeamPlayer, ProblemSolver
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'visibility']);
        });

        // 10. Onboarding & Offboarding Checklists
        Schema::create('onboarding_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('template_name'); // Software Developer Onboarding, Offboarding Protocol
            $table->string('type')->default('onboarding'); // onboarding, offboarding
            $table->json('items'); // [{ id: 1, title: "Env Setup", completed: true, owner_role: "IT", completed_at: null }]
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->string('status')->default('in_progress'); // in_progress, completed
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'status']);
        });

        // 11. Performance Appeals
        Schema::create('performance_appeals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('review_id')->constrained('performance_reviews')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employment_records')->cascadeOnDelete();
            $table->text('reason');
            $table->string('status')->default('pending'); // pending, under_investigation, upheld, rejected
            $table->text('reviewer_notes')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'review_id']);
        });

        // 12. HR Audit Events
        Schema::create('hr_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // review_cycle_created, review_finalized, appeal_submitted, calibration_override
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
        Schema::dropIfExists('hr_audit_events');
        Schema::dropIfExists('performance_appeals');
        Schema::dropIfExists('onboarding_checklists');
        Schema::dropIfExists('employee_feedbacks');
        Schema::dropIfExists('employee_development_plans');
        Schema::dropIfExists('employee_competency_assessments');
        Schema::dropIfExists('competency_frameworks');
        Schema::dropIfExists('employee_goals');
        Schema::dropIfExists('review_evidence_links');
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('review_templates');
        Schema::dropIfExists('performance_review_cycles');
    }
};

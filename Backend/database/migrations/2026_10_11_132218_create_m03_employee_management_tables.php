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
        // 1. Designations (Formal job titles, levels, and expectations)
        Schema::create('designations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 50)->nullable();
            $table->string('level', 50)->nullable(); // e.g. L1, L2, L3, Senior, Lead, Director
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        // 2. Teams (Collaboration groups within company / departments)
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('name');
            $table->string('code', 50)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('team_lead_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        // 3. Employment Records (Core employment entity connecting membership to company employment lifecycle)
        Schema::create('employment_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('membership_id')->unique()->constrained('company_memberships')->cascadeOnDelete();
            $table->string('employee_number', 50);
            $table->string('employment_type', 30)->default('permanent')->index(); // permanent, fixed_term, contractor, intern, part_time
            $table->string('status', 30)->default('active')->index(); // invited, onboarding, active, on_leave, suspended, offboarding, former_employee
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('designation_id')->nullable()->constrained('designations')->nullOnDelete();
            $table->foreignId('manager_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->date('hire_date')->nullable();
            $table->date('probation_end_date')->nullable();
            $table->date('confirmation_date')->nullable();
            $table->date('contract_end_date')->nullable();
            $table->date('termination_date')->nullable();
            $table->text('termination_reason')->nullable();
            $table->string('work_location', 50)->default('Remote'); // Remote, Hybrid, Onsite
            $table->timestamps();

            $table->unique(['company_id', 'employee_number']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'department_id']);
        });

        // 4. Team Memberships (Multi-team assignments with duration and role)
        Schema::create('team_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('team_id')->constrained('teams')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('membership_type', 30)->default('member'); // lead, member, contributor
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'employment_record_id']);
        });

        // 5. Employment History (Immutable historical changelog for audit and effective-dated reporting)
        Schema::create('employment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('change_type', 50)->index(); // hire, designation_change, department_transfer, manager_change, status_change, promotion, offboarding
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('reason')->nullable();
            $table->date('effective_at')->nullable();
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 6. Onboarding Templates
        Schema::create('onboarding_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('version')->default(1);
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        // 7. Onboarding Template Tasks
        Schema::create('onboarding_template_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('onboarding_templates')->cascadeOnDelete();
            $table->string('task_key', 50);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('assigned_role', 50)->default('employee');
            $table->boolean('is_required')->default(true);
            $table->integer('due_days_after_hire')->default(3);
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 8. Employee Onboarding Tasks (Instance execution per employee)
        Schema::create('employee_onboarding_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 30)->default('pending')->index(); // pending, in_progress, completed, blocked
            $table->boolean('is_required')->default(true);
            $table->date('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 9. Employee Change Requests (Workflow approvals for promotions, transfers, manager changes)
        Schema::create('employee_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('request_type', 50)->index(); // designation_change, department_transfer, manager_change, status_change
            $table->json('proposed_payload');
            $table->text('reason')->nullable();
            $table->date('effective_date')->nullable();
            $table->string('status', 30)->default('submitted')->index(); // submitted, approved, rejected, withdrawn
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();
        });

        // 10. Employee Documents (Protected contracts, certificates, and government documents)
        Schema::create('employee_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('document_name');
            $table->string('document_type', 50)->default('contract'); // contract, certificate, id_proof, tax_form, policy_ack
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->string('visibility', 30)->default('restricted'); // restricted, employee_and_hr, hr_only
            $table->date('expires_at')->nullable();
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 11. Employee Skills (Skills matrix, proficiency levels, and verification)
        Schema::create('employee_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
            $table->string('skill_name');
            $table->string('proficiency_level', 30)->default('intermediate'); // beginner, intermediate, advanced, expert
            $table->decimal('years_of_experience', 4, 1)->nullable();
            $table->boolean('verified')->default(false);
            $table->timestamps();

            $table->unique(['employment_record_id', 'skill_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_skills');
        Schema::dropIfExists('employee_documents');
        Schema::dropIfExists('employee_change_requests');
        Schema::dropIfExists('employee_onboarding_tasks');
        Schema::dropIfExists('onboarding_template_tasks');
        Schema::dropIfExists('onboarding_templates');
        Schema::dropIfExists('employment_history');
        Schema::dropIfExists('team_memberships');
        Schema::dropIfExists('employment_records');
        Schema::dropIfExists('teams');
        Schema::dropIfExists('designations');
    }
};

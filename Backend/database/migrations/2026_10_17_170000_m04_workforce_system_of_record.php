<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M04: Employee & Workforce System of Record.
     */
    public function up(): void
    {
        // 1. Employee Personal Details (Restricted PII with field-level authorization)
        if (!Schema::hasTable('employee_personal_details')) {
            Schema::create('employee_personal_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employment_record_id')->unique()->constrained('employment_records')->cascadeOnDelete();
                $table->date('date_of_birth')->nullable();
                $table->string('gender', 20)->nullable();
                $table->string('marital_status', 30)->nullable();
                $table->string('national_id_number', 50)->nullable()->index();
                $table->string('personal_email', 150)->nullable();
                $table->string('personal_phone', 30)->nullable();
                $table->string('emergency_contact_name', 120)->nullable();
                $table->string('emergency_contact_relationship', 50)->nullable();
                $table->string('emergency_contact_phone', 30)->nullable();
                $table->text('residential_address')->nullable();
                $table->timestamps();
            });
        }

        // 2. Job Assignments (Effective-dated multi-assignment support with half-open intervals)
        if (!Schema::hasTable('job_assignments')) {
            Schema::create('job_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->foreignId('job_position_id')->nullable()->constrained('job_positions')->nullOnDelete();
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->foreignId('location_id')->nullable()->constrained('organization_locations')->nullOnDelete();
                $table->foreignId('cost_center_id')->nullable()->constrained('cost_centers')->nullOnDelete();
                $table->unsignedBigInteger('manager_membership_id')->nullable()->index();
                $table->boolean('is_primary')->default(true);
                $table->decimal('fte_ratio', 3, 2)->default(1.00); // 1.00 = full-time, 0.50 = 50% allocation
                $table->dateTime('effective_from');
                $table->dateTime('effective_to')->nullable();
                $table->string('status', 30)->default('active'); // active, concluded, cancelled
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id', 'is_primary'], 'ja_comp_emp_prim_idx');
                $table->index(['effective_from', 'effective_to'], 'ja_dates_idx');
            });
        }

        // 3. Employment Contracts (Formal contracts, probation, signatures)
        if (!Schema::hasTable('employment_contracts')) {
            Schema::create('employment_contracts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('contract_number', 50)->nullable();
                $table->string('contract_type', 40)->default('permanent'); // permanent, fixed_term, contractor, intern, probation
                $table->date('start_date');
                $table->date('end_date')->nullable();
                $table->string('signature_status', 30)->default('draft'); // draft, sent_for_signature, signed, expired, terminated
                $table->string('document_url')->nullable();
                $table->json('terms_snapshot')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id'], 'ec_comp_emp_idx');
            });
        }

        // 4. Employee Certifications & Accreditations
        if (!Schema::hasTable('employee_certifications')) {
            Schema::create('employee_certifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('employment_record_id')->constrained('employment_records')->cascadeOnDelete();
                $table->string('name', 150);
                $table->string('issuing_organization', 150);
                $table->string('credential_id', 100)->nullable();
                $table->string('credential_url')->nullable();
                $table->date('issue_date');
                $table->date('expiry_date')->nullable();
                $table->string('verification_status', 30)->default('pending'); // pending, verified, rejected, expired
                $table->foreignId('verified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['company_id', 'employment_record_id'], 'cert_comp_emp_idx');
            });
        }

        // 5. Employee Bulk Import Jobs (Resumable batch processing with row outcome logs)
        if (!Schema::hasTable('employee_import_jobs')) {
            Schema::create('employee_import_jobs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('file_name', 255);
                $table->string('status', 30)->default('pending'); // pending, validating, processing, completed, failed
                $table->unsignedInteger('total_rows')->default(0);
                $table->unsignedInteger('processed_rows')->default(0);
                $table->unsignedInteger('successful_rows')->default(0);
                $table->unsignedInteger('failed_rows')->default(0);
                $table->json('error_report')->nullable();
                $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->dateTime('completed_at')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status'], 'eij_comp_stat_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_import_jobs');
        Schema::dropIfExists('employee_certifications');
        Schema::dropIfExists('employment_contracts');
        Schema::dropIfExists('job_assignments');
        Schema::dropIfExists('employee_personal_details');
    }
};

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
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 50)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('manager_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->foreignId('parent_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        Schema::create('department_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['department_id', 'membership_id']);
        });

        Schema::create('employee_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('membership_id')->unique()->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('designation')->nullable();
            $table->string('phone_number', 50)->nullable();
            $table->string('employee_id_number', 50)->nullable();
            $table->date('joining_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained('companies')->cascadeOnDelete();
            $table->json('working_days')->nullable();
            $table->string('fiscal_year_start', 10)->default('01-01');
            $table->boolean('allow_employee_invites')->default(false);
            $table->boolean('enforce_mfa')->default(false);
            $table->integer('session_timeout_minutes')->default(1440);
            $table->string('date_format', 20)->default('YYYY-MM-DD');
            $table->string('time_format', 10)->default('12h');
            $table->json('preferences')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
        Schema::dropIfExists('employee_profiles');
        Schema::dropIfExists('department_memberships');
        Schema::dropIfExists('departments');
    }
};

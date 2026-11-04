<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M02: Department & Organizational Structure Topology.
     */
    public function up(): void
    {
        // 1. Organization Locations (Sites, offices, remote hubs)
        if (!Schema::hasTable('organization_locations')) {
            Schema::create('organization_locations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('name', 100);
                $table->string('code', 30);
                $table->string('timezone', 50)->default('UTC');
                $table->string('country', 100)->nullable();
                $table->string('city', 100)->nullable();
                $table->string('address', 255)->nullable();
                $table->boolean('is_remote')->default(false);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['company_id', 'code']);
            });
        }

        // 2. Cost Centers (Financial accounting allocations)
        if (!Schema::hasTable('cost_centers')) {
            Schema::create('cost_centers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('code', 40);
                $table->string('name', 120);
                $table->unsignedBigInteger('department_id')->nullable()->index();
                $table->string('currency', 3)->default('USD');
                $table->decimal('annual_budget', 15, 2)->default(0.00);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['company_id', 'code']);
            });
        }

        // 3. Enhance departments with cost center and effective dates
        if (Schema::hasTable('departments')) {
            Schema::table('departments', function (Blueprint $table) {
                if (!Schema::hasColumn('departments', 'cost_center_id')) {
                    $table->unsignedBigInteger('cost_center_id')->nullable()->after('parent_department_id')->index();
                }
                if (!Schema::hasColumn('departments', 'effective_from')) {
                    $table->dateTime('effective_from')->nullable()->after('status');
                }
                if (!Schema::hasColumn('departments', 'effective_to')) {
                    $table->dateTime('effective_to')->nullable()->after('effective_from');
                }
            });
        }

        // 4. Job Positions (Separated from security roles and people)
        if (!Schema::hasTable('job_positions')) {
            Schema::create('job_positions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('title', 120);
                $table->string('code', 40);
                $table->string('level', 30)->nullable(); // Junior, Mid, Senior, Lead, Executive
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->foreignId('location_id')->nullable()->constrained('organization_locations')->nullOnDelete();
                $table->foreignId('cost_center_id')->nullable()->constrained('cost_centers')->nullOnDelete();
                $table->unsignedInteger('headcount_allowance')->default(1);
                $table->string('status', 30)->default('active'); // active, frozen, closed
                $table->timestamps();

                $table->unique(['company_id', 'code']);
            });
        }

        // 5. Reporting Relationships (Hierarchical reporting graph with half-open intervals)
        if (!Schema::hasTable('reporting_relationships')) {
            Schema::create('reporting_relationships', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->unsignedBigInteger('employee_id')->index();
                $table->unsignedBigInteger('manager_id')->index();
                $table->string('relationship_type', 30)->default('primary'); // primary, secondary, project
                $table->dateTime('effective_from')->nullable();
                $table->dateTime('effective_to')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'employee_id', 'relationship_type'], 'rep_rel_emp_type_idx');
                $table->index(['company_id', 'manager_id'], 'rep_rel_mgr_idx');
            });
        }

        // 6. Organization Structure Versions (Audit and simulation snapshots)
        if (!Schema::hasTable('organization_structure_versions')) {
            Schema::create('organization_structure_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->unsignedInteger('version_number')->default(1);
                $table->json('snapshot');
                $table->foreignId('published_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->dateTime('published_at')->useCurrent();
                $table->timestamps();

                $table->unique(['company_id', 'version_number']);
            });
        }

        // 7. Organizational Change Requests (Reorganizations, transfers, mergers)
        if (!Schema::hasTable('organizational_change_requests')) {
            Schema::create('organizational_change_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('title', 150);
                $table->string('request_type', 40)->default('reorganization'); // reorganization, transfer, merger, closure
                $table->json('details');
                $table->string('status', 30)->default('draft'); // draft, pending_approval, approved, applied, rejected
                $table->dateTime('effective_date');
                $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('approved_at')->nullable();
                $table->dateTime('applied_at')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status', 'effective_date'], 'ocr_comp_stat_eff_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organizational_change_requests');
        Schema::dropIfExists('organization_structure_versions');
        Schema::dropIfExists('reporting_relationships');
        Schema::dropIfExists('job_positions');

        if (Schema::hasTable('departments')) {
            Schema::table('departments', function (Blueprint $table) {
                if (Schema::hasColumn('departments', 'cost_center_id')) {
                    $table->dropColumn(['cost_center_id', 'effective_from', 'effective_to']);
                }
            });
        }

        Schema::dropIfExists('cost_centers');
        Schema::dropIfExists('organization_locations');
    }
};

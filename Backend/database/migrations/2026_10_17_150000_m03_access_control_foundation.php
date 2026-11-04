<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M03: Roles, Permissions & Access Control Foundation.
     */
    public function up(): void
    {
        // 1. Enhance membership_roles with resource scoping and temporal assignment
        if (Schema::hasTable('membership_roles')) {
            Schema::table('membership_roles', function (Blueprint $table) {
                if (!Schema::hasColumn('membership_roles', 'scope_type')) {
                    $table->string('scope_type', 30)->default('organization')->after('role_id')->index();
                }
                if (!Schema::hasColumn('membership_roles', 'scope_id')) {
                    $table->unsignedBigInteger('scope_id')->nullable()->after('scope_type')->index();
                }
                if (!Schema::hasColumn('membership_roles', 'assigned_by_user_id')) {
                    $table->foreignId('assigned_by_user_id')->nullable()->after('scope_id')->constrained('users')->nullOnDelete();
                }
                if (!Schema::hasColumn('membership_roles', 'effective_from')) {
                    $table->timestamp('effective_from')->nullable()->after('assigned_by_user_id');
                }
                if (!Schema::hasColumn('membership_roles', 'effective_to')) {
                    $table->timestamp('effective_to')->nullable()->after('effective_from');
                }
            });
        }

        // 2. Enhance role_permissions with resource scoping
        if (Schema::hasTable('role_permissions')) {
            Schema::table('role_permissions', function (Blueprint $table) {
                if (!Schema::hasColumn('role_permissions', 'scope_type')) {
                    $table->string('scope_type', 30)->default('organization')->after('permission_id');
                }
                if (!Schema::hasColumn('role_permissions', 'scope_id')) {
                    $table->unsignedBigInteger('scope_id')->nullable()->after('scope_type');
                }
            });
        }

        // 3. Create temporary_access_grants table
        if (!Schema::hasTable('temporary_access_grants')) {
            Schema::create('temporary_access_grants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
                $table->foreignId('role_id')->nullable()->constrained('roles')->cascadeOnDelete();
                $table->string('permission_key', 100)->nullable()->index();
                $table->string('scope_type', 30)->default('organization');
                $table->unsignedBigInteger('scope_id')->nullable();
                $table->text('reason');
                $table->foreignId('granted_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->dateTime('granted_at')->useCurrent();
                $table->dateTime('expires_at')->index();
                $table->dateTime('revoked_at')->nullable()->index();
                $table->text('revocation_reason')->nullable();
                $table->foreignId('revoked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['company_id', 'membership_id', 'expires_at'], 'tag_comp_mem_exp_idx');
            });
        }

        // 4. Create policy_definitions table (Separation of duties, approval thresholds)
        if (!Schema::hasTable('policy_definitions')) {
            Schema::create('policy_definitions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->nullable()->constrained('companies')->cascadeOnDelete();
                $table->string('policy_code', 80)->unique();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('policy_type', 50)->default('separation_of_duties')->index();
                $table->json('definition');
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('version')->default(1);
                $table->timestamps();
            });
        }

        // 5. Seed standard Enterprise System Roles if not already present
        $standardRoles = [
            [
                'slug' => 'department-manager',
                'name' => 'Department Manager',
                'description' => 'Oversees departmental workforce, approves leave, shifts, and team timesheets.',
                'is_system' => true,
            ],
            [
                'slug' => 'recruiter',
                'name' => 'Recruitment Specialist',
                'description' => 'Manages candidate pipelines, job requisitions, scorecards, and offers.',
                'is_system' => true,
            ],
            [
                'slug' => 'payroll-officer',
                'name' => 'Payroll Officer',
                'description' => 'Calculates and prepares payroll batches, adjustments, and tax filings.',
                'is_system' => true,
            ],
            [
                'slug' => 'compliance-auditor',
                'name' => 'Compliance Auditor',
                'description' => 'Read-only access to audit logs, export records, and regulatory reports.',
                'is_system' => true,
            ],
        ];

        foreach ($standardRoles as $roleData) {
            if (!DB::table('roles')->whereNull('company_id')->where('slug', $roleData['slug'])->exists()) {
                DB::table('roles')->insert(array_merge($roleData, [
                    'company_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }

        // 6. Seed essential permissions for M01–M10 if missing
        $newPermissions = [
            // M01 & M03 Access Control
            ['key' => 'roles.view', 'name' => 'View Roles', 'description' => 'View workspace roles and permissions', 'module' => 'roles'],
            ['key' => 'roles.manage', 'name' => 'Manage Roles', 'description' => 'Create, edit, and assign workspace roles', 'module' => 'roles'],
            ['key' => 'access.grant', 'name' => 'Grant Elevated Access', 'description' => 'Issue temporary elevated access grants', 'module' => 'roles'],
            ['key' => 'access.revoke', 'name' => 'Revoke Elevated Access', 'description' => 'Revoke temporary elevated access grants', 'module' => 'roles'],
            ['key' => 'access.preview', 'name' => 'Preview Effective Access', 'description' => 'Simulate and inspect effective permission trees', 'module' => 'roles'],

            // M02 Topology
            ['key' => 'departments.view', 'name' => 'View Departments', 'description' => 'View department hierarchy and members', 'module' => 'company'],
            ['key' => 'departments.create', 'name' => 'Create Departments', 'description' => 'Create new departments and subdepartments', 'module' => 'company'],
            ['key' => 'departments.update', 'name' => 'Update Departments', 'description' => 'Edit department metadata and managers', 'module' => 'company'],
            ['key' => 'departments.reorganize', 'name' => 'Reorganize Structure', 'description' => 'Execute structural reorganization and tree movements', 'module' => 'company'],
            ['key' => 'org_chart.view', 'name' => 'View Org Chart', 'description' => 'View interactive organizational chart', 'module' => 'company'],

            // M05 Recruitment
            ['key' => 'recruitment.requisitions.view', 'name' => 'View Requisitions', 'description' => 'View job requisitions and budgets', 'module' => 'recruitment'],
            ['key' => 'recruitment.requisitions.manage', 'name' => 'Manage Requisitions', 'description' => 'Create and submit job requisitions', 'module' => 'recruitment'],
            ['key' => 'recruitment.requisitions.approve', 'name' => 'Approve Requisitions', 'description' => 'Approve headcount and salary requisitions', 'module' => 'recruitment'],
            ['key' => 'recruitment.candidates.view', 'name' => 'View Candidates', 'description' => 'View candidate applications and profiles', 'module' => 'recruitment'],
            ['key' => 'recruitment.candidates.manage', 'name' => 'Manage Candidates', 'description' => 'Move candidate stages and schedule interviews', 'module' => 'recruitment'],
            ['key' => 'recruitment.scorecards.submit', 'name' => 'Submit Scorecard', 'description' => 'Submit interview feedback and ratings', 'module' => 'recruitment'],
            ['key' => 'recruitment.offers.create', 'name' => 'Create Offers', 'description' => 'Draft and issue candidate offer letters', 'module' => 'recruitment'],
            ['key' => 'recruitment.offers.approve', 'name' => 'Approve Offers', 'description' => 'Approve candidate offer compensation terms', 'module' => 'recruitment'],
            ['key' => 'recruitment.convert', 'name' => 'Convert to Employee', 'description' => 'Convert hired candidate into employee record', 'module' => 'recruitment'],

            // M06 Lifecycle
            ['key' => 'lifecycle.onboarding.manage', 'name' => 'Manage Onboarding', 'description' => 'Create and manage onboarding instances', 'module' => 'lifecycle'],
            ['key' => 'lifecycle.offboarding.initiate', 'name' => 'Initiate Offboarding', 'description' => 'Trigger exit workflow and revocation', 'module' => 'lifecycle'],
            ['key' => 'lifecycle.revocation.execute', 'name' => 'Execute Access Revocation', 'description' => 'Emergency credential and account invalidation', 'module' => 'lifecycle'],
            ['key' => 'lifecycle.clearance.approve', 'name' => 'Approve Exit Clearance', 'description' => 'Sign off departmental exit clearances', 'module' => 'lifecycle'],

            // M09 Payroll
            ['key' => 'payroll.view', 'name' => 'View Payroll', 'description' => 'View payroll runs and employee compensation', 'module' => 'payroll'],
            ['key' => 'payroll.prepare', 'name' => 'Prepare Payroll Run', 'description' => 'Calculate gross, deductions, and batch runs', 'module' => 'payroll'],
            ['key' => 'payroll.approve', 'name' => 'Approve Payroll', 'description' => 'Approve calculated payroll run batches', 'module' => 'payroll'],
            ['key' => 'payroll.finalize', 'name' => 'Finalize Payroll', 'description' => 'Lock payroll runs and post to ledger', 'module' => 'payroll'],
            ['key' => 'payroll.reconcile', 'name' => 'Reconcile Payments', 'description' => 'Reconcile bank payouts and adjustments', 'module' => 'payroll'],
            ['key' => 'payslips.view_self', 'name' => 'View Own Payslip', 'description' => 'Employee self-service payslip access', 'module' => 'payroll'],
        ];

        foreach ($newPermissions as $perm) {
            if (!DB::table('permissions')->where('key', $perm['key'])->exists()) {
                DB::table('permissions')->insert(array_merge($perm, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }

        // 7. Seed baseline Separation of Duties Policy
        if (!DB::table('policy_definitions')->where('policy_code', 'SOD-PAYROLL-MAKER-CHECKER')->exists()) {
            DB::table('policy_definitions')->insert([
                'company_id' => null,
                'policy_code' => 'SOD-PAYROLL-MAKER-CHECKER',
                'name' => 'Payroll Segregation of Duties',
                'description' => 'Enforces that the user who calculates/prepares a payroll run cannot independently approve or finalize the same run.',
                'policy_type' => 'separation_of_duties',
                'definition' => json_encode([
                    'prohibited_combinations' => [
                        ['action_a' => 'payroll.prepare', 'action_b' => 'payroll.approve'],
                        ['action_a' => 'payroll.prepare', 'action_b' => 'payroll.finalize'],
                    ],
                    'scope' => 'resource_instance',
                ]),
                'is_active' => true,
                'version' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('policy_definitions');
        Schema::dropIfExists('temporary_access_grants');

        if (Schema::hasTable('role_permissions')) {
            Schema::table('role_permissions', function (Blueprint $table) {
                if (Schema::hasColumn('role_permissions', 'scope_type')) {
                    $table->dropColumn(['scope_type', 'scope_id']);
                }
            });
        }

        if (Schema::hasTable('membership_roles')) {
            Schema::table('membership_roles', function (Blueprint $table) {
                if (Schema::hasColumn('membership_roles', 'scope_type')) {
                    $table->dropForeign(['assigned_by_user_id']);
                    $table->dropColumn(['scope_type', 'scope_id', 'assigned_by_user_id', 'effective_from', 'effective_to']);
                }
            });
        }
    }
};

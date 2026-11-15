<?php

use App\Models\Company;
use App\Models\Role;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            // Seed all RBAC roles and permissions if not seeded
            $seeder = new RoleAndPermissionSeeder();
            $seeder->run();

            $ownerRole = Role::where('slug', 'company-owner')->first();
            $adminRole = Role::where('slug', 'company-admin')->first();

            if ($ownerRole && $adminRole) {
                // Attach owner and admin roles to all company creators / first memberships
                $companies = Company::with(['memberships.employeeProfile'])->get();

                foreach ($companies as $company) {
                    $creatorMembership = $company->memberships
                        ->first(fn ($m) => $m->employeeProfile?->designation === 'Founder & Owner')
                        ?? $company->memberships->sortBy('id')->first();

                    if ($creatorMembership) {
                        $creatorMembership->roles()->syncWithoutDetaching([$ownerRole->id, $adminRole->id]);
                    }
                }
            }
        } catch (\Throwable $e) {
            // Graceful fallback to avoid halting migration pipelines
            \Illuminate\Support\Facades\Log::warning('RBAC auto-seeding migration notice: ' . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive: retain seeded permissions
    }
};

<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoAccountSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Ensure Owner / Admin Demo Account
        $password = Hash::make('Password123!');

        $owner = User::updateOrCreate(
            ['email' => 'alex@bitspark.remote'],
            [
                'name' => 'Alex Owner',
                'password' => $password,
                'email_verified_at' => Carbon::now(),
            ]
        );

        $admin = User::updateOrCreate(
            ['email' => 'admin@softwarehouse.test'],
            [
                'name' => 'Finovo Admin',
                'password' => $password,
                'email_verified_at' => Carbon::now(),
            ]
        );

        $employee = User::updateOrCreate(
            ['email' => 'employee@softwarehouse.test'],
            [
                'name' => 'Sarah Engineer',
                'password' => $password,
                'email_verified_at' => Carbon::now(),
            ]
        );

        // 2. Ensure Company Workspace
        $company = Company::firstOrCreate(
            ['slug' => 'bitspark-ops'],
            [
                'name' => 'Bitspark Global Operations',
                'status' => 'active',
                'timezone' => 'America/New_York',
                'locale' => 'en',
            ]
        );

        // 3. Resolve Roles
        $ownerRole = Role::where('slug', 'company-owner')->first();
        $adminRole = Role::where('slug', 'company-admin')->first();
        $employeeRole = Role::where('slug', 'employee')->first();

        // 4. Assign Owner Membership
        $ownerMembership = CompanyMembership::firstOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $owner->id,
            ],
            [
                'status' => 'active',
                'joined_at' => Carbon::now(),
            ]
        );
        if ($ownerRole) {
            $ownerMembership->roles()->syncWithoutDetaching([$ownerRole->id]);
        }

        // 5. Assign Admin Membership
        $adminMembership = CompanyMembership::firstOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $admin->id,
            ],
            [
                'status' => 'active',
                'joined_at' => Carbon::now(),
            ]
        );
        if ($adminRole) {
            $adminMembership->roles()->syncWithoutDetaching([$adminRole->id]);
        }

        // 6. Assign Employee Membership & Employment Record
        $employeeMembership = CompanyMembership::firstOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $employee->id,
            ],
            [
                'status' => 'active',
                'joined_at' => Carbon::now(),
            ]
        );
        if ($employeeRole) {
            $employeeMembership->roles()->syncWithoutDetaching([$employeeRole->id]);
        }

        EmploymentRecord::firstOrCreate(
            [
                'company_id' => $company->id,
                'membership_id' => $employeeMembership->id,
            ],
            [
                'employee_number' => 'EMP-1001',
                'employment_type' => 'full_time',
                'status' => 'active',
                'hire_date' => Carbon::now()->subMonths(6),
                'manager_membership_id' => $ownerMembership->id,
            ]
        );

        $this->command->info("Demo accounts seeded successfully with password 'Password123!'");
    }
}

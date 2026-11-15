<?php

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('rbac:grant-admin {email?}', function (?string $email = null) {
    $this->info('1. Seeding system roles and permissions...');
    $seeder = new RoleAndPermissionSeeder();
    $seeder->run();

    $ownerRole = Role::where('slug', 'company-owner')->first();
    $adminRole = Role::where('slug', 'company-admin')->first();
    $allPerms = Permission::pluck('id');

    if ($ownerRole) {
        $ownerRole->permissions()->sync($allPerms);
    }
    if ($adminRole) {
        $adminRole->permissions()->sync($allPerms);
    }

    $users = $email ? User::where('email', $email)->get() : User::all();

    if ($users->isEmpty()) {
        $this->error("No user found with email: {$email}");
        return 1;
    }

    $companies = Company::all();
    if ($companies->isEmpty()) {
        $this->warn('No companies found. Creating default company workspace...');
        $company = Company::create([
            'name' => 'Main Workspace',
            'slug' => 'main-workspace',
            'status' => 'active',
            'timezone' => 'UTC',
            'locale' => 'en',
        ]);
        $companies = collect([$company]);
    }

    foreach ($users as $user) {
        $this->info("Granting Owner & Admin access to user: {$user->email} (ID: {$user->id})");

        foreach ($companies as $company) {
            $membership = CompanyMembership::firstOrCreate(
                ['company_id' => $company->id, 'user_id' => $user->id],
                ['status' => 'active', 'joined_at' => now()]
            );

            if ($ownerRole && $adminRole) {
                $membership->roles()->syncWithoutDetaching([$ownerRole->id, $adminRole->id]);
            }
            $this->line(" -> Assigned Owner & Admin on workspace: {$company->name} ({$company->slug})");
        }
    }

    $this->info('✅ Successfully granted full Company Owner & Admin permissions across all workspaces!');
    return 0;
})->purpose('Grant full unrestricted Company Owner and Admin authority to a user');

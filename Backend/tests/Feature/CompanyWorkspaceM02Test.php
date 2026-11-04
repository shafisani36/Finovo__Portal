<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompanySettings;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyWorkspaceM02Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_workspace_creation_atomically_provisions_settings_and_owner_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/companies', [
            'name' => 'Bitspark Global',
            'slug' => 'bitspark-global',
            'timezone' => 'UTC',
            'locale' => 'en',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('company.name', 'Bitspark Global')
            ->assertJsonPath('company.slug', 'bitspark-global');

        $company = Company::where('slug', 'bitspark-global')->firstOrFail();
        $this->assertDatabaseHas('company_settings', ['company_id' => $company->id]);
        $this->assertDatabaseHas('employee_profiles', ['designation' => 'Founder & Owner']);

        $membership = CompanyMembership::where('company_id', $company->id)->where('user_id', $user->id)->firstOrFail();
        $this->assertTrue($membership->hasRole('company-owner'));
    }

    public function test_workspace_show_returns_metrics_and_context(): void
    {
        $user = User::factory()->create();
        $company = Company::create(['name' => 'Finovo Systems', 'slug' => 'finovo-systems']);
        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $membership->roles()->attach($ownerRole->id);

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/v1/companies/{$company->slug}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'company',
                'stats' => ['employee_count', 'department_count', 'pending_invitations'],
                'membership' => ['id', 'status', 'roles', 'permissions'],
            ])
            ->assertJsonPath('stats.employee_count', 1);
    }

    public function test_last_owner_cannot_be_suspended_or_revoked(): void
    {
        $user = User::factory()->create();
        $company = Company::create(['name' => 'Sole Owner Corp', 'slug' => 'sole-owner-corp']);
        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $membership->roles()->attach($ownerRole->id);

        // Attempt to suspend
        $suspendResponse = $this->actingAs($user, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/members/{$membership->id}/suspend");
        $suspendResponse->assertStatus(422)
            ->assertJsonPath('message', 'Cannot suspend the last remaining owner of this company.');

        // Attempt to revoke
        $revokeResponse = $this->actingAs($user, 'sanctum')->deleteJson("/api/v1/companies/{$company->slug}/members/{$membership->id}");
        $revokeResponse->assertStatus(422)
            ->assertJsonPath('message', 'Cannot remove the last remaining owner of this company.');
    }

    public function test_suspended_membership_is_denied_company_access(): void
    {
        $owner = User::factory()->create();
        $employee = User::factory()->create();

        $company = Company::create(['name' => 'Suspension Test Ltd', 'slug' => 'suspension-test']);

        $ownerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $ownerMembership->roles()->attach($ownerRole->id);

        $employeeMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $employee->id,
            'status' => 'suspended',
        ]);
        $employeeRole = Role::where('slug', 'employee')->firstOrFail();
        $employeeMembership->roles()->attach($employeeRole->id);

        // Employee attempts to access company route
        $response = $this->actingAs($employee, 'sanctum')->getJson("/api/v1/companies/{$company->slug}");
        $response->assertStatus(403);
    }

    public function test_department_lifecycle_and_self_parenting_prevention(): void
    {
        $owner = User::factory()->create();
        $company = Company::create(['name' => 'Hierarchy Corp', 'slug' => 'hierarchy-corp']);
        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $membership->roles()->attach($ownerRole->id);

        // Create department
        $createRes = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/departments", [
            'name' => 'Engineering',
            'code' => 'ENG',
            'description' => 'Software engineering department',
        ]);
        $createRes->assertStatus(201)
            ->assertJsonPath('department.name', 'Engineering');

        $dept = Department::where('company_id', $company->id)->where('name', 'Engineering')->firstOrFail();

        // Attempt self-parenting
        $updateRes = $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/companies/{$company->slug}/departments/{$dept->id}", [
            'parent_department_id' => $dept->id,
        ]);
        $updateRes->assertStatus(422)
            ->assertJsonPath('message', 'A department cannot be its own parent.');

        // Delete department
        $deleteRes = $this->actingAs($owner, 'sanctum')->deleteJson("/api/v1/companies/{$company->slug}/departments/{$dept->id}");
        $deleteRes->assertStatus(200);
        $this->assertDatabaseMissing('departments', ['id' => $dept->id]);
    }
}

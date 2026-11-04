<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_user_can_create_company_and_becomes_owner(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/companies', [
            'name' => 'Acme Remote Corp',
            'slug' => 'acme-remote',
            'timezone' => 'America/New_York',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('company.name', 'Acme Remote Corp');

        $company = Company::where('slug', 'acme-remote')->first();
        $this->assertNotNull($company);

        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->first();

        $this->assertNotNull($membership);
        $this->assertTrue($membership->hasRole('company-owner'));
    }

    public function test_cross_company_access_is_strictly_denied(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        // Company A owned by User A
        $companyA = Company::create(['name' => 'Company A', 'slug' => 'company-a']);
        $membershipA = CompanyMembership::create([
            'company_id' => $companyA->id,
            'user_id' => $userA->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->first();
        $membershipA->roles()->attach($ownerRole->id);

        // Company B owned by User B
        $companyB = Company::create(['name' => 'Company B', 'slug' => 'company-b']);
        $membershipB = CompanyMembership::create([
            'company_id' => $companyB->id,
            'user_id' => $userB->id,
            'status' => 'active',
        ]);
        $membershipB->roles()->attach($ownerRole->id);

        // User A attempts to view Company B
        $response = $this->actingAs($userA, 'sanctum')->getJson("/api/v1/companies/{$companyB->id}");
        $response->assertStatus(403);
    }

    public function test_invitation_cannot_be_accepted_by_wrong_email_identity(): void
    {
        $owner = User::factory()->create(['email' => 'owner@acme.com']);
        $company = Company::create(['name' => 'Acme Corp', 'slug' => 'acme-corp']);
        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->first();
        $membership->roles()->attach($ownerRole->id);

        $employeeRole = Role::where('slug', 'employee')->first();

        // Send invitation to alice@example.com
        $inviteResponse = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->id}/invitations", [
            'email' => 'alice@example.com',
            'role_id' => $employeeRole->id,
        ]);

        $inviteResponse->assertStatus(201);
        $rawToken = $inviteResponse->json('invitation_token');

        // Attacker logs in as bob@example.com and tries to accept Alice's invitation
        $attacker = User::factory()->create(['email' => 'bob@example.com']);
        $attackResponse = $this->actingAs($attacker, 'sanctum')->postJson("/api/v1/invitations/{$rawToken}/accept");

        $attackResponse->assertStatus(403);
    }
}

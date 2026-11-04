<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmploymentRecord;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeManagementM03Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    private function createCompanyWithOwner(): array
    {
        $owner = User::factory()->create();
        $company = Company::create([
            'name' => 'Acme Corporation',
            'slug' => 'acme-corp',
        ]);

        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $membership->roles()->attach($ownerRole->id);

        return [$company, $owner, $membership];
    }

    public function test_employee_creation_atomically_provisions_identity_membership_and_onboarding(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $response = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'John Doe',
            'email' => 'john.doe@acme.com',
            'employment_type' => 'permanent',
            'work_arrangement' => 'remote',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('employee.user.name', 'John Doe')
            ->assertJsonPath('employee.user.email', 'john.doe@acme.com')
            ->assertJsonPath('employee.status', 'onboarding');

        // Check identity, membership and employment record exist in DB
        $this->assertDatabaseHas('users', ['email' => 'john.doe@acme.com']);
        $this->assertDatabaseHas('employment_records', ['company_id' => $company->id]);
        $this->assertDatabaseHas('employee_onboarding_tasks', ['company_id' => $company->id]);
        $this->assertDatabaseHas('employment_history', ['company_id' => $company->id, 'change_type' => 'hire']);
    }

    public function test_employee_directory_is_strictly_tenant_isolated(): void
    {
        [$companyA, $ownerA] = $this->createCompanyWithOwner();

        // Company B
        $ownerB = User::factory()->create();
        $companyB = Company::create(['name' => 'Other Corp', 'slug' => 'other-corp']);
        $membershipB = CompanyMembership::create([
            'company_id' => $companyB->id,
            'user_id' => $ownerB->id,
            'status' => 'active',
        ]);
        $ownerRole = Role::where('slug', 'company-owner')->firstOrFail();
        $membershipB->roles()->attach($ownerRole->id);

        // Create employee in Company A
        $this->actingAs($ownerA, 'sanctum')->postJson("/api/v1/companies/{$companyA->slug}/employees", [
            'name' => 'Alice Secret',
            'email' => 'alice@company-a.com',
        ])->assertStatus(201);

        // Owner B querying Company B should see 0 employees
        $responseB = $this->actingAs($ownerB, 'sanctum')->getJson("/api/v1/companies/{$companyB->slug}/employees");
        $responseB->assertStatus(200);
        $this->assertCount(0, $responseB->json('employees.data'));

        // Owner B attempting to query Company A should be denied (403)
        $this->actingAs($ownerB, 'sanctum')->getJson("/api/v1/companies/{$companyA->slug}/employees")
            ->assertStatus(403);
    }

    public function test_circular_reporting_assignment_is_rejected(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        // Create Employee 1
        $emp1Resp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Emp One',
            'email' => 'emp1@acme.com',
        ]);
        $emp1Id = $emp1Resp->json('employee.id');
        $emp1MemId = $emp1Resp->json('employee.membership_id');

        // Create Employee 2 who reports to Emp 1
        $emp2Resp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Emp Two',
            'email' => 'emp2@acme.com',
            'manager_membership_id' => $emp1MemId,
        ]);
        $emp2Id = $emp2Resp->json('employee.id');
        $emp2MemId = $emp2Resp->json('employee.membership_id');

        // Attempting to make Emp 1 report to Emp 1 (self-reporting) must be rejected
        $selfReport = $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/companies/{$company->slug}/employees/{$emp1Id}/employment", [
            'manager_membership_id' => $emp1MemId,
        ]);
        $selfReport->assertStatus(422)
            ->assertJsonFragment(['message' => 'Cannot assign manager: circular reporting chain detected. An employee cannot report to themselves or their subordinates.']);

        // Attempting to make Emp 1 report to Emp 2 (circular: 1 -> 2 -> 1) must be rejected
        $circularReport = $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/companies/{$company->slug}/employees/{$emp1Id}/employment", [
            'manager_membership_id' => $emp2MemId,
        ]);
        $circularReport->assertStatus(422);
    }

    public function test_lifecycle_status_transitions_enforce_valid_state_machine(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $empResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Lifecycle Candidate',
            'email' => 'candidate@acme.com',
            'status' => 'onboarding',
        ]);
        $empId = $empResp->json('employee.id');

        // Valid transition: onboarding -> active
        $activeTransition = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees/{$empId}/status-transitions", [
            'target_status' => 'active',
            'reason' => 'Completed all compliance & onboarding checklists',
        ]);
        $activeTransition->assertStatus(200)
            ->assertJsonPath('employee.status', 'active');

        // Invalid transition: active cannot jump directly to former_employee without offboarding
        $invalidTransition = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees/{$empId}/status-transitions", [
            'target_status' => 'former_employee',
            'reason' => 'Direct termination attempt',
        ]);
        $invalidTransition->assertStatus(422);

        // Valid transition: active -> offboarding
        $offboarding = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees/{$empId}/status-transitions", [
            'target_status' => 'offboarding',
            'reason' => 'Initiating handover process',
        ]);
        $offboarding->assertStatus(200)
            ->assertJsonPath('employee.status', 'offboarding');

        // Verify audit & history recorded
        $this->assertDatabaseHas('employment_history', [
            'employment_record_id' => $empId,
            'change_type' => 'status_change',
        ]);
    }

    public function test_onboarding_task_completion(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $empResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Onboarding User',
            'email' => 'onboarding@acme.com',
        ]);
        $empId = $empResp->json('employee.id');
        $taskId = $empResp->json('employee.onboarding_tasks.0.id');

        $response = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees/{$empId}/onboarding-tasks/{$taskId}/toggle");

        $response->assertStatus(200)
            ->assertJsonPath('task.status', 'completed');
    }

    public function test_designations_and_teams_crud(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        // 1. Create Designation
        $desigResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/designations", [
            'name' => 'Lead Software Engineer',
            'level' => 4,
            'code' => 'LSE-4',
        ]);
        $desigResp->assertStatus(201)->assertJsonPath('designation.name', 'Lead Software Engineer');

        // 2. Create Team
        $teamResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/teams", [
            'name' => 'Backend Core Team',
            'code' => 'BCT',
        ]);
        $teamResp->assertStatus(201)->assertJsonPath('team.name', 'Backend Core Team');
    }

    public function test_employee_offboarding_workflow_with_credential_revocation(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $empResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Offboarding Candidate',
            'email' => 'offboard@acme.com',
            'status' => 'active',
        ]);
        $empId = $empResp->json('employee.id');
        $membershipId = $empResp->json('employee.membership_id');

        $response = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees/{$empId}/offboarding", [
            'reason' => 'Voluntary resignation - moving abroad',
            'immediate_security_revocation' => true,
            'final_status' => 'offboarding',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('employee.status', 'offboarding');

        // Check membership was revoked
        $this->assertDatabaseHas('company_memberships', [
            'id' => $membershipId,
            'status' => 'revoked',
        ]);

        // Check offboarding tasks were scheduled
        $this->assertDatabaseHas('employee_onboarding_tasks', [
            'employment_record_id' => $empId,
            'title' => '[Offboarding] Revoke company access & device credentials',
        ]);
    }

    public function test_employee_csv_export(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/employees", [
            'name' => 'Export User',
            'email' => 'export@acme.com',
        ])->assertStatus(201);

        $response = $this->actingAs($owner, 'sanctum')->get("/api/v1/companies/{$company->slug}/employees/export");

        $response->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));
        $content = $response->streamedContent();
        $this->assertStringContainsString('Export User', $content);
        $this->assertStringContainsString('export@acme.com', $content);
    }
}

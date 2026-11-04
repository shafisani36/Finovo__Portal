<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectManagementM04Test extends TestCase
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
            'name' => 'Acme Projects Corp',
            'slug' => 'acme-projects',
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

    public function test_project_creation_atomically_provisions_code_baseline_and_milestones(): void
    {
        [$company, $owner, $membership] = $this->createCompanyWithOwner();

        $response = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects", [
            'name' => 'NextGen Cloud Portal',
            'client_name' => 'Enterprise Client LLC',
            'manager_membership_id' => $membership->id,
            'project_type' => 'saas',
            'priority' => 'high',
            'budget_amount' => 50000.00,
            'description' => 'Scalable multi-tenant cloud operations platform',
            'scope_overview' => 'Full web portal, REST API, monitoring and billing',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('project.name', 'NextGen Cloud Portal')
            ->assertJsonPath('project.client_name', 'Enterprise Client LLC')
            ->assertJsonPath('project.status', 'planning')
            ->assertJsonPath('project.health_status', 'healthy');

        $projectId = $response->json('project.id');

        // Check project code generated
        $this->assertDatabaseHas('projects', ['id' => $projectId, 'company_id' => $company->id]);
        $this->assertDatabaseHas('project_members', ['project_id' => $projectId, 'membership_id' => $membership->id]);
        $this->assertDatabaseHas('project_scope_revisions', ['project_id' => $projectId, 'revision_number' => 1]);
        $this->assertDatabaseHas('project_milestones', ['project_id' => $projectId, 'name' => 'Kickoff & Requirements Discovery']);
    }

    public function test_project_directory_is_strictly_tenant_isolated(): void
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

        // Create project in Company A
        $this->actingAs($ownerA, 'sanctum')->postJson("/api/v1/companies/{$companyA->slug}/projects", [
            'name' => 'Top Secret Project A',
        ])->assertStatus(201);

        // Owner B querying Company B should see 0 projects
        $responseB = $this->actingAs($ownerB, 'sanctum')->getJson("/api/v1/companies/{$companyB->slug}/projects");
        $responseB->assertStatus(200);
        $this->assertCount(0, $responseB->json('projects.data'));

        // Owner B attempting to access Company A should be denied (403)
        $this->actingAs($ownerB, 'sanctum')->getJson("/api/v1/companies/{$companyA->slug}/projects")
            ->assertStatus(403);
    }

    public function test_circular_milestone_dependency_is_rejected(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $prjResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects", [
            'name' => 'Dependency Test Project',
        ]);
        $prjId = $prjResp->json('project.id');

        // Create Milestone 1 & Milestone 2
        $m1Resp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/milestones", [
            'name' => 'Milestone One',
        ]);
        $m1Id = $m1Resp->json('milestone.id');

        $m2Resp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/milestones", [
            'name' => 'Milestone Two',
        ]);
        $m2Id = $m2Resp->json('milestone.id');

        // Link M1 as predecessor of M2 (M1 -> M2)
        $dep1 = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/milestone-dependencies", [
            'predecessor_milestone_id' => $m1Id,
            'successor_milestone_id' => $m2Id,
        ]);
        $dep1->assertStatus(200);

        // Attempting to make M2 predecessor of M1 creates cycle (M2 -> M1) -> must be rejected (422)
        $cycleDep = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/milestone-dependencies", [
            'predecessor_milestone_id' => $m2Id,
            'successor_milestone_id' => $m1Id,
        ]);
        $cycleDep->assertStatus(422)
            ->assertJsonPath('message', 'Cannot add dependency: circular milestone dependency detected.');
    }

    public function test_milestone_completion_recalculates_weighted_progress(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $prjResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects", [
            'name' => 'Progress Calculation Project',
        ]);
        $prjId = $prjResp->json('project.id');
        $milestoneId = $prjResp->json('project.milestones.0.id');

        $response = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/milestones/{$milestoneId}/complete");

        $response->assertStatus(200)
            ->assertJsonPath('milestone.status', 'completed');

        $this->assertGreaterThan(0, $response->json('project_progress'));
    }

    public function test_lifecycle_state_machine_and_closure_gates(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $prjResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects", [
            'name' => 'Lifecycle Gate Project',
        ]);
        $prjId = $prjResp->json('project.id');

        // Valid transition: planning -> active
        $activeResp = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/transitions", [
            'target_status' => 'active',
            'reason' => 'All kickoff gates approved and scope agreed',
        ]);
        $activeResp->assertStatus(200)
            ->assertJsonPath('project.status', 'active');

        // Raise a critical blocker
        $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/risks", [
            'type' => 'blocker',
            'title' => 'Server credentials withheld by vendor',
            'severity' => 'critical',
        ])->assertStatus(201);

        // Closure gate check: cannot complete or close while blocker is unresolved
        $closureAttempt = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects/{$prjId}/transitions", [
            'target_status' => 'completed',
            'reason' => 'Attempting early completion',
        ]);
        $closureAttempt->assertStatus(422);
        $this->assertStringContainsString('critical blocker', $closureAttempt->json('message'));
    }

    public function test_project_csv_export(): void
    {
        [$company, $owner] = $this->createCompanyWithOwner();

        $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/projects", [
            'name' => 'CSV Export Project',
            'client_name' => 'Client Zeta',
        ])->assertStatus(201);

        $response = $this->actingAs($owner, 'sanctum')->get("/api/v1/companies/{$company->slug}/projects/export");

        $response->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));
        $content = $response->streamedContent();
        $this->assertStringContainsString('CSV Export Project', $content);
        $this->assertStringContainsString('Client Zeta', $content);
    }
}

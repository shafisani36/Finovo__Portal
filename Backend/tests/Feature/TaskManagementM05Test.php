<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskChecklistItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskManagementM05Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanyWithUser(string $email = 'manager@bitspark.com'): array
    {
        $user = User::factory()->create(['email' => $email]);
        $company = Company::create([
            'name' => 'Bitspark Task Workspace',
            'slug' => 'bitspark-tasks-' . uniqid(),
            'status' => 'active',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();

        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $membership->roles()->sync([$ownerRole->id]);

        $project = Project::create([
            'company_id' => $company->id,
            'project_code' => 'BSP-01',
            'name' => 'Bitspark Platform Project',
            'status' => 'active',
            'health_status' => 'healthy',
            'billing_model' => 'fixed_price',
            'budget_amount' => 50000,
            'currency' => 'USD',
        ]);

        $milestone = ProjectMilestone::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'name' => 'Core Sprint 1',
            'status' => 'in_progress',
            'weight' => 2.0,
            'order' => 0,
        ]);

        return [$user, $company, $membership, $project, $milestone];
    }

    public function test_task_creation_atomically_provisions_code_and_checklist(): void
    {
        [$user, $company, $membership, $project, $milestone] = $this->createCompanyWithUser();

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/tasks", [
            'project_id' => $project->id,
            'milestone_id' => $milestone->id,
            'title' => 'Build authentication API flow',
            'description' => 'Implement registration, login, and tokens',
            'task_type' => 'feature',
            'priority' => 'high',
            'assignee_membership_id' => $membership->id,
            'estimated_minutes' => 240,
            'checklist_items' => [
                'Unit tests written',
                'Code reviewed by peer',
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('task.title', 'Build authentication API flow')
            ->assertJsonPath('task.priority', 'high');

        $this->assertDatabaseHas('tasks', [
            'company_id' => $company->id,
            'project_id' => $project->id,
            'title' => 'Build authentication API flow',
            'priority' => 'high',
        ]);

        $this->assertDatabaseHas('task_checklists', [
            'company_id' => $company->id,
            'title' => 'Acceptance Criteria & Gates',
        ]);

        $this->assertDatabaseHas('task_checklist_items', [
            'item_text' => 'Unit tests written',
            'is_completed' => false,
        ]);
    }

    public function test_task_directory_is_strictly_tenant_isolated(): void
    {
        [$userA, $companyA, $memA, $projectA] = $this->createCompanyWithUser('alice@company-a.com');
        [$userB, $companyB, $memB, $projectB] = $this->createCompanyWithUser('bob@company-b.com');

        Task::create([
            'company_id' => $companyA->id,
            'project_id' => $projectA->id,
            'task_code' => 'BSP-T001',
            'title' => 'Confidential Task for Company A',
            'status' => 'open',
            'creator_membership_id' => $memA->id,
        ]);

        $responseB = $this->actingAs($userB, 'sanctum')->getJson("/api/v1/companies/{$companyB->slug}/tasks");
        $responseB->assertStatus(200);
        $this->assertCount(0, $responseB->json('data'));

        // Cross-company access attempt
        $crossAttempt = $this->actingAs($userB, 'sanctum')->getJson("/api/v1/companies/{$companyA->slug}/tasks");
        $crossAttempt->assertStatus(403);
    }

    public function test_circular_task_dependency_is_rejected(): void
    {
        [$user, $company, $membership, $project] = $this->createCompanyWithUser();

        $task1 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'BSP-T101',
            'title' => 'Task 1: Architecture setup',
            'status' => 'open',
            'creator_membership_id' => $membership->id,
        ]);

        $task2 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'BSP-T102',
            'title' => 'Task 2: API development',
            'status' => 'open',
            'creator_membership_id' => $membership->id,
        ]);

        // Task 2 depends on Task 1
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/companies/{$company->slug}/tasks/{$task2->id}/dependencies", [
                'prerequisite_task_id' => $task1->id,
            ])
            ->assertStatus(200);

        // Attempting to make Task 1 depend on Task 2 (creating a cycle: 1 -> 2 -> 1)
        $cycleResponse = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/companies/{$company->slug}/tasks/{$task1->id}/dependencies", [
                'prerequisite_task_id' => $task2->id,
            ]);

        $cycleResponse->assertStatus(422)
            ->assertJsonPath('message', 'Cannot add dependency: circular task dependency cycle detected.');
    }

    public function test_completion_gates_enforce_checklist_completion(): void
    {
        [$user, $company, $membership, $project] = $this->createCompanyWithUser();

        $task = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'BSP-T201',
            'title' => 'Payment Gateway Integration',
            'status' => 'in_progress',
            'creator_membership_id' => $membership->id,
        ]);

        $checklist = TaskChecklist::create([
            'company_id' => $company->id,
            'task_id' => $task->id,
            'title' => 'PCI DSS Verification',
            'is_mandatory' => true,
        ]);

        $item = TaskChecklistItem::create([
            'company_id' => $company->id,
            'task_checklist_id' => $checklist->id,
            'item_text' => 'Sandbox webhook tests passed',
            'is_completed' => false,
        ]);

        // Attempting direct completion while mandatory checklist item is incomplete
        $failResponse = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/companies/{$company->slug}/tasks/{$task->id}/transitions", [
                'target_status' => 'completed',
            ]);

        $failResponse->assertStatus(422);

        // Now toggle checklist item to completed
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/v1/companies/{$company->slug}/tasks/{$task->id}/checklist-items/{$item->id}/toggle")
            ->assertStatus(200);

        // Transition to completed now succeeds
        $successResponse = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/companies/{$company->slug}/tasks/{$task->id}/transitions", [
                'target_status' => 'completed',
                'reason' => 'All checklist items verified',
            ]);

        $successResponse->assertStatus(200)
            ->assertJsonPath('task.status', 'completed');
    }

    public function test_weighted_parent_task_progress_calculation(): void
    {
        [$user, $company, $membership, $project] = $this->createCompanyWithUser();

        $parent = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'BSP-TPAR',
            'title' => 'Parent Epic: Authentication Module',
            'status' => 'in_progress',
            'creator_membership_id' => $membership->id,
        ]);

        $child1 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'parent_task_id' => $parent->id,
            'task_code' => 'BSP-TCH1',
            'title' => 'Subtask 1: Backend Auth API',
            'status' => 'completed',
            'weight' => 2.0,
            'creator_membership_id' => $membership->id,
        ]);

        $child2 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'parent_task_id' => $parent->id,
            'task_code' => 'BSP-TCH2',
            'title' => 'Subtask 2: Frontend Auth UI',
            'status' => 'in_progress',
            'progress_percent' => 50.0,
            'weight' => 8.0,
            'creator_membership_id' => $membership->id,
        ]);

        // Formula: P = (2 * 1.0 + 8 * 0.5) / (2 + 8) * 100 = (2 + 4) / 10 * 100 = 60%
        $progress = $parent->calculateProgress();
        $this->assertEquals(60.0, $progress);
    }

    public function test_task_csv_export(): void
    {
        [$user, $company, $membership, $project] = $this->createCompanyWithUser();

        Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'BSP-T301',
            'title' => 'Exportable Task',
            'status' => 'open',
            'priority' => 'high',
            'creator_membership_id' => $membership->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')->get("/api/v1/companies/{$company->slug}/tasks/export");
        $response->assertStatus(200);
        $this->assertStringContainsString('text/csv', strtolower($response->headers->get('Content-Type')));
        $this->assertStringContainsString('BSP-T301', $response->streamedContent());
    }
}

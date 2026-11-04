<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\TimePolicy;
use App\Models\Timesheet;
use App\Models\TrackerDevice;
use App\Models\User;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimeTrackingM06Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanyWithUsers(): array
    {
        $owner = User::factory()->create(['name' => 'Owner Alice', 'email' => 'alice@finovo.com']);
        $employee = User::factory()->create(['name' => 'Dev Bob', 'email' => 'bob@finovo.com']);
        $manager = User::factory()->create(['name' => 'Manager Charlie', 'email' => 'charlie@finovo.com']);

        $company = Company::create([
            'name' => 'Finovo Global Time Workspace',
            'slug' => 'finovo-time-' . uniqid(),
            'status' => 'active',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();
        $employeeRole = Role::where('slug', 'employee')->first();
        $pmRole = Role::where('slug', 'project-manager')->first();

        // Owner membership
        $ownerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerMembership->roles()->sync([$ownerRole->id]);

        // Employee membership
        $empMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $employee->id,
            'status' => 'active',
        ]);
        $empMembership->roles()->sync([$employeeRole->id]);
        $empRecord = EmploymentRecord::create([
            'company_id' => $company->id,
            'membership_id' => $empMembership->id,
            'employee_number' => 'EMP-001',
            'employment_type' => 'permanent',
            'status' => 'active',
        ]);

        // Manager membership
        $mgrMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $manager->id,
            'status' => 'active',
        ]);
        $mgrMembership->roles()->sync([$pmRole->id]);

        // Project and Task
        $project = Project::create([
            'company_id' => $company->id,
            'project_code' => 'FNV-TIME',
            'name' => 'Finovo Time Tracker Engine',
            'status' => 'active',
            'health_status' => 'healthy',
            'billing_model' => 'time_and_materials',
            'budget_amount' => 10000,
            'currency' => 'USD',
        ]);

        $task1 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'FNV-TIME-1',
            'title' => 'WPF Desktop UI Architecture',
            'status' => 'in_progress',
            'creator_membership_id' => $ownerMembership->id,
            'assignee_membership_id' => $empMembership->id,
        ]);

        $task2 = Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'task_code' => 'FNV-TIME-2',
            'title' => 'Offline SQLite Reconciliation Queue',
            'status' => 'open',
            'creator_membership_id' => $ownerMembership->id,
            'assignee_membership_id' => $empMembership->id,
        ]);

        return [
            'company' => $company,
            'owner' => $owner,
            'employee' => $employee,
            'manager' => $manager,
            'empMembership' => $empMembership,
            'mgrMembership' => $mgrMembership,
            'project' => $project,
            'task1' => $task1,
            'task2' => $task2,
        ];
    }

    public function test_employee_can_start_pause_resume_switch_and_stop_session(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $task1 = $ctx['task1'];
        $task2 = $ctx['task2'];

        // 1. Start Session
        $startRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions", [
            'task_id' => $task1->id,
            'started_at' => Carbon::now()->subMinutes(60)->toIso8601String(),
            'idempotency_key' => 'idem-test-01',
        ]);

        $startRes->assertStatus(201)
            ->assertJsonPath('session.status', 'running')
            ->assertJsonPath('session.task_id', $task1->id);

        $sessionId = $startRes->json('session.id');

        // 2. Pause Session
        $pauseRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions/{$sessionId}/pause");
        $pauseRes->assertStatus(200)
            ->assertJsonPath('session.status', 'paused');

        // 3. Resume Session
        $resumeRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions/{$sessionId}/resume");
        $resumeRes->assertStatus(200)
            ->assertJsonPath('session.status', 'running');

        // 4. Switch Task
        $switchRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions/{$sessionId}/switch-task", [
            'task_id' => $task2->id,
        ]);
        $switchRes->assertStatus(200)
            ->assertJsonPath('session.task_id', $task2->id);

        // 5. Current Session Inspection
        $currentRes = $this->actingAs($employee, 'sanctum')->getJson("/api/v1/companies/{$company->slug}/time/sessions/current");
        $currentRes->assertStatus(200)
            ->assertJsonPath('is_tracking', true)
            ->assertJsonPath('session.id', $sessionId);

        // 6. Stop Session
        $stopRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions/{$sessionId}/stop");
        $stopRes->assertStatus(200)
            ->assertJsonPath('session.status', 'stopped');

        // Ensure TimeEntry record was persisted
        $this->assertDatabaseHas('time_entries', [
            'company_id' => $company->id,
            'work_session_id' => $sessionId,
            'source' => 'timer',
        ]);
    }

    public function test_concurrent_running_session_is_rejected_by_policy(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $task1 = $ctx['task1'];

        // Start first session
        $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions", [
            'task_id' => $task1->id,
        ])->assertStatus(201);

        // Attempting to start a second concurrent session fails with 409
        $conflictRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions", [
            'task_id' => $task1->id,
        ]);

        $conflictRes->assertStatus(409)
            ->assertJsonPath('message', 'A tracking session is already running for this user. Pause or stop it before starting another.');
    }

    public function test_idempotency_key_returns_existing_session(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $task1 = $ctx['task1'];

        $key = 'idem-unique-12345';

        $first = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions", [
            'task_id' => $task1->id,
            'idempotency_key' => $key,
        ]);
        $first->assertStatus(201);
        $firstSessionId = $first->json('session.id');

        // Second request with same idempotency key
        $second = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sessions", [
            'task_id' => $task1->id,
            'idempotency_key' => $key,
        ]);

        $second->assertStatus(200)
            ->assertJsonPath('session.id', $firstSessionId);
    }

    public function test_manual_time_entry_validation_and_overlap_rejection(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $task1 = $ctx['task1'];

        $startTime = Carbon::yesterday()->setHour(9)->setMinute(0)->setSecond(0);
        $endTime = (clone $startTime)->addHours(3);

        // 1. Create valid manual entry
        $res = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => $startTime->toIso8601String(),
            'ended_at' => $endTime->toIso8601String(),
            'is_billable' => true,
            'description' => 'Manual coding session for WPF integration',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('entry.source', 'manual')
            ->assertJsonPath('entry.duration_seconds', 10800);

        // 2. Reject overlapping interval (Algorithm C)
        $overlapStart = (clone $startTime)->addHour();
        $overlapEnd = (clone $endTime)->addHour();

        $overlapRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => $overlapStart->toIso8601String(),
            'ended_at' => $overlapEnd->toIso8601String(),
            'description' => 'Overlapping segment',
        ]);

        $overlapRes->assertStatus(409)
            ->assertJsonPath('message', 'The submitted manual time interval overlaps with an existing time entry.');

        // 3. Reject future timestamps
        $futureRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => Carbon::tomorrow()->setHour(9)->toIso8601String(),
            'ended_at' => Carbon::tomorrow()->setHour(12)->toIso8601String(),
            'description' => 'Future time',
        ]);

        $futureRes->assertStatus(422);
    }

    public function test_timesheet_generation_submission_and_separation_of_duties_approval(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $manager = $ctx['manager'];
        $task1 = $ctx['task1'];

        // Create an entry in the target week
        $start = Carbon::now()->subDays(3)->setHour(10)->setMinute(0)->setSecond(0);
        $end = (clone $start)->addHours(4);

        $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => $start->toIso8601String(),
            'ended_at' => $end->toIso8601String(),
            'description' => 'Sprint 1 task effort',
        ])->assertStatus(201);

        // 1. Generate Timesheet Draft
        $weekStart = Carbon::now()->subDays(6)->toDateString();
        $weekEnd = Carbon::now()->toDateString();

        $tsRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets", [
            'period_start' => $weekStart,
            'period_end' => $weekEnd,
        ]);

        $tsRes->assertStatus(201)
            ->assertJsonPath('timesheet.status', 'draft')
            ->assertJsonPath('timesheet.total_tracked_seconds', 14400);

        $timesheetId = $tsRes->json('timesheet.id');

        // 2. Submit Timesheet
        $subRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$timesheetId}/submit");
        $subRes->assertStatus(200)
            ->assertJsonPath('timesheet.status', 'submitted');

        // 3. Employee without permission cannot approve timesheet
        $selfApproveRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$timesheetId}/approve");
        $selfApproveRes->assertStatus(403);

        // 4. Separation of Duties: Manager who HAS permission CANNOT approve their OWN timesheet
        $mgrEntryRes = $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => $start->toIso8601String(),
            'ended_at' => $end->toIso8601String(),
            'description' => 'Manager architecture work',
        ]);
        $mgrTsRes = $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets", [
            'period_start' => $weekStart,
            'period_end' => $weekEnd,
        ]);
        $mgrTsId = $mgrTsRes->json('timesheet.id');
        $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$mgrTsId}/submit");

        // Manager attempts self-approval
        $mgrSelfApprove = $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$mgrTsId}/approve");
        $mgrSelfApprove->assertStatus(403)
            ->assertJsonPath('message', 'Separation of duties policy violation: You cannot approve your own timesheet.');

        // 5. Authorized Manager Approves Employee's Timesheet
        $mgrApproveRes = $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$timesheetId}/approve", [
            'reason' => 'Reviewed against milestone deliverables and approved.',
        ]);

        $mgrApproveRes->assertStatus(200)
            ->assertJsonPath('timesheet.status', 'approved')
            ->assertJsonPath('timesheet.total_approved_seconds', 14400);

        $this->assertDatabaseHas('timesheets', [
            'id' => $timesheetId,
            'status' => 'approved',
        ]);
    }

    public function test_timesheet_rejection_records_reason(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $manager = $ctx['manager'];
        $task1 = $ctx['task1'];

        $start = Carbon::now()->subDays(2)->setHour(10);
        $end = (clone $start)->addHours(2);

        $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => $start->toIso8601String(),
            'ended_at' => $end->toIso8601String(),
            'description' => 'Work',
        ]);

        $tsRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets", [
            'period_start' => Carbon::now()->subDays(5)->toDateString(),
            'period_end' => Carbon::now()->toDateString(),
        ]);
        $timesheetId = $tsRes->json('timesheet.id');

        $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$timesheetId}/submit");

        // Manager Rejects with reason
        $rejectRes = $this->actingAs($manager, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/timesheets/{$timesheetId}/reject", [
            'rejection_reason' => 'Task documentation is missing for this sprint.',
        ]);

        $rejectRes->assertStatus(200)
            ->assertJsonPath('timesheet.status', 'rejected')
            ->assertJsonPath('timesheet.rejection_reason', 'Task documentation is missing for this sprint.');
    }

    public function test_timesheet_reopen_and_correction_request_workflow(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $manager = $ctx['manager'];
        $task1 = $ctx['task1'];

        $entryRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries", [
            'task_id' => $task1->id,
            'started_at' => Carbon::yesterday()->setHour(10)->toIso8601String(),
            'ended_at' => Carbon::yesterday()->setHour(12)->toIso8601String(),
            'description' => 'Entry for correction test',
        ]);
        $entryId = $entryRes->json('entry.id');

        // Submit Correction Request
        $correctionRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/entries/{$entryId}/corrections", [
            'proposed_started_at' => Carbon::yesterday()->setHour(9)->toIso8601String(),
            'proposed_ended_at' => Carbon::yesterday()->setHour(12)->toIso8601String(),
            'reason' => 'Forgot to start desktop tracker during initial code review',
        ]);

        $correctionRes->assertStatus(201)
            ->assertJsonPath('adjustment.status', 'pending')
            ->assertJsonPath('adjustment.proposed_duration_seconds', 10800);
    }

    public function test_device_registration_and_revocation_blocks_sync_batches(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $owner = $ctx['owner'];

        // 1. Register device
        $regRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/devices/register", [
            'device_uid' => 'DESKTOP-WIN11-XYZ-99',
            'device_name' => "Bob's Workstation",
            'os_version' => 'Windows 11 Pro 24H2',
            'app_version' => '1.0.0-LTS',
        ]);

        $regRes->assertStatus(201)
            ->assertJsonPath('device.status', 'active');
        $deviceId = $regRes->json('device.id');

        // 2. Revoke device
        $revokeRes = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/devices/{$deviceId}/revoke");
        $revokeRes->assertStatus(200)
            ->assertJsonPath('device.status', 'revoked');

        // 3. Sync from revoked device is rejected
        $syncRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sync-batches", [
            'batch_uid' => 'batch-revoked-001',
            'device_uid' => 'DESKTOP-WIN11-XYZ-99',
            'events' => [
                [
                    'event_id' => 'evt-01',
                    'event_type' => 'interval',
                    'started_at' => Carbon::yesterday()->setHour(8)->toIso8601String(),
                    'ended_at' => Carbon::yesterday()->setHour(9)->toIso8601String(),
                ]
            ],
        ]);

        $syncRes->assertStatus(403)
            ->assertJsonPath('message', 'Device is revoked. Batch rejected.');
    }

    public function test_offline_sync_batch_idempotency_and_event_reconciliation(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $employee = $ctx['employee'];
        $task1 = $ctx['task1'];

        $batchUid = 'offline-batch-2026-xyz';
        $payload = [
            'batch_uid' => $batchUid,
            'events' => [
                [
                    'event_id' => 'evt-local-01',
                    'event_type' => 'interval',
                    'task_id' => $task1->id,
                    'started_at' => Carbon::yesterday()->setHour(14)->toIso8601String(),
                    'ended_at' => Carbon::yesterday()->setHour(17)->toIso8601String(),
                    'duration_seconds' => 10800,
                ],
                [
                    'event_id' => 'evt-local-02',
                    'event_type' => 'interval',
                    'task_id' => $task1->id,
                    'started_at' => Carbon::yesterday()->setHour(17)->addMinutes(15)->toIso8601String(),
                    'ended_at' => Carbon::yesterday()->setHour(18)->toIso8601String(),
                    'duration_seconds' => 2700,
                ],
            ],
        ];

        // First sync
        $syncRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sync-batches", $payload);
        $syncRes->assertStatus(200)
            ->assertJsonPath('synced_events', 2);

        // Replay same batch (idempotent)
        $replayRes = $this->actingAs($employee, 'sanctum')->postJson("/api/v1/companies/{$company->slug}/time/sync-batches", $payload);
        $replayRes->assertStatus(200)
            ->assertJsonPath('status', 'acknowledged');
    }

    public function test_reports_summary_and_csv_export(): void
    {
        $ctx = $this->createCompanyWithUsers();
        $company = $ctx['company'];
        $manager = $ctx['manager'];
        $task1 = $ctx['task1'];

        TimeEntry::create([
            'company_id' => $company->id,
            'membership_id' => $ctx['empMembership']->id,
            'project_id' => $ctx['project']->id,
            'task_id' => $task1->id,
            'started_at' => Carbon::yesterday()->setHour(9),
            'ended_at' => Carbon::yesterday()->setHour(13),
            'duration_seconds' => 14400,
            'source' => 'timer',
            'approval_status' => 'approved',
            'is_billable' => true,
        ]);

        // Reports Summary
        $reportRes = $this->actingAs($manager, 'sanctum')->getJson("/api/v1/companies/{$company->slug}/time/reports/summary");
        $reportRes->assertStatus(200)
            ->assertJsonPath('metrics.tracked_hours', 4)
            ->assertJsonPath('metrics.approved_hours', 4)
            ->assertJsonPath('metrics.billable_hours', 4);

        // CSV Export
        $exportRes = $this->actingAs($manager, 'sanctum')->get("/api/v1/companies/{$company->slug}/time/exports");
        $exportRes->assertStatus(200);
        $this->assertTrue(str_contains($exportRes->headers->get('content-disposition'), 'time_entries_'));
    }
}

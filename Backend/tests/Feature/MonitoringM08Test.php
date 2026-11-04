<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\MonitoringContextAnnotation;
use App\Models\MonitoringDispute;
use App\Models\MonitoringEvent;
use App\Models\MonitoringInterval;
use App\Models\MonitoringPolicy;
use App\Models\MonitoringPolicyAcknowledgment;
use App\Models\MonitoringReconciliationCase;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TrackerDevice;
use App\Models\User;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MonitoringM08Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanySetup(): array
    {
        $owner = User::factory()->create(['name' => 'Owner Alice', 'email' => 'alice@finovo.com']);
        $employee = User::factory()->create(['name' => 'Dev Bob', 'email' => 'bob@finovo.com']);
        $manager = User::factory()->create(['name' => 'Manager Charlie', 'email' => 'charlie@finovo.com']);

        $company = Company::create([
            'name' => 'Finovo Global Monitoring Workspace',
            'slug' => 'finovo-mon-' . uniqid(),
            'status' => 'active',
            'timezone' => 'UTC',
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

        // Manager membership
        $mgrMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $manager->id,
            'status' => 'active',
        ]);
        $mgrMembership->roles()->sync([$pmRole->id]);

        return [
            'company' => $company,
            'owner' => $owner,
            'employee' => $employee,
            'manager' => $manager,
            'ownerMembership' => $ownerMembership,
            'empMembership' => $empMembership,
            'mgrMembership' => $mgrMembership,
        ];
    }

    public function test_effective_policy_retrieval_and_transparency_acknowledgment(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Employee fetches current monitoring policy
        $response = $this->actingAs($setup['employee'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/monitoring/policy/current");

        $response->assertStatus(200)
            ->assertJsonPath('policy.is_active', true)
            ->assertJsonPath('is_acknowledged', false)
            ->assertJsonPath('privacy_commitments.keystroke_recording', 'Never collected')
            ->assertJsonPath('privacy_commitments.clipboard_contents', 'Never collected');

        $policyId = $response->json('policy.id');
        $policyVersion = $response->json('policy.version');

        // 2. Employee acknowledges transparency policy
        $ackResponse = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/policy/acknowledge", [
                'policy_id' => $policyId,
                'policy_version' => $policyVersion,
            ]);

        $ackResponse->assertStatus(200)
            ->assertJsonPath('acknowledgment.policy_version', $policyVersion);

        $this->assertDatabaseHas('monitoring_policy_acknowledgments', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'policy_id' => $policyId,
            'policy_version' => $policyVersion,
        ]);
    }

    public function test_policy_creation_simulator_preview_and_activation(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Preview Simulator before creating policy
        $previewResp = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/monitoring/policy/preview");

        $previewResp->assertStatus(200)
            ->assertJsonPath('simulation.scope_summary.collection_mode', 'Privacy-first coarse signals')
            ->assertJsonStructure(['simulation' => ['signals_evaluated', 'lifecycle_and_retention']]);

        // 2. Create new draft policy version
        $createResp = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/policies", [
                'name' => 'Stricter Engineering Privacy Policy',
                'idle_threshold_seconds' => 600,
                'retention_days' => 60,
                'allow_offline_queue' => true,
            ]);

        $createResp->assertStatus(201)
            ->assertJsonPath('policy.version', 2)
            ->assertJsonPath('policy.is_active', false)
            ->assertJsonPath('policy.idle_threshold_seconds', 600);

        $newPolicyId = $createResp->json('policy.id');

        // 3. Publish and activate policy version 2
        $publishResp = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/policies/{$newPolicyId}/publish");

        $publishResp->assertStatus(200)
            ->assertJsonPath('policy.is_active', true);

        // Previous policy version 1 must now be deactivated
        $this->assertDatabaseHas('monitoring_policies', [
            'company_id' => $setup['company']->id,
            'version' => 1,
            'is_active' => false,
        ]);
    }

    public function test_desktop_device_registration_heartbeat_and_revocation(): void
    {
        $setup = $this->createCompanySetup();
        $deviceUid = 'DESKTOP-FINOVO-' . uniqid();

        // 1. Register device
        $regResp = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/devices/register", [
                'device_uid' => $deviceUid,
                'device_name' => "Bob's Surface Laptop",
                'os_version' => 'Windows 11 Pro 23H2',
                'app_version' => '1.2.0',
            ]);

        $regResp->assertStatus(200)
            ->assertJsonPath('device.status', 'active');

        $deviceId = $regResp->json('device.id');

        // 2. Send heartbeat
        $hbResp = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/devices/{$deviceId}/heartbeat", [
                'pending_sync_count' => 3,
                'last_sync_status' => 'ok',
            ]);

        $hbResp->assertStatus(200)
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseHas('monitoring_device_heartbeats', [
            'tracker_device_id' => $deviceId,
            'pending_sync_count' => 3,
        ]);

        // 3. Revoke device by administrator
        $revokeResp = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/devices/{$deviceId}/revoke");

        $revokeResp->assertStatus(200)
            ->assertJsonPath('device.status', 'revoked');

        // 4. Verify revoked device cannot send heartbeats or events
        $blockedHb = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/devices/{$deviceId}/heartbeat", [
                'pending_sync_count' => 0,
            ]);

        $blockedHb->assertStatus(403)
            ->assertJsonPath('status', 'revoked');
    }

    public function test_idempotent_event_batch_ingestion_and_normalization(): void
    {
        $setup = $this->createCompanySetup();
        $deviceUid = 'WPF-TRACKER-' . uniqid();

        // Register active device
        $device = TrackerDevice::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'device_uid' => $deviceUid,
            'device_name' => "Dev Rig",
            'status' => 'active',
            'registered_at' => Carbon::now('UTC'),
        ]);

        $event1Uid = 'evt-' . uniqid();
        $event2Uid = 'evt-' . uniqid();
        $baseTime = Carbon::today()->setTime(10, 2); // Guaranteed within 10:00 - 10:15 slot

        $batchPayload = [
            'device_uid' => $deviceUid,
            'batch_uid' => 'batch-101',
            'events' => [
                [
                    'event_uid' => $event1Uid,
                    'event_type' => 'activity_presence',
                    'client_occurred_at' => $baseTime->toIso8601String(),
                    'category' => 'development',
                    'client_sequence' => 1,
                ],
                [
                    'event_uid' => $event2Uid,
                    'event_type' => 'idle_interval',
                    'client_occurred_at' => $baseTime->copy()->addMinutes(3)->toIso8601String(),
                    'idle_duration_seconds' => 180,
                    'category' => 'unclassified',
                    'client_sequence' => 2,
                ],
            ],
        ];

        // 1. Submit batch first time
        $resp1 = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/events/batches", $batchPayload);

        $resp1->assertStatus(200)
            ->assertJsonPath('accepted_count', 2)
            ->assertJsonPath('duplicate_count', 0);

        $this->assertDatabaseCount('monitoring_events', 2);
        $this->assertDatabaseCount('monitoring_intervals', 1); // Grouped in 15m window

        // 2. Submit exact same batch again (idempotency & replay protection)
        $resp2 = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/events/batches", $batchPayload);

        $resp2->assertStatus(200)
            ->assertJsonPath('accepted_count', 0)
            ->assertJsonPath('duplicate_count', 2);

        // Database count must still be 2, no duplicate event records created
        $this->assertDatabaseCount('monitoring_events', 2);
    }

    public function test_employee_context_annotation_submission(): void
    {
        $setup = $this->createCompanySetup();

        // Create interval
        $interval = MonitoringInterval::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'start_time' => Carbon::today()->setTime(10, 0),
            'end_time' => Carbon::today()->setTime(10, 15),
            'duration_seconds' => 900,
            'signal_state' => 'idle_signal',
            'context_confidence' => 'needs_review',
        ]);

        // Employee adds context explanation
        $response = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/annotations", [
                'monitoring_interval_id' => $interval->id,
                'annotation_date' => Carbon::today()->toDateString(),
                'annotation_type' => 'call_meeting',
                'explanation' => 'Client Zoom sprint planning meeting without active typing.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('annotation.annotation_type', 'call_meeting');

        // Interval confidence updated to well_contextualized
        $interval->refresh();
        $this->assertEquals('well_contextualized', $interval->context_confidence);
        $this->assertEquals('idle_signal', $interval->signal_state); // Raw signal preserved!
    }

    public function test_activity_dispute_and_separation_of_duties_enforcement(): void
    {
        $setup = $this->createCompanySetup();

        $interval = MonitoringInterval::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'start_time' => Carbon::today()->setTime(14, 0),
            'end_time' => Carbon::today()->setTime(14, 15),
            'duration_seconds' => 900,
            'signal_state' => 'idle_signal',
            'context_confidence' => 'unknown',
        ]);

        // 1. Employee submits dispute
        $dispResp = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/disputes", [
                'monitoring_interval_id' => $interval->id,
                'dispute_reason' => 'Was reviewing architecture specification document printed on desk.',
            ]);

        $dispResp->assertStatus(201)
            ->assertJsonPath('dispute.status', 'pending');

        $disputeId = $dispResp->json('dispute.id');

        // 2. Separation of Duties: Employee attempts to resolve their OWN dispute -> MUST FAIL 422
        $selfResolveResp = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/disputes/{$disputeId}/resolve", [
                'status' => 'approved',
                'reviewer_comment' => 'Self-approving my own dispute',
            ]);

        // Employee does not have dispute.review permission, or if assigned, fails separation of duties
        $this->assertTrue(in_array($selfResolveResp->status(), [403, 422]));

        // 3. Authorized Manager reviews and approves dispute
        $mgrResolveResp = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/disputes/{$disputeId}/resolve", [
                'status' => 'approved',
                'reviewer_comment' => 'Confirmed offline architecture review was requested.',
            ]);

        $mgrResolveResp->assertStatus(200)
            ->assertJsonPath('dispute.status', 'approved');

        $this->assertDatabaseHas('monitoring_disputes', [
            'id' => $disputeId,
            'status' => 'approved',
            'reviewed_by_membership_id' => $setup['mgrMembership']->id,
        ]);
    }

    public function test_work_context_engine_timeline_reconciliation(): void
    {
        $setup = $this->createCompanySetup();
        $today = Carbon::today()->toDateString();

        // Simulate 2 unassociated active intervals without work session
        MonitoringInterval::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'start_time' => Carbon::today()->setTime(9, 0),
            'end_time' => Carbon::today()->setTime(9, 15),
            'duration_seconds' => 900,
            'signal_state' => 'active_signal',
            'work_session_id' => null, // No session selected!
        ]);

        MonitoringInterval::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'start_time' => Carbon::today()->setTime(9, 15),
            'end_time' => Carbon::today()->setTime(9, 30),
            'duration_seconds' => 900,
            'signal_state' => 'active_signal',
            'work_session_id' => null,
        ]);

        // Run reconciliation
        $reconcileResp = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/reconciliation/run", [
                'date' => $today,
            ]);

        $reconcileResp->assertStatus(200)
            ->assertJsonPath('cases_generated', 1);

        $this->assertDatabaseHas('monitoring_reconciliation_cases', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'case_type' => 'unassociated_activity',
            'status' => 'unresolved',
        ]);

        // Review reconciliation case
        $case = MonitoringReconciliationCase::first();
        $reviewResp = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/monitoring/reconciliation-cases/{$case->id}/review", [
                'status' => 'resolved',
                'resolution_notes' => 'Reminded employee to select API integration task in tracker.',
            ]);

        $reviewResp->assertStatus(200)
            ->assertJsonPath('case.status', 'resolved');
    }

    public function test_authorized_monitoring_csv_export(): void
    {
        $setup = $this->createCompanySetup();

        MonitoringInterval::create([
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'start_time' => Carbon::today()->setTime(11, 0),
            'end_time' => Carbon::today()->setTime(11, 15),
            'duration_seconds' => 900,
            'signal_state' => 'active_signal',
            'app_category' => 'development',
            'context_confidence' => 'well_contextualized',
        ]);

        $response = $this->actingAs($setup['owner'])
            ->get("/api/v1/companies/{$setup['company']->id}/monitoring/export?date=" . Carbon::today()->toDateString());

        $response->assertStatus(200);
        $this->assertStringContainsString('text/csv', $response->headers->get('content-type'));
    }
}

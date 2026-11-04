<?php

namespace Tests\Feature;

use App\Models\AttendanceBreak;
use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceEvent;
use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceTransaction;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Role;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceAndLeaveM07Test extends TestCase
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
            'name' => 'Finovo Global Attendance Workspace',
            'slug' => 'finovo-att-' . uniqid(),
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
        EmploymentRecord::create([
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

        return compact('company', 'owner', 'employee', 'manager', 'ownerMembership', 'empMembership', 'mgrMembership');
    }

    public function test_employee_can_clock_in_take_break_and_clock_out_successfully(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Clock In
        $inResponse = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in", [
                'source' => 'web',
                'device_id' => 'BROWSER-DEV-01',
            ]);

        $inResponse->assertStatus(201);
        $status = $inResponse->json('attendance.status');
        $this->assertContains($status, ['present', 'late']);

        $this->assertDatabaseHas('attendance_records', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'status' => $status,
        ]);

        $this->assertDatabaseHas('attendance_events', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'event_type' => 'clock_in',
        ]);

        // 2. Start Break
        $breakStart = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/breaks/start", [
                'break_type' => 'meal',
                'is_paid' => false,
            ]);

        $breakStart->assertStatus(201)
            ->assertJsonPath('break.break_type', 'meal');

        $this->assertDatabaseHas('attendance_breaks', [
            'company_id' => $setup['company']->id,
            'break_type' => 'meal',
            'ended_at' => null,
        ]);

        // 3. End Break
        $breakEnd = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/breaks/end");

        $breakEnd->assertStatus(200);

        // 4. Clock Out
        $outResponse = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-out", [
                'source' => 'web',
            ]);

        $outResponse->assertStatus(200);

        $this->assertDatabaseHas('attendance_events', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'event_type' => 'clock_out',
        ]);
    }

    public function test_duplicate_clock_in_is_rejected_with_conflict(): void
    {
        $setup = $this->createCompanySetup();

        // First clock-in
        $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in")
            ->assertStatus(201);

        // Immediate duplicate clock-in
        $dupResponse = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in");

        $dupResponse->assertStatus(409)
            ->assertJsonFragment(['message' => 'You are already clocked in for this work date. Please clock out before starting a new session.']);
    }

    public function test_idempotent_clock_in_returns_original_session(): void
    {
        $setup = $this->createCompanySetup();
        $idempotencyKey = 'IDEMP-' . uniqid();

        $res1 = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in", [
                'idempotency_key' => $idempotencyKey,
            ])
            ->assertStatus(201);

        $res2 = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in", [
                'idempotency_key' => $idempotencyKey,
            ])
            ->assertStatus(200);

        $this->assertStringContainsString('idempotent replay', $res2->json('message'));
        $this->assertEquals($res1->json('attendance.id'), $res2->json('attendance.id'));
    }

    public function test_leave_submission_calculates_working_days_and_reserves_balance(): void
    {
        $setup = $this->createCompanySetup();

        // Initialize leave types
        $this->actingAs($setup['employee'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/leave/types")
            ->assertStatus(200);

        $annualType = LeaveType::where('company_id', $setup['company']->id)->where('code', 'AL')->firstOrFail();

        // Determine next Monday to Wednesday dates (3 working days)
        $nextMonday = Carbon::now()->next(Carbon::MONDAY);
        $nextWednesday = $nextMonday->copy()->addDays(2);

        $submitRes = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $annualType->id,
                'start_date' => $nextMonday->toDateString(),
                'end_date' => $nextWednesday->toDateString(),
                'day_portion' => 'full',
                'reason' => 'Annual family vacation trip',
            ]);

        $submitRes->assertStatus(201)
            ->assertJsonPath('leave_request.requested_units', '3.00')
            ->assertJsonPath('leave_request.status', 'pending');

        $requestId = $submitRes->json('leave_request.id');

        // Check balance reservation ledger entry
        $this->assertDatabaseHas('leave_balance_transactions', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'transaction_type' => 'reservation',
            'days' => 3.0,
        ]);
    }

    public function test_overlapping_leave_request_is_rejected(): void
    {
        $setup = $this->createCompanySetup();

        $this->actingAs($setup['employee'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/leave/types")
            ->assertStatus(200);

        $annualType = LeaveType::where('company_id', $setup['company']->id)->where('code', 'AL')->firstOrFail();

        $nextMonday = Carbon::now()->next(Carbon::MONDAY);
        $nextFriday = $nextMonday->copy()->addDays(4);

        // Submit first request
        $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $annualType->id,
                'start_date' => $nextMonday->toDateString(),
                'end_date' => $nextFriday->toDateString(),
                'day_portion' => 'full',
                'reason' => 'First week trip',
            ])->assertStatus(201);

        // Submit overlapping request
        $overlapRes = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $annualType->id,
                'start_date' => $nextMonday->copy()->addDays(2)->toDateString(),
                'end_date' => $nextFriday->copy()->addDays(2)->toDateString(),
                'day_portion' => 'full',
                'reason' => 'Conflicting trip',
            ]);

        $overlapRes->assertStatus(422)
            ->assertJsonFragment(['message' => 'An active or pending leave request already overlaps with these dates.']);
    }

    public function test_leave_approval_enforces_separation_of_duties_and_posts_balance_deduction(): void
    {
        $setup = $this->createCompanySetup();

        $this->actingAs($setup['employee'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/leave/types")
            ->assertStatus(200);

        $sickType = LeaveType::where('company_id', $setup['company']->id)->where('code', 'SL')->firstOrFail();
        $nextMonday = Carbon::now()->next(Carbon::MONDAY);

        $submitRes = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $sickType->id,
                'start_date' => $nextMonday->toDateString(),
                'end_date' => $nextMonday->toDateString(),
                'day_portion' => 'full',
                'reason' => 'Doctor appointment',
            ])->assertStatus(201);

        $requestId = $submitRes->json('leave_request.id');

        // Self-Approval attempt by Manager (who has leave.approve permission) must FAIL with 403 Forbidden
        $mgrSubmit = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $sickType->id,
                'start_date' => $nextMonday->copy()->addDays(1)->toDateString(),
                'end_date' => $nextMonday->copy()->addDays(1)->toDateString(),
                'day_portion' => 'full',
                'reason' => 'Manager personal day',
            ])->assertStatus(201);
        $mgrRequestId = $mgrSubmit->json('leave_request.id');

        $selfApproveRes = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests/{$mgrRequestId}/approve");

        $selfApproveRes->assertStatus(403)
            ->assertJsonFragment(['message' => 'Separation of Duties violation: You cannot approve your own leave request.']);

        // Legitimate Approval by Manager
        $mgrApproveRes = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests/{$requestId}/approve", [
                'decision_reason' => 'Approved medical absence',
            ]);

        $mgrApproveRes->assertStatus(200)
            ->assertJsonPath('leave_request.status', 'approved');

        // Verify balance deduction ledger entry
        $this->assertDatabaseHas('leave_balance_transactions', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'transaction_type' => 'usage',
            'days' => -1.0,
        ]);

        // Verify attendance record on that date reflects 'on_leave'
        $this->assertDatabaseHas('attendance_records', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'status' => 'on_leave',
        ]);
    }

    public function test_leave_rejection_releases_reserved_balance(): void
    {
        $setup = $this->createCompanySetup();

        $this->actingAs($setup['employee'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/leave/types")
            ->assertStatus(200);

        $casualType = LeaveType::where('company_id', $setup['company']->id)->where('code', 'CL')->firstOrFail();
        $nextMonday = Carbon::now()->next(Carbon::MONDAY);

        $submitRes = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests", [
                'leave_type_id' => $casualType->id,
                'start_date' => $nextMonday->toDateString(),
                'end_date' => $nextMonday->toDateString(),
                'day_portion' => 'full',
                'reason' => 'Personal festival',
            ])->assertStatus(201);

        $requestId = $submitRes->json('leave_request.id');

        // Manager Rejects Request
        $rejectRes = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/leave/requests/{$requestId}/reject", [
                'decision_reason' => 'Critical release on this day',
            ]);

        $rejectRes->assertStatus(200)
            ->assertJsonPath('leave_request.status', 'rejected');

        // Check release transaction exists
        $this->assertDatabaseHas('leave_balance_transactions', [
            'company_id' => $setup['company']->id,
            'membership_id' => $setup['empMembership']->id,
            'transaction_type' => 'release',
            'days' => 1.0,
        ]);
    }

    public function test_attendance_correction_request_and_review_workflow(): void
    {
        $setup = $this->createCompanySetup();

        // Clock in first
        $clockIn = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/clock-in")
            ->assertStatus(201);

        $attRecordId = $clockIn->json('attendance.id');

        // Employee requests correction for missing clock out
        $corrRes = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/corrections", [
                'attendance_record_id' => $attRecordId,
                'proposed_clock_out_at' => Carbon::now()->addHours(8)->toIso8601String(),
                'reason' => 'Forgot to clock out before leaving building',
            ]);

        $corrRes->assertStatus(201)
            ->assertJsonPath('correction.status', 'pending');

        $corrId = $corrRes->json('correction.id');

        // Employee cannot review own correction
        $selfReview = $this->actingAs($setup['employee'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/corrections/{$corrId}/review", [
                'action' => 'approve',
            ]);

        $selfReview->assertStatus(403);

        // Manager reviews and approves correction
        $mgrReview = $this->actingAs($setup['manager'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/attendance/corrections/{$corrId}/review", [
                'action' => 'approve',
                'decision_reason' => 'Badge swipe logs confirmed employee left at 6 PM',
            ]);

        $mgrReview->assertStatus(200)
            ->assertJsonPath('correction.status', 'approved');

        // Ensure correction event was recorded in attendance_events
        $this->assertDatabaseHas('attendance_events', [
            'company_id' => $setup['company']->id,
            'attendance_record_id' => $attRecordId,
            'event_type' => 'correction_applied',
        ]);
    }

    public function test_tenant_isolation_protects_records_across_companies(): void
    {
        $setup1 = $this->createCompanySetup();

        $company2 = Company::create([
            'name' => 'Foreign Company 2',
            'slug' => 'foreign-' . uniqid(),
            'status' => 'active',
        ]);

        // Employee 1 attempts to clock in on Company 2 (they have no membership there)
        $res = $this->actingAs($setup1['employee'])
            ->postJson("/api/v1/companies/{$company2->id}/attendance/clock-in");

        $this->assertTrue(in_array($res->status(), [403, 404]));
    }
}

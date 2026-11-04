<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domain\Attendance\Services\AttendanceAnomalyService;
use App\Domain\Attendance\Services\LeaveLedgerService;
use App\Domain\TimeTracking\Services\TimeIntervalSafetyEngine;
use App\Domain\TimeTracking\Services\TimesheetAggregationService;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

echo "=== M07 & M08: ATTENDANCE, LEAVE LEDGER & OCC TIME ENGINE VERIFICATION ===\n\n";

$company = Company::where('slug', 'bitspark-ops')->firstOrFail();
$ownerMembership = CompanyMembership::where('company_id', $company->id)
    ->whereHas('roles', fn($q) => $q->where('slug', 'company-owner'))
    ->first() ?? CompanyMembership::where('company_id', $company->id)->firstOrFail();

// Second user for SoD dual custody test
$secondaryUser = User::firstOrCreate(
    ['email' => 'supervisor@finovo.internal'],
    ['name' => 'Department Supervisor', 'password' => bcrypt('password123'), 'is_active' => true]
);
$supervisorMembership = CompanyMembership::firstOrCreate(
    ['company_id' => $company->id, 'user_id' => $secondaryUser->id],
    ['status' => 'active', 'joined_at' => now()]
);

// 1. Shift & Attendance Anomaly Detection
echo "1. Testing M07 Shift & Attendance Anomaly Detection... ";
$shift = Shift::firstOrCreate(
    ['company_id' => $company->id, 'name' => 'Standard Engineering Shift'],
    [
        'code' => 'ENG-9-5',
        'timezone' => 'UTC',
        'start_time' => '09:00:00',
        'end_time' => '17:00:00',
        'grace_period_minutes' => 15,
        'break_duration_minutes' => 60,
        'is_overnight' => false,
        'is_active' => true,
    ]
);

$today = Carbon::today()->toDateString();
ShiftAssignment::firstOrCreate(
    [
        'company_id' => $company->id,
        'membership_id' => $ownerMembership->id,
        'shift_id' => $shift->id,
        'effective_from' => $today,
    ]
);

\App\Models\AttendanceRecord::where('company_id', $company->id)
    ->where('membership_id', $ownerMembership->id)
    ->where('work_date', $today)
    ->delete();

$attendanceService = app(AttendanceAnomalyService::class);

// Clock in 30 minutes late (09:30:00)
$lateClockIn = Carbon::parse($today . ' 09:30:00');
$attRecord = $attendanceService->recordClockIn(
    $company->id,
    $ownerMembership->id,
    null,
    $lateClockIn->toIso8601String(),
    'web'
);

// Clock out at 17:00:00
$clockOutTime = Carbon::parse($today . ' 17:00:00');
$closedAttRecord = $attendanceService->recordClockOut(
    $company->id,
    $ownerMembership->id,
    $clockOutTime->toIso8601String(),
    'web'
);

if ($closedAttRecord->status === 'late' && $closedAttRecord->late_seconds > 0 && $closedAttRecord->worked_seconds > 0) {
    echo "Late clock-in detected ({$closedAttRecord->late_seconds}s late, {$closedAttRecord->worked_seconds}s worked) [PASS]\n";
} else {
    echo "FAILED: Anomaly detection failed. Details: " . json_encode($closedAttRecord->toArray()) . "\n";
    exit(1);
}

// 2. Double-Entry Leave Ledger Engine
echo "2. Testing M07 Double-Entry Leave Ledger Engine... ";
$leaveType = LeaveType::firstOrCreate(
    ['company_id' => $company->id, 'name' => 'Annual Paid Leave'],
    ['code' => 'AL', 'is_paid' => true, 'requires_balance' => true, 'is_active' => true]
);

\App\Models\LeaveBalance::where('company_id', $company->id)->where('membership_id', $ownerMembership->id)->delete();
\App\Models\LeaveRequest::where('company_id', $company->id)->where('membership_id', $ownerMembership->id)->delete();
\App\Models\LeaveBalanceTransaction::where('company_id', $company->id)->where('membership_id', $ownerMembership->id)->delete();

$leaveLedger = app(LeaveLedgerService::class);

// Accrue 14 days
$leaveLedger->accrue($company->id, $ownerMembership->id, $leaveType->id, 14.00, 'Annual Allowance 2026');

// Overdraft check: Requesting 50 days must fail
try {
    $leaveLedger->requestLeave($company->id, $ownerMembership->id, $leaveType->id, '2026-07-01', '2026-07-20', 50.00, 'Vacation');
    echo "FAILED: Overdraft allowed unexpectedly!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    // Expected
}

// Request 3 days
$leaveReq = $leaveLedger->requestLeave($company->id, $ownerMembership->id, $leaveType->id, '2026-07-01', '2026-07-03', 3.00, 'Vacation in Tokyo');

$year = (int) date('Y');
$balAfterReq = LeaveBalance::where('company_id', $company->id)
    ->where('membership_id', $ownerMembership->id)
    ->where('leave_type_id', $leaveType->id)
    ->where('year', $year)
    ->first();

if ((float)$balAfterReq->reserved_days === 3.00 && (float)$balAfterReq->available_days === 11.00) {
    echo "Reserved: 3.00 days, Available: 11.00 days [PASS]\n";
} else {
    echo "FAILED: Reservation invariant failed.\n";
    exit(1);
}

// Approve leave request
echo "3. Testing Leave Approval & Outbox Emission... ";
$approvedLeave = $leaveLedger->approveLeave($leaveReq->id, $supervisorMembership->id, 'Have a great trip');
$balAfterApproval = LeaveBalance::where('company_id', $company->id)
    ->where('membership_id', $ownerMembership->id)
    ->where('leave_type_id', $leaveType->id)
    ->where('year', $year)
    ->first();

if ((float)$balAfterApproval->used_days === 3.00 && (float)$balAfterApproval->reserved_days === 0.00) {
    echo "Used: 3.00, Reserved: 0.00, Available: 11.00 [PASS]\n";
} else {
    echo "FAILED: Usage conversion failed.\n";
    exit(1);
}

// 4. M08 Time Tracking Overlap Prevention Engine
echo "4. Testing M08 Mathematical Overlap Prevention... ";
$timeEngine = app(TimeIntervalSafetyEngine::class);

// Clean previous test entries for clean run
TimeEntry::where('company_id', $company->id)->where('membership_id', $ownerMembership->id)->delete();

// Create entry [10:00, 12:00)
$t1_start = Carbon::parse('2026-10-18 10:00:00');
$t1_end = Carbon::parse('2026-10-18 12:00:00');
$timeEngine->validateNoOverlap($company->id, $ownerMembership->id, $t1_start, $t1_end);

$e1 = TimeEntry::create([
    'company_id' => $company->id,
    'membership_id' => $ownerMembership->id,
    'started_at' => $t1_start,
    'ended_at' => $t1_end,
    'duration_seconds' => $t1_end->diffInSeconds($t1_start),
    'source' => 'manual',
    'approval_status' => 'draft',
    'is_billable' => true,
]);

// Attempt to create overlapping entry [11:30, 13:00) - MUST FAIL
try {
    $overlapStart = Carbon::parse('2026-10-18 11:30:00');
    $overlapEnd = Carbon::parse('2026-10-18 13:00:00');
    $timeEngine->validateNoOverlap($company->id, $ownerMembership->id, $overlapStart, $overlapEnd);
    echo "FAILED: Overlapping interval allowed unexpectedly!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "Interval collision blocked correctly [PASS]\n";
}

// Non-overlapping interval [13:00, 15:00) succeeds
$t2_start = Carbon::parse('2026-10-18 13:00:00');
$t2_end = Carbon::parse('2026-10-18 15:00:00');
$timeEngine->validateNoOverlap($company->id, $ownerMembership->id, $t2_start, $t2_end);
$e2 = TimeEntry::create([
    'company_id' => $company->id,
    'membership_id' => $ownerMembership->id,
    'started_at' => $t2_start,
    'ended_at' => $t2_end,
    'duration_seconds' => $t2_end->diffInSeconds($t2_start),
    'source' => 'manual',
    'approval_status' => 'draft',
    'is_billable' => true,
]);
echo "5. Non-overlapping entry inserted safely [PASS]\n";

// 5. M08 Optimistic Locking (OCC) Stopwatch
echo "6. Testing Stopwatch Timer with Optimistic Concurrency Control... ";
$session = $timeEngine->startWorkSession($company->id, $ownerMembership->id);

// Try stopping with stale version (v999) - MUST FAIL
try {
    $timeEngine->stopWorkSession($session->id, 999, 'Testing OCC collision');
    echo "FAILED: Stale OCC version stopped session unexpectedly!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "OCC version mismatch rejected correctly [PASS]\n";
}

// Stop with correct version
$stopResult = $timeEngine->stopWorkSession($session->id, $session->version, 'Completed core architecture review');
if ($stopResult['session']->status === 'stopped' && $stopResult['time_entry']->id) {
    echo "Session stopped cleanly at v{$stopResult['session']->version} [PASS]\n";
} else {
    echo "FAILED: Session stop failed.\n";
    exit(1);
}

// 6. Timesheet Maker-Checker Separation of Duties
echo "7. Testing Timesheet SoD & Period Approval Locking... ";
$timesheetService = app(TimesheetAggregationService::class);
$timesheet = $timesheetService->getOrCreateTimesheet(
    $company->id,
    $ownerMembership->id,
    '2026-10-12',
    '2026-10-18'
);

$submittedTimesheet = $timesheetService->submitTimesheet($timesheet);

// Attempting self-approval by submitter MUST FAIL
try {
    $timesheetService->approveTimesheet($submittedTimesheet, $ownerMembership->id);
    echo "FAILED: Self-approval allowed unexpectedly without Separation of Duties!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "Self-approval blocked by SoD policy [PASS]\n";
}

// Approval by supervisor succeeds
$approvedTimesheet = $timesheetService->approveTimesheet($submittedTimesheet, $supervisorMembership->id, 'All hours verified against deliverables');
if ($approvedTimesheet->status === 'approved' && $approvedTimesheet->approved_at !== null) {
    echo "Timesheet approved by supervisor and locked for payroll [PASS]\n";
} else {
    echo "FAILED: Supervisor approval failed.\n";
    exit(1);
}

echo "\n>>> ALL M07 & M08 ACCEPTANCE CHECKS PASSED PERFECTLY <<<\n";

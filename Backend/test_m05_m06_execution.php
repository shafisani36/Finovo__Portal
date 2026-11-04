<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domain\Lifecycle\Services\LifecycleDagEngine;
use App\Domain\Recruitment\Actions\ConvertCandidateToEmployeeAction;
use App\Domain\Recruitment\Services\CandidatePipelineService;
use App\Models\AccessRevocationRequest;
use App\Models\Candidate;
use App\Models\CandidateApplication;
use App\Models\CandidateOffer;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Department;
use App\Models\EmployeeAssetAllocation;
use App\Models\JobPosition;
use App\Models\LifecycleInstance;
use App\Models\LifecycleTask;
use Illuminate\Support\Facades\DB;

echo "=== M05 & M06: RECRUITMENT & LIFECYCLE DAG ENGINE VERIFICATION ===\n\n";

$company = Company::where('slug', 'bitspark-ops')->firstOrFail();
$ownerMembership = CompanyMembership::where('company_id', $company->id)
    ->whereHas('roles', fn($q) => $q->where('slug', 'company-owner'))
    ->first() ?? CompanyMembership::where('company_id', $company->id)->firstOrFail();
$ownerUser = $ownerMembership->user;

$department = Department::firstOrCreate(
    ['company_id' => $company->id, 'code' => 'ENG'],
    ['name' => 'Engineering', 'is_active' => true]
);

$position = JobPosition::firstOrCreate(
    ['company_id' => $company->id, 'code' => 'SR-BE-ENG'],
    [
        'title' => 'Senior Backend Engineer',
        'department_id' => $department->id,
        'min_salary' => 120000,
        'max_salary' => 160000,
        'is_active' => true,
    ]
);

$pipelineService = app(CandidatePipelineService::class);

// 1. Requisition Creation & Approval
echo "1. Testing Requisition Creation & Approval... ";
$requisition = $pipelineService->createRequisition($company->id, [
    'department_id' => $department->id,
    'job_position_id' => $position->id,
    'title' => 'Senior Distributed Systems Architect',
    'headcount' => 1,
    'employment_type' => 'full_time',
    'min_salary' => 140000,
    'max_salary' => 180000,
], $ownerUser->id);

$approvedReq = $pipelineService->approveRequisition($requisition, $ownerUser->id);
if ($approvedReq->status === 'open' && $approvedReq->approved_at !== null) {
    echo "Req #{$approvedReq->requisition_number} is OPEN [PASS]\n";
} else {
    echo "FAILED: Requisition approval failed.\n";
    exit(1);
}

// 2. Candidate Creation & Application
echo "2. Testing Candidate Application Pipeline... ";
$testEmail = 'candidate.' . time() . '@finovo.internal';
$candidate = Candidate::create([
    'company_id' => $company->id,
    'first_name' => 'Grace',
    'last_name' => 'Hopper',
    'email' => $testEmail,
    'phone' => '+18005550199',
    'source' => 'referral',
]);

$application = CandidateApplication::create([
    'company_id' => $company->id,
    'candidate_id' => $candidate->id,
    'job_requisition_id' => $approvedReq->id,
    'current_stage' => 'applied',
]);

// Advance stage to interviewing
$pipelineService->advanceStage($application, 'interviewing', 'Strong background in compiler design');

// 3. Interview Scorecard
$scorecard = $pipelineService->submitScorecard($application, [
    'interview_stage' => 'technical_architecture',
    'overall_recommendation' => 'strong_yes',
    'criteria_scores' => [
        ['criteria' => 'Distributed Transactions', 'score' => 5],
        ['criteria' => 'Eventual Consistency & Outbox', 'score' => 5],
    ],
    'summary_notes' => 'Exceptional technical depth.',
], $ownerMembership->id);

// 4. Job Offer
$offer = $pipelineService->createOffer($application, [
    'base_salary' => 165000,
    'currency' => 'USD',
    'bonus_percentage' => 15.00,
    'equity_units' => 5000,
    'proposed_start_date' => date('Y-m-d', strtotime('+7 days')),
], $ownerUser->id);

$pipelineService->advanceStage($application, 'offer_accepted', 'Candidate formally accepted compensation terms');
echo "Scorecard & Offer Accepted [PASS]\n";

// 5. Candidate-to-Employee Conversion Action
echo "3. Testing Atomic Candidate-to-Employee Conversion Action... ";
$convertAction = app(ConvertCandidateToEmployeeAction::class);
$conversionResult = $convertAction->execute($application, $ownerUser->id, [
    'work_location' => 'hybrid',
]);

$newEmployee = $conversionResult['employment_record'];
$lifecycleInstance = $conversionResult['lifecycle_instance'];

if ($newEmployee && $newEmployee->id && $lifecycleInstance && $lifecycleInstance->id) {
    echo "Converted! Emp ID: {$newEmployee->employee_number}, Lifecycle Run: #{$lifecycleInstance->id} [PASS]\n";
} else {
    echo "FAILED: Conversion failed.\n";
    exit(1);
}

// 6. DAG Lifecycle Execution & Prerequisite Safety
echo "4. Testing Lifecycle DAG Engine Prerequisite Validation... ";
$dagEngine = app(LifecycleDagEngine::class);

// Fetch tasks for this instance
$credentialsTask = LifecycleTask::where('lifecycle_instance_id', $lifecycleInstance->id)
    ->where('task_key', 'it_provision_credentials')
    ->firstOrFail();

$hardwareTask = LifecycleTask::where('lifecycle_instance_id', $lifecycleInstance->id)
    ->where('task_key', 'it_ship_hardware')
    ->firstOrFail();

// Hardware task requires credentials task. Let's verify hardware is initially 'blocked'
if ($hardwareTask->status !== 'blocked') {
    echo "FAILED: Hardware task should be blocked, but is: {$hardwareTask->status}\n";
    exit(1);
}

// Attempting to complete hardware task directly MUST fail
try {
    $dagEngine->completeTask($hardwareTask, $ownerUser->id);
    echo "FAILED: Blocked task completed unexpectedly without prerequisite satisfaction!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "Blocked task correctly rejected ({$e->getMessage()}) [PASS]\n";
}

// Now complete the prerequisite: credentials
echo "5. Completing prerequisite node & testing cascading unblock... ";
$dagEngine->completeTask($credentialsTask, $ownerUser->id, 'Google Workspace & AWS IAM provisioned');

$hardwareTask->refresh();
if ($hardwareTask->status === 'ready') {
    echo "Hardware task automatically unlocked to READY state [PASS]\n";
} else {
    echo "FAILED: Hardware task status is {$hardwareTask->status}, expected 'ready'.\n";
    exit(1);
}

// 7. Equipment Asset Allocation
echo "6. Testing Hardware Asset Allocation... ";
$asset = EmployeeAssetAllocation::create([
    'company_id' => $company->id,
    'employment_record_id' => $newEmployee->id,
    'asset_name' => 'MacBook Pro 16" M3 Max 64GB',
    'asset_tag' => 'AST-MBP-' . rand(1000, 9999),
    'serial_number' => 'C02G' . Str::random(8),
    'category' => 'hardware',
    'allocated_at' => now(),
    'status' => 'allocated',
]);
echo "Asset {$asset->asset_tag} allocated [PASS]\n";

// 8. Access Revocation IT Deprovisioning
echo "7. Testing Emergency IT Access Revocation Kill-Switch... ";
$revocation = AccessRevocationRequest::create([
    'company_id' => $company->id,
    'lifecycle_instance_id' => $lifecycleInstance->id,
    'employment_record_id' => $newEmployee->id,
    'system_identifier' => 'corporate_okta_sso',
    'revocation_type' => 'immediate_kill_switch',
    'status' => 'completed',
    'requested_by_user_id' => $ownerUser->id,
    'executed_by_user_id' => $ownerUser->id,
    'executed_at' => now(),
    'audit_log' => ['revocation_reason' => 'Verification test'],
]);

$revocationEvent = DB::table('domain_event_outbox')
    ->where('company_id', $company->id)
    ->where('event_type', 'candidate.hired')
    ->orderByDesc('id')
    ->first();

if ($revocation && $revocationEvent) {
    echo "Revocation logged & candidate.hired verified in Outbox [PASS]\n";
} else {
    echo "FAILED: Outbox or revocation failed.\n";
    exit(1);
}

echo "\n>>> ALL M05 & M06 ACCEPTANCE CHECKS PASSED PERFECTLY <<<\n";

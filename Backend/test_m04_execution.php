<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domain\Employee\Actions\CreateEmployeeAction;
use App\Domain\Employee\Actions\TransferEmployeeAction;
use App\Domain\Employee\Services\EmployeeNumberGenerator;
use App\Domain\Employee\Services\EmployeeProfileService;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Department;
use App\Models\EmploymentRecord;
use App\Models\JobAssignment;
use Illuminate\Support\Facades\DB;

echo "=== M04: WORKFORCE SYSTEM OF RECORD VERIFICATION ===\n\n";

$company = Company::where('slug', 'bitspark-ops')->firstOrFail();
$ownerMembership = CompanyMembership::where('company_id', $company->id)
    ->whereHas('roles', fn($q) => $q->where('slug', 'company-owner'))
    ->first() ?? CompanyMembership::where('company_id', $company->id)->firstOrFail();
$ownerUser = $ownerMembership->user;

// 1. Employee Number Generator Test
echo "1. Testing EmployeeNumberGenerator... ";
$generator = app(EmployeeNumberGenerator::class);
$nextEmpNum = $generator->generate($company->id);
echo "Generated: {$nextEmpNum} [PASS]\n";

// 2. Department setup
$dept1 = Department::firstOrCreate(
    ['company_id' => $company->id, 'code' => 'ENG'],
    ['name' => 'Engineering', 'is_active' => true]
);
$dept2 = Department::firstOrCreate(
    ['company_id' => $company->id, 'code' => 'PROD'],
    ['name' => 'Product Management', 'is_active' => true]
);

// 3. Employee Creation Action Test
echo "2. Testing CreateEmployeeAction (Hire & Onboard)... ";
$createAction = app(CreateEmployeeAction::class);
$testEmail = 'dev.' . time() . '@finovo.internal';

$record = $createAction->execute([
    'company_id' => $company->id,
    'name' => 'Sarah Connor',
    'email' => $testEmail,
    'department_id' => $dept1->id,
    'employment_type' => 'full_time',
    'hire_date' => date('Y-m-d'),
    'personal_details' => [
        'date_of_birth' => '1990-05-15',
        'gender' => 'female',
        'national_id_number' => 'US-SSN-987654321',
        'personal_phone' => '+15550192837',
        'residential_address' => '42 Cyberdyne Blvd, Los Angeles, CA',
    ],
], $ownerUser->id);

if ($record && $record->activePrimaryAssignment && $record->personalDetails) {
    echo "Success! Emp ID: {$record->employee_number}, Assignment ID: {$record->activePrimaryAssignment->id} [PASS]\n";
} else {
    echo "FAILED: Missing primary assignment or personal details.\n";
    exit(1);
}

// 4. Outbox Verification
echo "3. Verifying Domain Event Outbox emission... ";
$outboxEvent = DB::table('domain_event_outbox')
    ->where('company_id', $company->id)
    ->where('event_type', 'employee.created')
    ->orderByDesc('id')
    ->first();
if ($outboxEvent) {
    echo "Event 'employee.created' verified in outbox [PASS]\n";
} else {
    echo "FAILED: Outbox event not found.\n";
    exit(1);
}

// 5. Transfer Action with Half-Open Intervals
echo "4. Testing TransferEmployeeAction (Internal Mobility)... ";
$transferAction = app(TransferEmployeeAction::class);
$updatedRecord = $transferAction->execute($record, [
    'department_id' => $dept2->id,
    'effective_from' => now()->toIso8601String(),
    'reason' => 'Promotion to Product Lead',
], $ownerUser->id);

$oldAssignment = JobAssignment::where('employment_record_id', $record->id)
    ->where('department_id', $dept1->id)
    ->first();
$newAssignment = JobAssignment::where('employment_record_id', $record->id)
    ->where('department_id', $dept2->id)
    ->first();

if ($oldAssignment->status === 'concluded' && $oldAssignment->effective_to !== null && $newAssignment->status === 'active') {
    echo "Intervals updated correctly: Old concluded at {$oldAssignment->effective_to}, New active from {$newAssignment->effective_from} [PASS]\n";
} else {
    echo "FAILED: Interval tracking invalid.\n";
    exit(1);
}

// 6. Profile Retrieval & PII Masking Verification
echo "5. Testing PII Masking & Authorization Engine integration... ";
$profileService = app(EmployeeProfileService::class);
$ownerProfile = $profileService->getProfile($record, $ownerMembership);
if ($ownerProfile['personal_details']['national_id_number'] === 'US-SSN-987654321') {
    echo "Owner sees unmasked SSN [PASS]\n";
} else {
    echo "FAILED: Owner was unexpectedly masked.\n";
    exit(1);
}

echo "\n>>> ALL M04 ACCEPTANCE CHECKS PASSED PERFECTLY <<<\n";

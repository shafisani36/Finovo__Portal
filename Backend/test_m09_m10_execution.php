<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Domain\Payroll\Actions\ApprovePayrollRunAction;
use App\Domain\Payroll\Actions\FinalizePayrollRunAction;
use App\Domain\Payroll\Actions\PreparePayrollRunAction;
use App\Domain\Performance\Services\SkillsGapAnalysisService;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompensationPackage;
use App\Models\EmploymentRecord;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\User;
use Illuminate\Support\Facades\DB;

echo "=== M09 & M10: DETERMINISTIC PAYROLL & PERFORMANCE ENGINE VERIFICATION ===\n\n";

$company = Company::where('slug', 'bitspark-ops')->firstOrFail();
$ownerMembership = CompanyMembership::where('company_id', $company->id)
    ->whereHas('roles', fn($q) => $q->where('slug', 'company-owner'))
    ->first() ?? CompanyMembership::where('company_id', $company->id)->firstOrFail();
$ownerUser = $ownerMembership->user;

// Second user for SoD Maker-Checker
$checkerUser = User::firstOrCreate(
    ['email' => 'auditor@finovo.internal'],
    ['name' => 'Compliance Auditor', 'password' => bcrypt('password123'), 'is_active' => true]
);

$employee = EmploymentRecord::where('company_id', $company->id)
    ->where('status', 'active')
    ->firstOrFail();

// 1. Setup Compensation Package with DECIMAL(19,4)
echo "1. Configuring Compensation Package (DECIMAL 19,4)... ";
CompensationPackage::where('employment_record_id', $employee->id)->delete();
$compPackage = CompensationPackage::create([
    'company_id' => $company->id,
    'employment_record_id' => $employee->id,
    'currency' => 'USD',
    'base_salary' => '10000.0000',
    'pay_frequency' => 'monthly',
    'components' => [
        ['code' => 'REMOTE_STIPEND', 'name' => 'Remote Work Stipend', 'amount' => '500.0000', 'is_taxable' => true],
    ],
    'effective_from' => '2026-01-01',
    'effective_to' => null,
    'is_active' => true,
]);
echo "Base Salary: $10,000.0000, Stipend: $500.0000 [PASS]\n";

// 2. Prepare Payroll Run
echo "2. Testing Deterministic Payroll Calculation... ";
$prepareAction = app(PreparePayrollRunAction::class);
$run = PayrollRun::create([
    'company_id' => $company->id,
    'run_number' => 'PAY-2026-10-TEST',
    'period_start' => '2026-10-01',
    'period_end' => '2026-10-31',
    'pay_date' => '2026-10-31',
    'currency' => 'USD',
    'status' => 'draft',
    'prepared_by_user_id' => $ownerUser->id,
]);

$calculatedRun = $prepareAction->execute($run, $ownerUser->id);

// Verify exact math:
// Gross = 10,000 + 500 = 10,500.0000
// Tax = 10,500 * 0.15 = 1,575.0000
// Pension EE = 10,000 * 0.05 = 500.0000
// Total Deductions = 2,075.0000
// Net = 10,500 - 2,075 = 8,425.0000
// Pension ER = 10,000 * 0.05 = 500.0000

$empPayslip = Payslip::where('payroll_run_id', $calculatedRun->id)
    ->where('employment_record_id', $employee->id)
    ->first();

if (
    bccomp($empPayslip->gross_pay, '10500.0000', 4) === 0 &&
    bccomp($empPayslip->total_deductions, '2075.0000', 4) === 0 &&
    bccomp($empPayslip->net_pay, '8425.0000', 4) === 0
) {
    echo "Exact match: Gross $10,500.0000, Deductions $2,075.0000, Net $8,425.0000 [PASS]\n";
} else {
    echo "FAILED: Math discrepancy: Gross {$empPayslip->gross_pay}, Deductions {$empPayslip->total_deductions}, Net {$empPayslip->net_pay}\n";
    exit(1);
}

// 3. Maker-Checker SoD Verification
echo "3. Testing Payroll Maker-Checker Dual-Custody Enforcement... ";
$approveAction = app(ApprovePayrollRunAction::class);

// Preparer attempting self-approval MUST FAIL
try {
    $approveAction->execute($calculatedRun, $ownerUser->id);
    echo "FAILED: Self-approval allowed unexpectedly without SoD check!\n";
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "Self-approval blocked by SoD policy [PASS]\n";
}

// Checker user approves
echo "4. Approving run by independent checker... ";
$approvedRun = $approveAction->execute($calculatedRun, $checkerUser->id);
if ($approvedRun->status === 'approved' && $approvedRun->approved_by_user_id === $checkerUser->id) {
    echo "Approved cleanly [PASS]\n";
} else {
    echo "FAILED: Approval failed.\n";
    exit(1);
}

// 4. Finalize & Publish Payslips
echo "5. Testing Finalization & Payslip Publishing... ";
$finalizeAction = app(FinalizePayrollRunAction::class);
$finalizedRun = $finalizeAction->execute($approvedRun, $checkerUser->id);

$publishedPayslip = Payslip::where('payroll_run_id', $finalizedRun->id)
    ->where('employment_record_id', $employee->id)
    ->first();

if ($finalizedRun->status === 'finalized' && $publishedPayslip->status === 'published' && $publishedPayslip->published_at !== null) {
    echo "Payslip #{$publishedPayslip->payslip_number} published to employee [PASS]\n";
} else {
    echo "FAILED: Finalization failed.\n";
    exit(1);
}

// 5. M10 Skills Gap Analysis
echo "6. Testing M10 Skills-Gap Analysis Engine... ";
$skillsService = app(SkillsGapAnalysisService::class);

$a1 = $skillsService->assessEmployee(
    $company->id,
    $employee->id,
    'Distributed Architecture',
    3, // current
    5, // target
    null,
    'Demonstrated strong proficiency in outbox pattern and domain modeling'
);

$a2 = $skillsService->assessEmployee(
    $company->id,
    $employee->id,
    'Database Sharding & Partitioning',
    2, // current
    4, // target
    null,
    'Needs advanced production workload exposure'
);

if ($a1->gap_score === 2 && $a2->gap_score === 2) {
    echo "Gap scores computed accurately (Target - Current) [PASS]\n";
} else {
    echo "FAILED: Gap score calculation invalid.\n";
    exit(1);
}

// Organization Matrix
$matrix = $skillsService->getOrganizationSkillsGapMatrix($company->id);
if (!empty($matrix)) {
    echo "7. Organization skills gap matrix generated across " . count($matrix) . " competencies [PASS]\n";
} else {
    echo "FAILED: Empty skills gap matrix.\n";
    exit(1);
}

// Weighted Rubric Scoring
$weightedScore = $skillsService->calculateWeightedScore(
    ['architecture' => 4.5, 'delivery' => 4.0, 'mentorship' => 3.5],
    ['architecture' => 40, 'delivery' => 40, 'mentorship' => 20]
);
// Expected: (4.5*40 + 4.0*40 + 3.5*20) / 100 = (180 + 160 + 70) / 100 = 410 / 100 = 4.10
if ($weightedScore === 4.10) {
    echo "8. Weighted rubric scoring verified (4.10/5.00) [PASS]\n";
} else {
    echo "FAILED: Weighted score returned {$weightedScore}, expected 4.10.\n";
    exit(1);
}

echo "\n>>> ALL M09 & M10 ACCEPTANCE CHECKS PASSED PERFECTLY <<<\n";

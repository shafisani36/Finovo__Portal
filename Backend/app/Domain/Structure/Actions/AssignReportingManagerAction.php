<?php

namespace App\Domain\Structure\Actions;

use App\Domain\Structure\Services\HierarchyCycleDetectionService;
use App\Models\Company;
use App\Models\ReportingRelationship;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssignReportingManagerAction
{
    public function __construct(
        protected HierarchyCycleDetectionService $cycleDetector
    ) {}

    /**
     * Assigns primary or secondary reporting relationship with cycle detection and effective intervals
     */
    public function execute(
        Company $company,
        int $employeeId,
        int $managerId,
        string $relationshipType = 'primary',
        User $actor = null
    ): ReportingRelationship {
        return DB::transaction(function () use ($company, $employeeId, $managerId, $relationshipType, $actor) {
            // Cycle check
            $this->cycleDetector->assertNoReportingCycle($company->id, $employeeId, $managerId);

            $now = now();

            // If primary manager, close any existing active primary reporting link
            if ($relationshipType === 'primary') {
                ReportingRelationship::where('company_id', $company->id)
                    ->where('employee_id', $employeeId)
                    ->where('relationship_type', 'primary')
                    ->where(function ($q) use ($now) {
                        $q->whereNull('effective_to')->orWhere('effective_to', '>', $now);
                    })
                    ->update(['effective_to' => $now]);
            }

            return ReportingRelationship::create([
                'company_id' => $company->id,
                'employee_id' => $employeeId,
                'manager_id' => $managerId,
                'relationship_type' => $relationshipType,
                'effective_from' => $now,
                'effective_to' => null,
            ]);
        });
    }
}

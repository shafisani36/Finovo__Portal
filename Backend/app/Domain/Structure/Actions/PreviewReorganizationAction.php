<?php

namespace App\Domain\Structure\Actions;

use App\Domain\Structure\Exceptions\DepartmentHierarchyCycleException;
use App\Domain\Structure\Services\HierarchyCycleDetectionService;
use App\Models\Company;
use App\Models\Department;

class PreviewReorganizationAction
{
    public function __construct(
        protected HierarchyCycleDetectionService $cycleDetector
    ) {}

    /**
     * Simulates proposed reorganization and calculates downstream impact without committing changes
     */
    public function execute(Company $company, int $departmentId, ?int $proposedParentId): array
    {
        $department = Department::where('company_id', $company->id)->where('id', $departmentId)->firstOrFail();

        $cycleDetected = false;
        $cycleError = null;

        try {
            $this->cycleDetector->assertNoDepartmentCycle($company->id, $departmentId, $proposedParentId);
        } catch (DepartmentHierarchyCycleException $e) {
            $cycleDetected = true;
            $cycleError = $e->getMessage();
        }

        // Count descendant subdepartments
        $descendantIds = $this->collectDescendants($company->id, $departmentId);

        $impactedDeptsCount = count($descendantIds) + 1; // self + children
        $impactedEmployeesCount = \App\Models\EmployeeProfile::whereIn('department_id', array_merge([$departmentId], $descendantIds))->count();

        $proposedParent = null;
        if ($proposedParentId) {
            $parent = Department::find($proposedParentId);
            $proposedParent = $parent ? ['id' => $parent->id, 'name' => $parent->name, 'code' => $parent->code] : null;
        }

        return [
            'department_id' => $department->id,
            'department_name' => $department->name,
            'current_parent_id' => $department->parent_department_id,
            'proposed_parent' => $proposedParent,
            'is_valid' => !$cycleDetected,
            'cycle_detected' => $cycleDetected,
            'validation_error' => $cycleError,
            'impact' => [
                'impacted_departments_count' => $impactedDeptsCount,
                'impacted_employees_count' => $impactedEmployeesCount,
                'descendant_department_ids' => $descendantIds,
            ],
        ];
    }

    private function collectDescendants(int $companyId, int $departmentId): array
    {
        $childIds = Department::where('company_id', $companyId)
            ->where('parent_department_id', $departmentId)
            ->pluck('id')
            ->all();

        $allDescendants = $childIds;
        foreach ($childIds as $childId) {
            $allDescendants = array_merge($allDescendants, $this->collectDescendants($companyId, $childId));
        }

        return $allDescendants;
    }
}

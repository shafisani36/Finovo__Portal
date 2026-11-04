<?php

namespace App\Domain\Structure\Services;

use App\Domain\Structure\Exceptions\DepartmentHierarchyCycleException;
use App\Domain\Structure\Exceptions\ReportingHierarchyCycleException;
use App\Models\Department;
use App\Models\ReportingRelationship;

class HierarchyCycleDetectionService
{
    /**
     * Verifies that setting proposedParentId as the parent of departmentId will not create a circular dependency
     *
     * @throws DepartmentHierarchyCycleException
     */
    public function assertNoDepartmentCycle(int $companyId, int $departmentId, ?int $proposedParentId): void
    {
        if ($proposedParentId === null) {
            return; // Root department creates no cycle
        }

        if ($departmentId === $proposedParentId) {
            throw new DepartmentHierarchyCycleException("A department cannot be its own parent.");
        }

        // Traverse upwards from proposed parent to root
        $visited = [$departmentId => true];
        $currentParentId = $proposedParentId;

        while ($currentParentId !== null) {
            if (isset($visited[$currentParentId])) {
                throw new DepartmentHierarchyCycleException("Cycle detected: Proposed parent department #{$proposedParentId} is a descendant of department #{$departmentId}.");
            }

            $visited[$currentParentId] = true;

            $parentDept = Department::where('company_id', $companyId)
                ->where('id', $currentParentId)
                ->select('id', 'parent_department_id')
                ->first();

            $currentParentId = $parentDept?->parent_department_id;
        }
    }

    /**
     * Verifies that assigning proposedManagerId as manager of employeeId will not create a circular reporting graph
     *
     * @throws ReportingHierarchyCycleException
     */
    public function assertNoReportingCycle(int $companyId, int $employeeId, int $proposedManagerId): void
    {
        if ($employeeId === $proposedManagerId) {
            throw new ReportingHierarchyCycleException("An employee cannot report to themselves.");
        }

        $visited = [$employeeId => true];
        $currentManagerId = $proposedManagerId;

        while ($currentManagerId !== null) {
            if (isset($visited[$currentManagerId])) {
                throw new ReportingHierarchyCycleException("Reporting cycle detected: Proposed manager #{$proposedManagerId} already reports to employee #{$employeeId}.");
            }

            $visited[$currentManagerId] = true;

            $link = ReportingRelationship::where('company_id', $companyId)
                ->where('employee_id', $currentManagerId)
                ->where('relationship_type', 'primary')
                ->where(function ($q) {
                    $now = now();
                    $q->whereNull('effective_to')->orWhere('effective_to', '>', $now);
                })
                ->first();

            $currentManagerId = $link?->manager_id;
        }
    }
}

<?php

namespace App\Domain\Structure\Services;

use App\Models\Company;
use App\Models\Department;
use Illuminate\Support\Collection;

class OrganizationChartService
{
    /**
     * Builds a complete, recursive organizational topology tree
     */
    public function buildChart(Company $company, ?string $search = null, int $maxDepth = 10): array
    {
        $departments = Department::where('company_id', $company->id)
            ->where('status', 'active')
            ->with([
                'manager.user',
                'costCenter',
                'teams' => fn ($q) => $q->where('status', 'active'),
                'jobPositions' => fn ($q) => $q->where('status', 'active'),
            ])
            ->withCount(['members', 'employeeProfiles', 'childDepartments'])
            ->get();

        // Index departments by parent
        $byParent = [];
        foreach ($departments as $dept) {
            $parentId = $dept->parent_department_id ?? 0;
            $byParent[$parentId][] = $dept;
        }

        // Build recursive tree starting from root (parentId = 0)
        $roots = $byParent[0] ?? [];
        $tree = [];

        foreach ($roots as $rootDept) {
            $tree[] = $this->formatNode($rootDept, $byParent, 1, $maxDepth, $search);
        }

        return [
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
            ],
            'total_departments' => $departments->count(),
            'total_positions' => $departments->sum(fn ($d) => $d->jobPositions->count()),
            'total_headcount_capacity' => $departments->sum(fn ($d) => $d->jobPositions->sum('headcount_allowance')),
            'chart' => $tree,
        ];
    }

    private function formatNode(
        Department $dept,
        array &$byParent,
        int $currentDepth,
        int $maxDepth,
        ?string $search
    ): array {
        $children = [];
        if ($currentDepth < $maxDepth && isset($byParent[$dept->id])) {
            foreach ($byParent[$dept->id] as $childDept) {
                $children[] = $this->formatNode($childDept, $byParent, $currentDepth + 1, $maxDepth, $search);
            }
        }

        $managerName = $dept->manager?->user?->name ?? 'Unassigned';
        $managerEmail = $dept->manager?->user?->email ?? null;

        $isMatch = empty($search) ||
            str_contains(strtolower($dept->name), strtolower($search)) ||
            str_contains(strtolower($dept->code ?? ''), strtolower($search)) ||
            str_contains(strtolower($managerName), strtolower($search));

        return [
            'id' => $dept->id,
            'name' => $dept->name,
            'code' => $dept->code,
            'description' => $dept->description,
            'parent_department_id' => $dept->parent_department_id,
            'manager' => [
                'id' => $dept->manager_membership_id,
                'name' => $managerName,
                'email' => $managerEmail,
            ],
            'cost_center' => $dept->costCenter ? [
                'id' => $dept->costCenter->id,
                'code' => $dept->costCenter->code,
                'name' => $dept->costCenter->name,
            ] : null,
            'depth' => $currentDepth,
            'members_count' => $dept->members_count,
            'active_employees_count' => $dept->employee_profiles_count,
            'open_positions_count' => $dept->jobPositions->count(),
            'teams_count' => $dept->teams->count(),
            'teams' => $dept->teams->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'code' => $t->code,
            ])->values()->all(),
            'is_search_match' => $isMatch,
            'children' => $children,
        ];
    }
}

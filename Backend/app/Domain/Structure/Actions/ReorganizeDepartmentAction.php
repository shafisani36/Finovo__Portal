<?php

namespace App\Domain\Structure\Actions;

use App\Domain\Structure\Events\DepartmentReorganized;
use App\Domain\Structure\Services\HierarchyCycleDetectionService;
use App\Models\Company;
use App\Models\Department;
use App\Models\OrganizationStructureVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReorganizeDepartmentAction
{
    public function __construct(
        protected HierarchyCycleDetectionService $cycleDetector
    ) {}

    /**
     * Reorganizes department under a new parent with strict cycle detection and version snapshotting
     */
    public function execute(Company $company, int $departmentId, ?int $newParentId, User $actor): Department
    {
        return DB::transaction(function () use ($company, $departmentId, $newParentId, $actor) {
            $department = Department::where('company_id', $company->id)->where('id', $departmentId)->firstOrFail();

            if ($newParentId !== null) {
                // Ensure new parent belongs to same company
                Department::where('company_id', $company->id)->where('id', $newParentId)->firstOrFail();
            }

            // 1. Cycle Detection DFS Guard
            $this->cycleDetector->assertNoDepartmentCycle($company->id, $departmentId, $newParentId);

            $oldParentId = $department->parent_department_id;

            // 2. Apply movement
            $department->update([
                'parent_department_id' => $newParentId,
            ]);

            // 3. Domain Event Outbox
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'event_type' => DepartmentReorganized::class,
                'schema_version' => 1,
                'company_id' => $company->id,
                'correlation_id' => (string) Str::uuid(),
                'producer' => 'm02_org_structure',
                'payload' => json_encode([
                    'department_id' => $department->id,
                    'department_name' => $department->name,
                    'old_parent_id' => $oldParentId,
                    'new_parent_id' => $newParentId,
                    'reorganized_by_user_id' => $actor->id,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 4. Create versioned structure snapshot for audit & simulation
            $lastVersion = OrganizationStructureVersion::where('company_id', $company->id)->max('version_number') ?? 0;
            $newVersionNumber = $lastVersion + 1;

            $allDepts = Department::where('company_id', $company->id)
                ->select('id', 'name', 'code', 'parent_department_id', 'status')
                ->get()
                ->toArray();

            OrganizationStructureVersion::create([
                'company_id' => $company->id,
                'version_number' => $newVersionNumber,
                'snapshot' => [
                    'trigger' => 'department.reorganized',
                    'department_id' => $department->id,
                    'old_parent_id' => $oldParentId,
                    'new_parent_id' => $newParentId,
                    'departments' => $allDepts,
                ],
                'published_by_user_id' => $actor->id,
                'published_at' => now(),
            ]);

            return $department->fresh(['parentDepartment', 'childDepartments']);
        });
    }
}

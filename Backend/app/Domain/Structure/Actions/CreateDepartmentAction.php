<?php

namespace App\Domain\Structure\Actions;

use App\Domain\Structure\Services\HierarchyCycleDetectionService;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateDepartmentAction
{
    public function __construct(
        protected HierarchyCycleDetectionService $cycleDetector
    ) {}

    /**
     * Atomically creates a department within the organization topology
     */
    public function execute(Company $company, array $data, User $actor): Department
    {
        return DB::transaction(function () use ($company, $data, $actor) {
            $parentId = !empty($data['parent_department_id']) ? (int)$data['parent_department_id'] : null;

            if ($parentId !== null) {
                // Verify parent belongs to same company
                Department::where('company_id', $company->id)->where('id', $parentId)->firstOrFail();
            }

            $code = !empty($data['code']) ? strtoupper(trim((string)$data['code'])) : strtoupper(Str::slug($data['name']));

            $department = Department::create([
                'company_id' => $company->id,
                'name' => trim((string)$data['name']),
                'code' => $code,
                'description' => $data['description'] ?? null,
                'manager_membership_id' => !empty($data['manager_membership_id']) ? (int)$data['manager_membership_id'] : null,
                'parent_department_id' => $parentId,
                'cost_center_id' => !empty($data['cost_center_id']) ? (int)$data['cost_center_id'] : null,
                'status' => 'active',
                'effective_from' => now(),
            ]);

            DB::table('security_audit_events')->insert([
                'actor_user_id' => $actor->id,
                'company_id' => $company->id,
                'event_type' => 'department.created',
                'target_type' => Department::class,
                'target_id' => (string)$department->id,
                'metadata' => json_encode([
                    'department_name' => $department->name,
                    'department_code' => $department->code,
                    'parent_department_id' => $parentId,
                ]),
                'created_at' => now(),
            ]);

            return $department->load(['manager.user', 'parentDepartment', 'costCenter']);
        });
    }
}

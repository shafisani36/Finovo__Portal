<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    public function index(Request $request, Company $company): JsonResponse
    {
        $departments = Department::where('company_id', $company->id)
            ->with(['manager.user', 'parentDepartment'])
            ->withCount(['members', 'employeeProfiles', 'employmentRecords'])
            ->orderBy('name')
            ->get()
            ->map(function ($dept) {
                // Ensure employee_profiles_count reflects either employeeProfiles or employmentRecords
                $effectiveCount = max($dept->employee_profiles_count ?? 0, $dept->employment_records_count ?? 0, $dept->members_count ?? 0);
                $dept->employee_profiles_count = $effectiveCount;
                return $dept;
            });

        return response()->json([
            'departments' => $departments,
        ]);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('departments', 'name')->where('company_id', $company->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')
                    ->where('company_id', $company->id)
                    ->where('status', 'active'),
            ],
            'parent_department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'status' => ['nullable', 'string', 'in:active,archived,draft'],
        ]);

        $department = Department::create([
            'company_id' => $company->id,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'manager_membership_id' => $validated['manager_membership_id'] ?? null,
            'parent_department_id' => $validated['parent_department_id'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        SecurityAuditEvent::record('department.created', $request->user()->id, $company->id, 'department', (string) $department->id, [
            'name' => $department->name,
        ]);

        return response()->json([
            'message' => 'Department created successfully.',
            'department' => $department->load(['manager.user', 'parentDepartment']),
        ], 201);
    }

    public function show(Request $request, Company $company, Department $department): JsonResponse
    {
        if ($department->company_id !== $company->id) {
            return response()->json(['message' => 'Department not found in this company.'], 404);
        }

        $department->load(['manager.user', 'parentDepartment', 'childDepartments', 'members.user', 'employeeProfiles.membership.user']);

        return response()->json([
            'department' => $department,
        ]);
    }

    public function update(Request $request, Company $company, Department $department): JsonResponse
    {
        if ($department->company_id !== $company->id) {
            return response()->json(['message' => 'Department not found in this company.'], 404);
        }

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('departments', 'name')
                    ->where('company_id', $company->id)
                    ->ignore($department->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')
                    ->where('company_id', $company->id)
                    ->where('status', 'active'),
            ],
            'parent_department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'status' => ['nullable', 'string', 'in:active,archived,draft'],
        ]);

        // Prevent self-parenting and circular hierarchy
        if (isset($validated['parent_department_id'])) {
            if ($validated['parent_department_id'] === $department->id) {
                return response()->json(['message' => 'A department cannot be its own parent.'], 422);
            }
        }

        $department->update($validated);

        SecurityAuditEvent::record('department.updated', $request->user()->id, $company->id, 'department', (string) $department->id, $validated);

        return response()->json([
            'message' => 'Department updated successfully.',
            'department' => $department->fresh(['manager.user', 'parentDepartment']),
        ]);
    }

    public function destroy(Request $request, Company $company, Department $department): JsonResponse
    {
        if ($department->company_id !== $company->id) {
            return response()->json(['message' => 'Department not found in this company.'], 404);
        }

        DB::transaction(function () use ($department) {
            // Detach department members
            $department->members()->detach();

            // Nullify employee profiles pointing to this department
            EmployeeProfile::where('department_id', $department->id)
                ->update(['department_id' => null]);

            // Re-parent child departments to null
            Department::where('parent_department_id', $department->id)
                ->update(['parent_department_id' => null]);

            $department->delete();
        });

        SecurityAuditEvent::record('department.deleted', $request->user()->id, $company->id, 'department', (string) $department->id, [
            'name' => $department->name,
        ]);

        return response()->json([
            'message' => 'Department deleted successfully.',
        ]);
    }
}

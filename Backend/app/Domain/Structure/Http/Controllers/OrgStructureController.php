<?php

namespace App\Domain\Structure\Http\Controllers;

use App\Domain\Organization\Services\TenantContextResolver;
use App\Domain\Structure\Actions\AssignReportingManagerAction;
use App\Domain\Structure\Actions\CreateDepartmentAction;
use App\Domain\Structure\Actions\PreviewReorganizationAction;
use App\Domain\Structure\Actions\ReorganizeDepartmentAction;
use App\Domain\Structure\Services\OrganizationChartService;
use App\Http\Controllers\Controller;
use App\Models\CostCenter;
use App\Models\JobPosition;
use App\Models\OrganizationLocation;
use App\Models\ReportingRelationship;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrgStructureController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver
    ) {}

    /**
     * GET /api/v1/organization-chart
     * Interactive hierarchical organization tree
     */
    public function chart(Request $request, OrganizationChartService $chartService): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $search = $request->query('search');
        $maxDepth = max(1, min(20, (int)$request->query('max_depth', 10)));

        $chart = $chartService->buildChart($company, $search, $maxDepth);

        return response()->json([
            'data' => $chart,
        ]);
    }

    /**
     * POST /api/v1/structure/departments
     * Create department under organization topology
     */
    public function createDepartment(Request $request, CreateDepartmentAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'nullable|string|max:30',
            'description' => 'nullable|string|max:500',
            'parent_department_id' => 'nullable|integer|exists:departments,id',
            'manager_membership_id' => 'nullable|integer|exists:company_memberships,id',
            'cost_center_id' => 'nullable|integer|exists:cost_centers,id',
        ]);

        $department = $action->execute($company, $validated, $user);

        return response()->json([
            'message' => 'Department created successfully.',
            'data' => $department,
        ], 201);
    }

    /**
     * POST /api/v1/structure/departments/{id}/reorganization-preview
     * Preview reorganization impact and cycle safety
     */
    public function previewReorganization(
        Request $request,
        int $id,
        PreviewReorganizationAction $action
    ): JsonResponse {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'proposed_parent_id' => 'nullable|integer',
        ]);

        $preview = $action->execute($company, $id, $validated['proposed_parent_id'] ?? null);

        return response()->json([
            'data' => $preview,
        ]);
    }

    /**
     * POST /api/v1/structure/departments/{id}/reorganize
     * Reorganize department with cycle detection
     */
    public function reorganizeDepartment(
        Request $request,
        int $id,
        ReorganizeDepartmentAction $action
    ): JsonResponse {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        $validated = $request->validate([
            'new_parent_id' => 'nullable|integer',
        ]);

        $department = $action->execute($company, $id, $validated['new_parent_id'] ?? null, $user);

        return response()->json([
            'message' => 'Department reorganized successfully.',
            'data' => $department,
        ]);
    }

    /**
     * Locations endpoints
     */
    public function listLocations(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $locations = OrganizationLocation::where('company_id', $company->id)->orderBy('name')->get();

        return response()->json(['data' => $locations]);
    }

    public function createLocation(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:30',
            'timezone' => 'nullable|string|max:50',
            'country' => 'nullable|string|max:100',
            'city' => 'nullable|string|max:100',
            'address' => 'nullable|string|max:255',
            'is_remote' => 'nullable|boolean',
        ]);

        $location = OrganizationLocation::create(array_merge($validated, ['company_id' => $company->id]));

        return response()->json(['message' => 'Location created.', 'data' => $location], 201);
    }

    /**
     * Cost Centers endpoints
     */
    public function listCostCenters(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $costCenters = CostCenter::where('company_id', $company->id)->with('department')->orderBy('code')->get();

        return response()->json(['data' => $costCenters]);
    }

    public function createCostCenter(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'code' => 'required|string|max:40',
            'name' => 'required|string|max:120',
            'department_id' => 'nullable|integer|exists:departments,id',
            'currency' => 'nullable|string|size:3',
            'annual_budget' => 'nullable|numeric|min:0',
        ]);

        $costCenter = CostCenter::create(array_merge($validated, ['company_id' => $company->id]));

        return response()->json(['message' => 'Cost center created.', 'data' => $costCenter], 201);
    }

    /**
     * Job Positions endpoints
     */
    public function listPositions(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $positions = JobPosition::where('company_id', $company->id)
            ->with(['department', 'location', 'costCenter'])
            ->orderBy('title')
            ->get();

        return response()->json(['data' => $positions]);
    }

    public function createPosition(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'title' => 'required|string|max:120',
            'code' => 'required|string|max:40',
            'level' => 'nullable|string|max:30',
            'department_id' => 'required|integer|exists:departments,id',
            'location_id' => 'nullable|integer|exists:organization_locations,id',
            'cost_center_id' => 'nullable|integer|exists:cost_centers,id',
            'headcount_allowance' => 'nullable|integer|min:1',
        ]);

        $position = JobPosition::create(array_merge($validated, ['company_id' => $company->id]));

        return response()->json(['message' => 'Job position created.', 'data' => $position], 201);
    }

    /**
     * POST /api/v1/structure/reporting-relationships
     * Assign reporting manager with anti-cycle detection
     */
    public function assignReportingManager(Request $request, AssignReportingManagerAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        $validated = $request->validate([
            'employee_id' => 'required|integer',
            'manager_id' => 'required|integer',
            'relationship_type' => 'nullable|string|in:primary,secondary,project',
        ]);

        $relationship = $action->execute(
            company: $company,
            employeeId: $validated['employee_id'],
            managerId: $validated['manager_id'],
            relationshipType: $validated['relationship_type'] ?? 'primary',
            actor: $user
        );

        return response()->json([
            'message' => 'Reporting relationship assigned.',
            'data' => $relationship,
        ], 201);
    }
}

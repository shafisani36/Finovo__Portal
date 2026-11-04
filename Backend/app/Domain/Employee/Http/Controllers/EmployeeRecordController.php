<?php

namespace App\Domain\Employee\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Employee\Actions\CreateEmployeeAction;
use App\Domain\Employee\Actions\TransferEmployeeAction;
use App\Domain\Employee\Services\EmployeeProfileService;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Http\Controllers\Controller;
use App\Models\EmployeeCertification;
use App\Models\EmployeePersonalDetail;
use App\Models\EmploymentRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class EmployeeRecordController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected EmployeeProfileService $profileService,
        protected CreateEmployeeAction $createAction,
        protected TransferEmployeeAction $transferAction
    ) {}

    /**
     * List employees in current tenant with multi-criteria filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'employees.view');
        if (!$authResult->isAllowed) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: ' . $authResult->reason,
            ], 403);
        }

        $filters = $request->only(['department_id', 'status', 'employment_type', 'search']);
        $perPage = min((int) $request->input('per_page', 15), 100);

        $employees = $this->profileService->getDirectory($company->id, $filters, $perPage);

        return response()->json([
            'success' => true,
            'data' => $employees,
        ]);
    }

    /**
     * Show detailed employee profile with field-level authorization and PII masking.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $record = EmploymentRecord::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $authResult = $this->authEngine->evaluate(
            $membership,
            'employees.view',
            'department',
            $record->department_id,
            ['target_membership_id' => $record->membership_id]
        );

        if (!$authResult->isAllowed && $membership->id !== $record->membership_id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: ' . $authResult->reason,
            ], 403);
        }

        $profile = $this->profileService->getProfile($record, $membership);

        return response()->json([
            'success' => true,
            'data' => $profile,
        ]);
    }

    /**
     * Provision and onboard a new employee into the system of record.
     */
    public function store(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'employees.create');
        if (!$authResult->isAllowed) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: ' . $authResult->reason,
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:150',
            'department_id' => 'required|integer|exists:departments,id',
            'job_position_id' => 'nullable|integer|exists:job_positions,id',
            'designation_id' => 'nullable|integer|exists:designations,id',
            'manager_membership_id' => 'nullable|integer|exists:company_memberships,id',
            'employment_type' => 'nullable|string|in:full_time,part_time,contractor,intern',
            'hire_date' => 'nullable|date',
            'probation_end_date' => 'nullable|date|after_or_equal:hire_date',
            'location_id' => 'nullable|integer|exists:organization_locations,id',
            'cost_center_id' => 'nullable|integer|exists:cost_centers,id',
            'fte_ratio' => 'nullable|numeric|min:0.1|max:1.0',
            'employee_number' => 'nullable|string|max:40',
            'personal_details' => 'nullable|array',
            'personal_details.date_of_birth' => 'nullable|date',
            'personal_details.gender' => 'nullable|string|max:20',
            'personal_details.marital_status' => 'nullable|string|max:30',
            'personal_details.national_id_number' => 'nullable|string|max:50',
            'personal_details.personal_email' => 'nullable|email|max:150',
            'personal_details.personal_phone' => 'nullable|string|max:30',
            'personal_details.emergency_contact_name' => 'nullable|string|max:120',
            'personal_details.emergency_contact_phone' => 'nullable|string|max:30',
            'personal_details.emergency_contact_relationship' => 'nullable|string|max:50',
            'personal_details.residential_address' => 'nullable|string|max:500',
        ]);

        $validated['company_id'] = $company->id;

        try {
            $record = $this->createAction->execute($validated, $request->user()->id);

            return response()->json([
                'success' => true,
                'message' => 'Employee created successfully.',
                'data' => $record,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Transfer an employee to a new department, manager, or position.
     */
    public function transfer(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $record = EmploymentRecord::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'employees.transfer', 'department', $record->department_id);
        if (!$authResult->isAllowed) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: ' . $authResult->reason,
            ], 403);
        }

        $validated = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
            'job_position_id' => 'nullable|integer|exists:job_positions,id',
            'designation_id' => 'nullable|integer|exists:designations,id',
            'manager_membership_id' => 'nullable|integer|exists:company_memberships,id',
            'location_id' => 'nullable|integer|exists:organization_locations,id',
            'cost_center_id' => 'nullable|integer|exists:cost_centers,id',
            'fte_ratio' => 'nullable|numeric|min:0.1|max:1.0',
            'effective_from' => 'nullable|date',
            'reason' => 'nullable|string|max:255',
        ]);

        try {
            $updated = $this->transferAction->execute($record, $validated, $request->user()->id);

            return response()->json([
                'success' => true,
                'message' => 'Employee transferred successfully.',
                'data' => $updated,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Update restricted personal details (PII) for an employee.
     */
    public function updatePersonalDetails(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $record = EmploymentRecord::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'employees.manage_pii', 'department', $record->department_id);

        // If not manager/hr, allow employee to update their own contact details
        $isSelf = ($membership->id === $record->membership_id);
        if (!$authResult->isAllowed && !$isSelf) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to modify employee personal details.',
            ], 403);
        }

        $validated = $request->validate([
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|max:20',
            'marital_status' => 'nullable|string|max:30',
            'national_id_number' => 'nullable|string|max:50',
            'personal_email' => 'nullable|email|max:150',
            'personal_phone' => 'nullable|string|max:30',
            'emergency_contact_name' => 'nullable|string|max:120',
            'emergency_contact_relationship' => 'nullable|string|max:50',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'residential_address' => 'nullable|string|max:500',
        ]);

        $details = EmployeePersonalDetail::updateOrCreate(
            ['employment_record_id' => $record->id],
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Personal details updated successfully.',
            'data' => $details,
        ]);
    }

    /**
     * Add an accredited certification to an employee.
     */
    public function addCertification(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $record = EmploymentRecord::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'issuing_organization' => 'required|string|max:150',
            'credential_id' => 'nullable|string|max:100',
            'credential_url' => 'nullable|url|max:255',
            'issue_date' => 'required|date',
            'expiry_date' => 'nullable|date|after_or_equal:issue_date',
        ]);

        $cert = EmployeeCertification::create([
            'company_id' => $company->id,
            'employment_record_id' => $record->id,
            'name' => $validated['name'],
            'issuing_organization' => $validated['issuing_organization'],
            'credential_id' => $validated['credential_id'] ?? null,
            'credential_url' => $validated['credential_url'] ?? null,
            'issue_date' => $validated['issue_date'],
            'expiry_date' => $validated['expiry_date'] ?? null,
            'verification_status' => 'verified',
            'verified_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Certification recorded successfully.',
            'data' => $cert,
        ], 201);
    }
}

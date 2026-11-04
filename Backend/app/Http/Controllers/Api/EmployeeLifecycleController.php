<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmployeeChangeRequest;
use App\Models\EmployeeDocument;
use App\Models\EmployeeOnboardingTask;
use App\Models\EmployeeProfile;
use App\Models\EmployeeSkill;
use App\Models\EmploymentHistory;
use App\Models\EmploymentRecord;
use App\Models\Role;
use App\Models\SecurityAuditEvent;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\EmployeePersonalDetail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EmployeeLifecycleController extends Controller
{
    /**
     * FR-01: Employee Directory with company-scoped search, filters, pagination
     */
    public function index(Request $request, Company $company): JsonResponse
    {
        $query = EmploymentRecord::where('company_id', $company->id)
            ->with([
                'user',
                'membership.roles:id,name,slug',
                'department:id,name,code',
                'designation:id,name,level',
                'managerMembership.user:id,name,email',
            ]);

        // Search by name, email, or employee number
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_number', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        // Filter by status
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Filter by department
        if ($departmentId = $request->query('department_id')) {
            $query->where('department_id', $departmentId);
        }

        // Filter by designation
        if ($designationId = $request->query('designation_id')) {
            $query->where('designation_id', $designationId);
        }

        // Filter by employment type
        if ($employmentType = $request->query('employment_type')) {
            $query->where('employment_type', $employmentType);
        }

        // Filter by work arrangement
        if ($workArrangement = $request->query('work_arrangement')) {
            $query->where('work_arrangement', $workArrangement);
        }

        // Filter by role
        if ($roleSlug = $request->query('role')) {
            $query->whereHas('membership.roles', function ($rq) use ($roleSlug) {
                $rq->where('slug', $roleSlug);
            });
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortDirection = $request->query('sort_direction', 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sortBy, ['employee_number', 'hire_date', 'status', 'created_at'])) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->latest();
        }

        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $employees = $query->paginate($perPage);

        return response()->json([
            'employees' => $employees,
        ]);
    }

    /**
     * Safe Employee Creation with atomic Identity, Membership, EmploymentRecord, and Onboarding tasks
     */
    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['nullable', 'string', 'min:6', 'max:100'],
            'employee_number' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('employment_records', 'employee_number')->where('company_id', $company->id),
            ],
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'designation_id' => [
                'nullable',
                'integer',
                Rule::exists('designations', 'id')->where('company_id', $company->id),
            ],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'employment_type' => ['nullable', 'string', Rule::in(['permanent', 'fixed_term', 'part_time', 'contractor', 'intern'])],
            'status' => ['nullable', 'string', Rule::in(['invited', 'onboarding', 'active'])],
            'hire_date' => ['nullable', 'date'],
            'work_location' => ['nullable', 'string', 'max:100'],
            'work_arrangement' => ['nullable', 'string', Rule::in(['remote', 'hybrid', 'on_site'])],
            'role_slug' => ['nullable', 'string'],
            'shift_id' => [
                'nullable',
                'integer',
                Rule::exists('shifts', 'id')->where('company_id', $company->id),
            ],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:50'],
            'marital_status' => ['nullable', 'string', 'max:50'],
            'national_id_number' => ['nullable', 'string', 'max:50'],
            'personal_email' => ['nullable', 'email', 'max:255'],
            'personal_phone' => ['nullable', 'string', 'max:50'],
            'emergency_contact_name' => ['nullable', 'string', 'max:150'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:50'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:50'],
            'residential_address' => ['nullable', 'string', 'max:500'],
            'probation_end_date' => ['nullable', 'date'],
        ]);

        $effectivePassword = !empty($validated['password'])
            ? $validated['password']
            : ('Finovo@' . rand(1000, 9999) . '!');

        $result = DB::transaction(function () use ($validated, $company, $request, $effectivePassword) {
            // 1. Link or create M01 User Identity
            $user = User::where('email', strtolower(trim($validated['email'])))->first();
            if (!$user) {
                $user = User::create([
                    'name' => trim($validated['name']),
                    'email' => strtolower(trim($validated['email'])),
                    'password' => Hash::make($effectivePassword),
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]);
            } else {
                if (!empty($validated['password'])) {
                    $user->password = Hash::make($effectivePassword);
                }
                $user->status = 'active';
                if (!$user->email_verified_at) {
                    $user->email_verified_at = now();
                }
                $user->name = trim($validated['name']);
                $user->save();
            }

            // 2. Link or create M02 Company Membership
            $membership = CompanyMembership::where('company_id', $company->id)
                ->where('user_id', $user->id)
                ->first();

            $role = null;
            if (!empty($validated['role_slug'])) {
                $role = Role::where(function ($q) use ($company) {
                    $q->whereNull('company_id')->orWhere('company_id', $company->id);
                })->where('slug', $validated['role_slug'])->first();
            }
            if (!$role) {
                $role = Role::whereNull('company_id')->where('slug', 'employee')->first();
            }

            if (!$membership) {
                $membership = CompanyMembership::create([
                    'company_id' => $company->id,
                    'user_id' => $user->id,
                    'status' => 'active',
                    'joined_at' => now(),
                ]);

                if ($role) {
                    $membership->roles()->syncWithoutDetaching([$role->id]);
                }
            } else {
                if ($membership->status !== 'active') {
                    $membership->update(['status' => 'active']);
                }
                if ($role) {
                    $membership->roles()->syncWithoutDetaching([$role->id]);
                }
            }

            // Generate employee number if not provided
            $empNumber = $validated['employee_number'] ?? null;
            if (!$empNumber) {
                $count = EmploymentRecord::where('company_id', $company->id)->count() + 1;
                $empNumber = 'EMP-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
            }

            $initialStatus = $validated['status'] ?? 'active';

            // 3. Create Employment Record
            $record = EmploymentRecord::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'employee_number' => $empNumber,
                'employment_type' => $validated['employment_type'] ?? 'permanent',
                'status' => $initialStatus,
                'department_id' => $validated['department_id'] ?? null,
                'designation_id' => $validated['designation_id'] ?? null,
                'manager_membership_id' => $validated['manager_membership_id'] ?? null,
                'hire_date' => $validated['hire_date'] ?? now()->toDateString(),
                'probation_end_date' => $validated['probation_end_date'] ?? now()->addMonths(3)->toDateString(),
                'work_location' => $validated['work_location'] ?? 'Headquarters',
                'work_arrangement' => $validated['work_arrangement'] ?? 'remote',
            ]);

            // 3b. Record Personal Demographics & Emergency Contact Details
            if (
                !empty($validated['date_of_birth']) ||
                !empty($validated['gender']) ||
                !empty($validated['marital_status']) ||
                !empty($validated['national_id_number']) ||
                !empty($validated['personal_email']) ||
                !empty($validated['personal_phone']) ||
                !empty($validated['emergency_contact_name']) ||
                !empty($validated['emergency_contact_phone']) ||
                !empty($validated['residential_address'])
            ) {
                EmployeePersonalDetail::updateOrCreate(
                    ['employment_record_id' => $record->id],
                    [
                        'date_of_birth' => $validated['date_of_birth'] ?? null,
                        'gender' => $validated['gender'] ?? null,
                        'marital_status' => $validated['marital_status'] ?? null,
                        'national_id_number' => $validated['national_id_number'] ?? null,
                        'personal_email' => $validated['personal_email'] ?? null,
                        'personal_phone' => $validated['personal_phone'] ?? null,
                        'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
                        'emergency_contact_relationship' => $validated['emergency_contact_relationship'] ?? null,
                        'emergency_contact_phone' => $validated['emergency_contact_phone'] ?? null,
                        'residential_address' => $validated['residential_address'] ?? null,
                    ]
                );
            }

            // 3c. Assign Work Shift Schedule Timing
            if (!empty($validated['shift_id'])) {
                ShiftAssignment::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'employment_record_id' => $record->id,
                    'shift_id' => $validated['shift_id'],
                    'effective_from' => $validated['hire_date'] ?? now()->toDateString(),
                    'assigned_by_membership_id' => $request->user()->memberships()->where('company_id', $company->id)->value('id'),
                ]);
            }

            // 4. Create Employee Profile
            EmployeeProfile::firstOrCreate(
                [
                    'membership_id' => $membership->id,
                ],
                [
                    'department_id' => $validated['department_id'] ?? null,
                    'designation' => $record->designation?->name ?? 'Team Member',
                    'employee_id_number' => $record->employee_number,
                    'joining_date' => $validated['hire_date'] ?? now()->toDateString(),
                ]
            );

            // 5. Create Default Onboarding Checklist Tasks
            $defaultTasks = [
                ['title' => 'Verify identity and contact information', 'description' => 'Confirm employee legal name and contact details', 'due_days' => 2, 'required' => true],
                ['title' => 'Complete employment agreements & documents', 'description' => 'Sign NDA and primary contract', 'due_days' => 3, 'required' => true],
                ['title' => 'Set up workspace & provision application access', 'description' => 'Grant authorized team permissions and repositories', 'due_days' => 5, 'required' => true],
                ['title' => 'Initial 1-on-1 with reporting manager', 'description' => 'Review role goals and project roadmap', 'due_days' => 7, 'required' => false],
            ];

            foreach ($defaultTasks as $taskDef) {
                EmployeeOnboardingTask::create([
                    'company_id' => $company->id,
                    'employment_record_id' => $record->id,
                    'title' => $taskDef['title'],
                    'description' => $taskDef['description'],
                    'status' => 'pending',
                    'is_required' => $taskDef['required'],
                    'due_date' => now()->addDays($taskDef['due_days'])->toDateString(),
                ]);
            }

            // 6. Record Initial Employment History
            EmploymentHistory::create([
                'company_id' => $company->id,
                'employment_record_id' => $record->id,
                'change_type' => 'hire',
                'old_values' => null,
                'new_values' => [
                    'status' => $record->status,
                    'department_id' => $record->department_id,
                    'designation_id' => $record->designation_id,
                    'manager_membership_id' => $record->manager_membership_id,
                ],
                'reason' => 'New employee account onboarded with company credentials',
                'effective_at' => now(),
                'changed_by_user_id' => $request->user()->id,
            ]);

            // 7. Security Audit
            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'employee.created',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'employment_record_id' => $record->id,
                    'employee_number' => $record->employee_number,
                    'user_id' => $user->id,
                    'company_slug' => $company->slug,
                ]
            );

            return [
                'record' => $record,
                'user' => $user,
                'role' => $role,
            ];
        });

        $employeeRecord = $result['record'];
        $user = $result['user'];
        $role = $result['role'];

        return response()->json([
            'message' => 'Employee created successfully with active organization credentials',
            'employee' => $employeeRecord->load([
                'user',
                'membership.roles:id,name,slug',
                'department:id,name',
                'designation:id,name',
                'managerMembership.user:id,name,email',
                'onboardingTasks',
            ]),
            'credentials' => [
                'name' => $user->name,
                'email' => $user->email,
                'password' => $effectivePassword,
                'company_slug' => $company->slug,
                'company_name' => $company->name,
                'role' => $role?->name ?? 'Employee',
                'login_url' => url('/login'),
            ],
        ], 201);
    }

    /**
     * FR-02: Employee Profile with all tabs
     */
    public function show(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $employee->load([
            'user',
            'membership.roles:id,name,slug',
            'department:id,name,code',
            'designation:id,name,level,description',
            'managerMembership.user:id,name,email',
            'teamMemberships.team:id,name,code',
            'onboardingTasks.completedByUser:id,name',
            'history.changedByUser:id,name',
            'documents.uploader:id,name',
            'skills',
            'changeRequests.requester:id,name',
            'changeRequests.reviewer:id,name',
        ]);

        $profile = EmployeeProfile::where('membership_id', $employee->membership_id)->first();

        return response()->json([
            'employee' => $employee,
            'profile' => $profile,
        ]);
    }

    /**
     * Update Employee Profile (self-service or HR update)
     */
    public function updateProfile(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'timezone' => ['nullable', 'string', 'max:50'],
            'bio' => ['nullable', 'string', 'max:1000'],
            'address' => ['nullable', 'string', 'max:255'],
            'emergency_contact_name' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
        ]);

        if (isset($validated['name'])) {
            $employee->user->update(['name' => $validated['name']]);
        }

        $profile = EmployeeProfile::firstOrCreate(
            ['membership_id' => $employee->membership_id],
            ['department_id' => $employee->department_id, 'designation' => $employee->designation?->name ?? 'Team Member']
        );

        $profile->update([
            'phone_number' => $validated['phone'] ?? $profile->phone_number,
            'notes' => $validated['bio'] ?? $profile->notes,
        ]);

        return response()->json([
            'message' => 'Profile updated successfully',
            'profile' => $profile->fresh(),
            'user' => $employee->user->fresh(),
        ]);
    }

    /**
     * Update Employment Details (department, designation, manager DAG check)
     */
    public function updateEmployment(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'designation_id' => [
                'nullable',
                'integer',
                Rule::exists('designations', 'id')->where('company_id', $company->id),
            ],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'employment_type' => ['nullable', 'string', Rule::in(['permanent', 'fixed_term', 'part_time', 'contractor', 'intern'])],
            'work_location' => ['nullable', 'string', 'max:100'],
            'work_arrangement' => ['nullable', 'string', Rule::in(['remote', 'hybrid', 'on_site'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        // Circular reporting check (DAG validation)
        if (array_key_exists('manager_membership_id', $validated)) {
            $proposedManagerId = $validated['manager_membership_id'];
            if ($employee->createsCircularReporting($proposedManagerId)) {
                return response()->json([
                    'message' => 'Cannot assign manager: circular reporting chain detected. An employee cannot report to themselves or their subordinates.',
                ], 422);
            }
        }

        DB::transaction(function () use ($employee, $validated, $company, $request) {
            $oldValues = [
                'department_id' => $employee->department_id,
                'designation_id' => $employee->designation_id,
                'manager_membership_id' => $employee->manager_membership_id,
                'employment_type' => $employee->employment_type,
            ];

            $updateData = collect($validated)->except('reason')->toArray();
            $employee->update($updateData);

            EmploymentHistory::create([
                'company_id' => $company->id,
                'employment_record_id' => $employee->id,
                'change_type' => 'transfer',
                'old_values' => $oldValues,
                'new_values' => collect($employee->only(['department_id', 'designation_id', 'manager_membership_id', 'employment_type']))->toArray(),
                'reason' => $validated['reason'] ?? 'Employment details updated',
                'effective_at' => now(),
                'changed_by_user_id' => $request->user()->id,
            ]);

            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'employment.updated',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'employment_record_id' => $employee->id,
                    'changes' => array_keys($updateData),
                ]
            );
        });

        return response()->json([
            'message' => 'Employment details updated successfully',
            'employee' => $employee->fresh([
                'department:id,name',
                'designation:id,name',
                'managerMembership.user:id,name,email',
            ]),
        ]);
    }

    /**
     * FR-03: Employment Lifecycle Status Transition
     */
    public function transitionStatus(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'target_status' => [
                'required',
                'string',
                Rule::in(['invited', 'onboarding', 'active', 'on_leave', 'suspended', 'offboarding', 'former_employee']),
            ],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $currentStatus = $employee->status;
        $targetStatus = $validated['target_status'];

        if ($currentStatus === $targetStatus) {
            return response()->json(['message' => 'Employee is already in this status'], 422);
        }

        // Validate allowed state transitions
        $allowedTransitions = [
            'invited' => ['onboarding', 'active', 'suspended'],
            'onboarding' => ['active', 'suspended'],
            'active' => ['on_leave', 'suspended', 'offboarding'],
            'on_leave' => ['active', 'offboarding', 'suspended'],
            'suspended' => ['active', 'offboarding', 'former_employee'],
            'offboarding' => ['former_employee', 'active'],
            'former_employee' => ['onboarding', 'active'], // Rehire
        ];

        if (!in_array($targetStatus, $allowedTransitions[$currentStatus] ?? [])) {
            return response()->json([
                'message' => "Transition from {$currentStatus} to {$targetStatus} is not permitted by lifecycle policy.",
            ], 422);
        }

        DB::transaction(function () use ($employee, $currentStatus, $targetStatus, $validated, $company, $request) {
            $employee->update(['status' => $targetStatus]);

            EmploymentHistory::create([
                'company_id' => $company->id,
                'employment_record_id' => $employee->id,
                'change_type' => 'status_change',
                'old_values' => ['status' => $currentStatus],
                'new_values' => ['status' => $targetStatus],
                'reason' => $validated['reason'],
                'effective_at' => now(),
                'changed_by_user_id' => $request->user()->id,
            ]);

            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'employment.status_transition',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'employment_record_id' => $employee->id,
                    'from' => $currentStatus,
                    'to' => $targetStatus,
                    'reason' => $validated['reason'],
                ]
            );
        });

        return response()->json([
            'message' => "Status transitioned to {$targetStatus} successfully",
            'employee' => $employee->fresh(),
        ]);
    }

    /**
     * Toggle Onboarding Task completion
     */
    public function toggleOnboardingTask(Request $request, Company $company, EmploymentRecord $employee, EmployeeOnboardingTask $task): JsonResponse
    {
        if ($employee->company_id !== $company->id || $task->employment_record_id !== $employee->id) {
            return response()->json(['message' => 'Task not found for this employee'], 404);
        }

        $newStatus = $task->status === 'completed' ? 'pending' : 'completed';
        $completedAt = $newStatus === 'completed' ? now() : null;
        $completedBy = $newStatus === 'completed' ? $request->user()->id : null;

        $task->update([
            'status' => $newStatus,
            'completed_at' => $completedAt,
            'completed_by_user_id' => $completedBy,
        ]);

        return response()->json([
            'message' => "Task marked as {$newStatus}",
            'task' => $task->load('completedByUser:id,name'),
        ]);
    }

    /**
     * Submit Change Request (promotion, transfer, manager change)
     */
    public function createChangeRequest(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'request_type' => ['required', 'string', Rule::in(['designation_change', 'department_transfer', 'manager_change', 'status_change'])],
            'proposed_payload' => ['required', 'array'],
            'reason' => ['required', 'string', 'max:500'],
            'effective_date' => ['nullable', 'date'],
        ]);

        $changeRequest = EmployeeChangeRequest::create([
            'company_id' => $company->id,
            'employment_record_id' => $employee->id,
            'requested_by_user_id' => $request->user()->id,
            'request_type' => $validated['request_type'],
            'proposed_payload' => $validated['proposed_payload'],
            'reason' => $validated['reason'],
            'effective_date' => $validated['effective_date'] ?? now()->toDateString(),
            'status' => 'submitted',
        ]);

        return response()->json([
            'message' => 'Change request submitted successfully',
            'change_request' => $changeRequest->load('requester:id,name'),
        ], 201);
    }

    /**
     * Review Change Request (Approve or Reject)
     */
    public function reviewChangeRequest(Request $request, Company $company, EmployeeChangeRequest $changeRequest): JsonResponse
    {
        if ($changeRequest->company_id !== $company->id) {
            return response()->json(['message' => 'Change request not found in this company'], 404);
        }

        if ($changeRequest->status !== 'submitted') {
            return response()->json(['message' => 'This request has already been reviewed'], 422);
        }

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'review_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $employee = $changeRequest->employmentRecord;

        DB::transaction(function () use ($changeRequest, $employee, $validated, $company, $request) {
            $isApproved = $validated['action'] === 'approve';

            $changeRequest->update([
                'status' => $isApproved ? 'approved' : 'rejected',
                'reviewed_by_user_id' => $request->user()->id,
                'reviewed_at' => now(),
                'review_notes' => $validated['review_notes'] ?? null,
            ]);

            if ($isApproved) {
                $payload = $changeRequest->proposed_payload;
                $oldValues = [];

                if (isset($payload['designation_id'])) {
                    $oldValues['designation_id'] = $employee->designation_id;
                    $employee->designation_id = $payload['designation_id'];
                }
                if (isset($payload['department_id'])) {
                    $oldValues['department_id'] = $employee->department_id;
                    $employee->department_id = $payload['department_id'];
                }
                if (isset($payload['manager_membership_id'])) {
                    if (!$employee->createsCircularReporting($payload['manager_membership_id'])) {
                        $oldValues['manager_membership_id'] = $employee->manager_membership_id;
                        $employee->manager_membership_id = $payload['manager_membership_id'];
                    }
                }

                $employee->save();

                EmploymentHistory::create([
                    'company_id' => $company->id,
                    'employment_record_id' => $employee->id,
                    'change_type' => $changeRequest->request_type,
                    'old_values' => $oldValues,
                    'new_values' => $payload,
                    'reason' => 'Approved change request #' . $changeRequest->id . ': ' . $changeRequest->reason,
                    'effective_at' => now(),
                    'changed_by_user_id' => $request->user()->id,
                ]);
            }
        });

        return response()->json([
            'message' => 'Change request ' . ($validated['action'] === 'approve' ? 'approved and applied' : 'rejected'),
            'change_request' => $changeRequest->fresh(['requester:id,name', 'reviewer:id,name']),
        ]);
    }

    /**
     * Documents
     */
    public function listDocuments(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $documents = EmployeeDocument::where('company_id', $company->id)
            ->where('employment_record_id', $employee->id)
            ->with('uploader:id,name')
            ->latest()
            ->get();

        return response()->json(['documents' => $documents]);
    }

    public function uploadDocument(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'document_name' => ['required', 'string', 'max:255'],
            'document_type' => ['nullable', 'string', Rule::in(['contract', 'certificate', 'id_proof', 'tax_form', 'policy_ack'])],
            'file_path' => ['required', 'string'],
            'file_size' => ['nullable', 'integer'],
            'mime_type' => ['nullable', 'string', 'max:100'],
            'visibility' => ['nullable', 'string', Rule::in(['restricted', 'employee_and_hr', 'hr_only'])],
            'expires_at' => ['nullable', 'date'],
        ]);

        $doc = EmployeeDocument::create([
            'company_id' => $company->id,
            'employment_record_id' => $employee->id,
            'document_name' => $validated['document_name'],
            'document_type' => $validated['document_type'] ?? 'contract',
            'file_path' => $validated['file_path'],
            'file_size' => $validated['file_size'] ?? 1024,
            'mime_type' => $validated['mime_type'] ?? 'application/pdf',
            'visibility' => $validated['visibility'] ?? 'restricted',
            'expires_at' => $validated['expires_at'] ?? null,
            'uploaded_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Document saved successfully',
            'document' => $doc->load('uploader:id,name'),
        ], 201);
    }

    /**
     * Skills Catalog per employee
     */
    public function listSkills(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $skills = EmployeeSkill::where('company_id', $company->id)
            ->where('employment_record_id', $employee->id)
            ->orderBy('skill_name')
            ->get();

        return response()->json(['skills' => $skills]);
    }

    public function saveSkill(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'skill_name' => ['required', 'string', 'max:100'],
            'proficiency_level' => ['required', 'string', Rule::in(['beginner', 'intermediate', 'advanced', 'expert'])],
            'years_of_experience' => ['nullable', 'numeric', 'min:0', 'max:50'],
            'verified' => ['nullable', 'boolean'],
        ]);

        $skill = EmployeeSkill::updateOrCreate(
            [
                'company_id' => $company->id,
                'employment_record_id' => $employee->id,
                'skill_name' => $validated['skill_name'],
            ],
            [
                'proficiency_level' => $validated['proficiency_level'],
                'years_of_experience' => $validated['years_of_experience'] ?? 1.0,
                'verified' => $validated['verified'] ?? false,
            ]
        );

        return response()->json([
            'message' => 'Skill saved successfully',
            'skill' => $skill,
        ]);
    }

    public function deleteSkill(Request $request, Company $company, EmploymentRecord $employee, EmployeeSkill $skill): JsonResponse
    {
        if ($employee->company_id !== $company->id || $skill->employment_record_id !== $employee->id) {
            return response()->json(['message' => 'Skill not found for this employee'], 404);
        }

        $skill->delete();

        return response()->json(['message' => 'Skill removed successfully']);
    }

    /**
     * Reports & Headcount Summary
     */
    public function reports(Request $request, Company $company): JsonResponse
    {
        $totalHeadcount = EmploymentRecord::where('company_id', $company->id)->count();

        $byStatus = EmploymentRecord::where('company_id', $company->id)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $byType = EmploymentRecord::where('company_id', $company->id)
            ->select('employment_type', DB::raw('count(*) as count'))
            ->groupBy('employment_type')
            ->pluck('count', 'employment_type');

        $byDepartment = Department::where('company_id', $company->id)
            ->withCount('employmentRecords')
            ->get(['id', 'name', 'employment_records_count']);

        $byDesignation = Designation::where('company_id', $company->id)
            ->withCount('employmentRecords')
            ->get(['id', 'name', 'level', 'employment_records_count']);

        return response()->json([
            'total_headcount' => $totalHeadcount,
            'by_status' => $byStatus,
            'by_type' => $byType,
            'by_department' => $byDepartment,
            'by_designation' => $byDesignation,
        ]);
    }

    /**
     * FR-01: CSV Export with sensitive field filtering and company isolation
     */
    public function export(Request $request, Company $company)
    {
        $employees = EmploymentRecord::where('company_id', $company->id)
            ->with(['user', 'department', 'designation', 'managerMembership.user'])
            ->latest()
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="employees_' . now()->format('Y-m-d') . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($employees) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Employee Number',
                'Name',
                'Email',
                'Status',
                'Employment Type',
                'Department',
                'Designation',
                'Reporting Manager',
                'Hire Date',
                'Work Location',
                'Work Arrangement',
            ]);

            foreach ($employees as $emp) {
                fputcsv($handle, [
                    $emp->employee_number,
                    $emp->user?->name ?? 'N/A',
                    $emp->user?->email ?? 'N/A',
                    $emp->status,
                    $emp->employment_type,
                    $emp->department?->name ?? 'Unassigned',
                    $emp->designation?->name ?? 'Unassigned',
                    $emp->managerMembership?->user?->name ?? 'None',
                    $emp->hire_date?->format('Y-m-d') ?? '',
                    $emp->work_location ?? '',
                    $emp->work_arrangement ?? '',
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * FR-06: Offboarding and access revocation workflow
     */
    public function offboard(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
            'departure_date' => ['nullable', 'date'],
            'immediate_security_revocation' => ['nullable', 'boolean'],
            'final_status' => ['nullable', 'string', Rule::in(['offboarding', 'former_employee'])],
        ]);

        $finalStatus = $validated['final_status'] ?? 'offboarding';
        $immediateRevocation = $validated['immediate_security_revocation'] ?? false;

        DB::transaction(function () use ($employee, $validated, $company, $finalStatus, $immediateRevocation, $request) {
            $oldStatus = $employee->status;
            $employee->update([
                'status' => $finalStatus,
                'termination_date' => $validated['departure_date'] ?? now()->toDateString(),
                'termination_reason' => $validated['reason'],
            ]);

            // If immediate security revocation requested, revoke active company membership
            if ($immediateRevocation && $employee->membership) {
                $employee->membership->update([
                    'status' => 'revoked',
                    'revoked_at' => now(),
                ]);
            }

            // Create standard offboarding checklist tasks
            $offboardingTasks = [
                ['title' => 'Revoke company access & device credentials', 'description' => 'Disable login sessions, SSH keys, and workspace tokens', 'due_days' => 1, 'required' => true],
                ['title' => 'Reassign active tasks & project ownership', 'description' => 'Transfer leadership and responsibilities to backup assignee', 'due_days' => 2, 'required' => true],
                ['title' => 'Collect company hardware and equipment', 'description' => 'Secure company laptop and physical access badges', 'due_days' => 3, 'required' => true],
                ['title' => 'Conduct exit interview and archival', 'description' => 'Finalize documentation and archive employment profile', 'due_days' => 5, 'required' => false],
            ];

            foreach ($offboardingTasks as $taskDef) {
                EmployeeOnboardingTask::create([
                    'company_id' => $company->id,
                    'employment_record_id' => $employee->id,
                    'title' => '[Offboarding] ' . $taskDef['title'],
                    'description' => $taskDef['description'],
                    'status' => 'pending',
                    'is_required' => $taskDef['required'],
                    'due_date' => now()->addDays($taskDef['due_days'])->toDateString(),
                ]);
            }

            EmploymentHistory::create([
                'company_id' => $company->id,
                'employment_record_id' => $employee->id,
                'change_type' => 'offboard',
                'old_values' => ['status' => $oldStatus],
                'new_values' => [
                    'status' => $finalStatus,
                    'termination_date' => $validated['departure_date'] ?? now()->toDateString(),
                    'immediate_revocation' => $immediateRevocation,
                ],
                'reason' => 'Offboarding initiated: ' . $validated['reason'],
                'effective_at' => now(),
                'changed_by_user_id' => $request->user()->id,
            ]);

            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'employee.offboarded',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'employment_record_id' => $employee->id,
                    'immediate_revocation' => $immediateRevocation,
                    'reason' => $validated['reason'],
                ]
            );
        });

        return response()->json([
            'message' => 'Offboarding process initiated successfully',
            'employee' => $employee->fresh(),
        ]);
    }

    /**
     * FR-09: Company-wide Change Requests Approval Inbox
     */
    public function changeRequestsInbox(Request $request, Company $company): JsonResponse
    {
        $status = $request->query('status');
        $query = EmployeeChangeRequest::where('company_id', $company->id)
            ->with(['requester:id,name,email', 'reviewer:id,name', 'employmentRecord.user:id,name,email'])
            ->latest();

        if ($status) {
            $query->where('status', $status);
        }

        return response()->json([
            'change_requests' => $query->paginate(25),
        ]);
    }

    /**
     * Delete employee record and clean up company profile
     */
    public function destroy(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        DB::transaction(function () use ($employee, $company, $request) {
            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'employee.deleted',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'employment_record_id' => $employee->id,
                    'employee_number' => $employee->employee_number,
                ]
            );

            // Delete associated onboarding tasks
            $employee->onboardingTasks()->delete();
            $employee->skills()->delete();
            $employee->documents()->delete();
            $employee->delete();
        });

        return response()->json(['message' => 'Employee record removed successfully.']);
    }

    /**
     * Reset employee login credentials
     */
    public function resetPassword(Request $request, Company $company, EmploymentRecord $employee): JsonResponse
    {
        if ($employee->company_id !== $company->id) {
            return response()->json(['message' => 'Employee not found in this company'], 404);
        }

        $validated = $request->validate([
            'password' => ['nullable', 'string', 'min:6', 'max:100'],
        ]);

        $user = $employee->user;
        if (!$user) {
            return response()->json(['message' => 'Associated user account not found.'], 404);
        }

        $newPassword = !empty($validated['password']) 
            ? $validated['password'] 
            : ('Finovo@' . rand(1000, 9999) . '!');

        $user->password = Hash::make($newPassword);
        $user->status = 'active';
        $user->email_verified_at = now();
        $user->save();

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'employee.password_reset',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: [
                'employee_id' => $employee->id,
                'target_user_id' => $user->id,
            ]
        );

        return response()->json([
            'message' => 'Credentials reset successfully.',
            'credentials' => [
                'email' => $user->email,
                'password' => $newPassword,
                'company_slug' => $company->slug,
                'company_name' => $company->name,
                'login_url' => url('/login'),
            ],
        ]);
    }
}

<?php

namespace App\Domain\Employee\Services;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EmployeeProfileService
{
    public function __construct(
        protected AuthorizationEngine $authEngine
    ) {}

    /**
     * Get paginated directory of employees for the active tenant.
     */
    public function getDirectory(
        int $companyId,
        array $filters = [],
        int $perPage = 15
    ): LengthAwarePaginator {
        $query = EmploymentRecord::where('company_id', $companyId)
            ->with([
                'membership.user',
                'department',
                'designation',
                'activePrimaryAssignment.position',
                'activePrimaryAssignment.location',
            ]);

        if (!empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['employment_type'])) {
            $query->where('employment_type', $filters['employment_type']);
        }

        if (!empty($filters['search'])) {
            $search = '%' . trim($filters['search']) . '%';
            $query->where(function (Builder $q) use ($search) {
                $q->where('employee_number', 'LIKE', $search)
                    ->orWhereHas('membership.user', function (Builder $uq) use ($search) {
                        $uq->where('name', 'LIKE', $search)
                            ->orWhere('email', 'LIKE', $search);
                    });
            });
        }

        return $query->orderBy('id', 'desc')->paginate($perPage);
    }

    /**
     * Get detailed employee profile, with restricted PII masked if the caller lacks authorization.
     */
    public function getProfile(
        EmploymentRecord $record,
        CompanyMembership $actorMembership
    ): array {
        $record->load([
            'membership.user',
            'department',
            'designation',
            'manager.user',
            'activePrimaryAssignment.position',
            'activePrimaryAssignment.location',
            'activePrimaryAssignment.costCenter',
            'jobAssignments' => fn($q) => $q->orderBy('effective_from', 'desc'),
            'contracts' => fn($q) => $q->orderBy('start_date', 'desc'),
            'certifications' => fn($q) => $q->orderBy('issue_date', 'desc'),
            'personalDetails',
        ]);

        $canViewPii = $this->authEngine->evaluate(
            $actorMembership,
            'employees.view_pii',
            'department',
            $record->department_id,
            ['target_membership_id' => $record->membership_id]
        )->isAllowed;

        // Is user viewing their own profile? Employees can view their own PII
        if ($actorMembership->id === $record->membership_id) {
            $canViewPii = true;
        }

        $piiData = null;
        if ($record->personalDetails) {
            if ($canViewPii) {
                $piiData = $record->personalDetails->toArray();
            } else {
                // Masked representation
                $piiData = [
                    'gender' => $record->personalDetails->gender,
                    'marital_status' => $record->personalDetails->marital_status,
                    'national_id_number' => $record->personalDetails->national_id_number
                        ? '••••••••' . substr($record->personalDetails->national_id_number, -4)
                        : null,
                    'personal_email' => $record->personalDetails->personal_email
                        ? substr($record->personalDetails->personal_email, 0, 2) . '••••@••••'
                        : null,
                    'personal_phone' => $record->personalDetails->personal_phone
                        ? '••••••' . substr($record->personalDetails->personal_phone, -4)
                        : null,
                    'emergency_contact_name' => $record->personalDetails->emergency_contact_name,
                    'emergency_contact_relationship' => $record->personalDetails->emergency_contact_relationship,
                    'emergency_contact_phone' => $record->personalDetails->emergency_contact_phone
                        ? '••••••' . substr($record->personalDetails->emergency_contact_phone, -4)
                        : null,
                    'residential_address' => '[REDACTED - INSUFFICIENT PRIVILEGE]',
                    'masked' => true,
                ];
            }
        }

        $profile = $record->toArray();
        $profile['personal_details'] = $piiData;
        $profile['can_view_pii'] = $canViewPii;

        return $profile;
    }
}

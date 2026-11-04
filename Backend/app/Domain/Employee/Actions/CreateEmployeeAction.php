<?php

namespace App\Domain\Employee\Actions;

use App\Domain\Employee\Services\EmployeeNumberGenerator;
use App\Models\CompanyMembership;
use App\Models\EmployeePersonalDetail;
use App\Models\EmploymentRecord;
use App\Models\JobAssignment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CreateEmployeeAction
{
    public function __construct(
        protected EmployeeNumberGenerator $numberGenerator
    ) {}

    /**
     * Atomically creates an employee record, membership, initial primary job assignment,
     * restricted personal details, and transactional outbox event.
     */
    public function execute(array $data, int $actorUserId): EmploymentRecord
    {
        $companyId = (int) $data['company_id'];
        $email = strtolower(trim($data['email']));
        $name = trim($data['name']);

        return DB::transaction(function () use ($companyId, $email, $name, $data, $actorUserId) {
            // 1. Resolve or create user account
            $user = User::where('email', $email)->first();
            if (!$user) {
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'password' => Hash::make(Str::random(32)),
                    'is_active' => true,
                ]);
            }

            // 2. Resolve or create company membership
            $membership = CompanyMembership::firstOrCreate(
                [
                    'company_id' => $companyId,
                    'user_id' => $user->id,
                ],
                [
                    'status' => 'active',
                    'joined_at' => now(),
                ]
            );

            // Assign role via M03 membership_roles
            $roleSlug = $data['membership_role'] ?? 'employee';
            $role = \App\Models\Role::where(function($q) use ($companyId) {
                $q->whereNull('company_id')->orWhere('company_id', $companyId);
            })->where('slug', $roleSlug)->first();

            if ($role && !$membership->roles()->where('roles.id', $role->id)->exists()) {
                $membership->roles()->attach($role->id, [
                    'scope_type' => 'organization',
                    'scope_id' => null,
                    'assigned_by_user_id' => $actorUserId,
                    'effective_from' => now(),
                ]);
            }

            // Check if active employment record already exists
            $existing = EmploymentRecord::where('company_id', $companyId)
                ->where('membership_id', $membership->id)
                ->where('status', 'active')
                ->first();

            if ($existing) {
                throw new InvalidArgumentException("Active employment record already exists for membership ID {$membership->id}.");
            }

            // 3. Generate deterministic unique employee number
            $employeeNumber = $data['employee_number'] ?? $this->numberGenerator->generate($companyId);

            $hireDate = !empty($data['hire_date']) ? Carbon::parse($data['hire_date']) : Carbon::today();

            // 4. Create authoritative EmploymentRecord
            $record = EmploymentRecord::create([
                'company_id' => $companyId,
                'membership_id' => $membership->id,
                'employee_number' => $employeeNumber,
                'employment_type' => $data['employment_type'] ?? 'full_time',
                'status' => 'active',
                'department_id' => $data['department_id'],
                'designation_id' => $data['designation_id'] ?? null,
                'manager_membership_id' => $data['manager_membership_id'] ?? null,
                'hire_date' => $hireDate->toDateString(),
                'probation_end_date' => !empty($data['probation_end_date']) ? Carbon::parse($data['probation_end_date'])->toDateString() : null,
                'work_location' => $data['work_location'] ?? 'on_site',
            ]);

            // 5. Create effective-dated primary JobAssignment
            JobAssignment::create([
                'company_id' => $companyId,
                'employment_record_id' => $record->id,
                'job_position_id' => $data['job_position_id'] ?? null,
                'department_id' => $data['department_id'],
                'location_id' => $data['location_id'] ?? null,
                'cost_center_id' => $data['cost_center_id'] ?? null,
                'manager_membership_id' => $data['manager_membership_id'] ?? null,
                'is_primary' => true,
                'fte_ratio' => $data['fte_ratio'] ?? 1.00,
                'effective_from' => $hireDate->startOfDay(),
                'effective_to' => null, // Open-ended interval
                'status' => 'active',
            ]);

            // 6. Create restricted personal details if provided
            if (!empty($data['personal_details']) && is_array($data['personal_details'])) {
                $pii = $data['personal_details'];
                EmployeePersonalDetail::create([
                    'employment_record_id' => $record->id,
                    'date_of_birth' => $pii['date_of_birth'] ?? null,
                    'gender' => $pii['gender'] ?? null,
                    'marital_status' => $pii['marital_status'] ?? null,
                    'national_id_number' => $pii['national_id_number'] ?? null,
                    'personal_email' => $pii['personal_email'] ?? null,
                    'personal_phone' => $pii['personal_phone'] ?? null,
                    'emergency_contact_name' => $pii['emergency_contact_name'] ?? null,
                    'emergency_contact_relationship' => $pii['emergency_contact_relationship'] ?? null,
                    'emergency_contact_phone' => $pii['emergency_contact_phone'] ?? null,
                    'residential_address' => $pii['residential_address'] ?? null,
                ]);
            }

            // 7. Write Domain Event Outbox
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'event_type' => 'employee.created',
                'schema_version' => 1,
                'producer' => 'finovo_m04_workforce',
                'payload' => json_encode([
                    'employment_record_id' => $record->id,
                    'membership_id' => $membership->id,
                    'employee_number' => $employeeNumber,
                    'department_id' => $record->department_id,
                    'hire_date' => $record->hire_date,
                    'created_by_user_id' => $actorUserId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $record->load(['membership.user', 'department', 'activePrimaryAssignment', 'personalDetails']);
        });
    }
}

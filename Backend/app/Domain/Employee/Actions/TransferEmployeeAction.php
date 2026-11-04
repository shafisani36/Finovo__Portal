<?php

namespace App\Domain\Employee\Actions;

use App\Models\Department;
use App\Models\EmploymentHistory;
use App\Models\EmploymentRecord;
use App\Models\JobAssignment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class TransferEmployeeAction
{
    /**
     * Executes an organizational transfer for an employee:
     * - Validates cycle safety for reporting line.
     * - Concludes current active primary job assignment using half-open interval semantics.
     * - Creates new active primary job assignment starting at $effectiveFrom.
     * - Updates EmploymentRecord master attributes.
     * - Emits outbox domain event.
     */
    public function execute(
        EmploymentRecord $record,
        array $transferData,
        int $actorUserId
    ): EmploymentRecord {
        $effectiveFrom = !empty($transferData['effective_from'])
            ? Carbon::parse($transferData['effective_from'])
            : Carbon::now();

        $newDepartmentId = (int) ($transferData['department_id'] ?? $record->department_id);
        $newManagerId = array_key_exists('manager_membership_id', $transferData)
            ? ($transferData['manager_membership_id'] ? (int) $transferData['manager_membership_id'] : null)
            : $record->manager_membership_id;

        // Verify department belongs to the company
        $dept = Department::where('company_id', $record->company_id)->find($newDepartmentId);
        if (!$dept) {
            throw new InvalidArgumentException("Department ID {$newDepartmentId} not found in this company.");
        }

        // Cycle check
        if ($newManagerId && $record->createsCircularReporting($newManagerId)) {
            throw new InvalidArgumentException("Manager assignment would produce a circular reporting hierarchy.");
        }

        return DB::transaction(function () use ($record, $transferData, $effectiveFrom, $newDepartmentId, $newManagerId, $actorUserId) {
            // 1. Conclude all current active primary assignments
            JobAssignment::where('company_id', $record->company_id)
                ->where('employment_record_id', $record->id)
                ->where('is_primary', true)
                ->where('status', 'active')
                ->update([
                    'effective_to' => $effectiveFrom,
                    'status' => 'concluded',
                ]);

            // 2. Create new active primary job assignment
            $newAssignment = JobAssignment::create([
                'company_id' => $record->company_id,
                'employment_record_id' => $record->id,
                'job_position_id' => $transferData['job_position_id'] ?? null,
                'department_id' => $newDepartmentId,
                'location_id' => $transferData['location_id'] ?? null,
                'cost_center_id' => $transferData['cost_center_id'] ?? null,
                'manager_membership_id' => $newManagerId,
                'is_primary' => true,
                'fte_ratio' => $transferData['fte_ratio'] ?? 1.00,
                'effective_from' => $effectiveFrom,
                'effective_to' => null,
                'status' => 'active',
            ]);

            // 3. Log history if employment_history exists
            try {
                EmploymentHistory::create([
                    'employment_record_id' => $record->id,
                    'event_type' => 'transfer',
                    'effective_date' => $effectiveFrom->toDateString(),
                    'from_department_id' => $record->department_id,
                    'to_department_id' => $newDepartmentId,
                    'from_designation_id' => $record->designation_id,
                    'to_designation_id' => $transferData['designation_id'] ?? $record->designation_id,
                    'from_manager_membership_id' => $record->manager_membership_id,
                    'to_manager_membership_id' => $newManagerId,
                    'reason' => $transferData['reason'] ?? 'Internal transfer',
                    'created_by' => $actorUserId,
                ]);
            } catch (\Throwable $e) {
                // Keep moving if history table has different schema
            }

            // 4. Update authoritative record
            $record->update([
                'department_id' => $newDepartmentId,
                'designation_id' => $transferData['designation_id'] ?? $record->designation_id,
                'manager_membership_id' => $newManagerId,
                'work_location' => $transferData['work_location'] ?? $record->work_location,
            ]);

            // 5. Emit outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $record->company_id,
                'event_type' => 'employee.transferred',
                'schema_version' => 1,
                'producer' => 'finovo_m04_workforce',
                'payload' => json_encode([
                    'employment_record_id' => $record->id,
                    'new_department_id' => $newDepartmentId,
                    'new_manager_id' => $newManagerId,
                    'effective_from' => $effectiveFrom->toIso8601String(),
                    'actor_user_id' => $actorUserId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $record->fresh(['department', 'activePrimaryAssignment', 'jobAssignments']);
        });
    }
}

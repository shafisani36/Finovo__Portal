<?php

namespace App\Domain\Recruitment\Actions;

use App\Domain\Employee\Actions\CreateEmployeeAction;
use App\Domain\Lifecycle\Services\LifecycleDagEngine;
use App\Models\CandidateApplication;
use App\Models\LifecycleInstance;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ConvertCandidateToEmployeeAction
{
    public function __construct(
        protected CreateEmployeeAction $createEmployeeAction,
        protected LifecycleDagEngine $lifecycleDagEngine
    ) {}

    /**
     * Atomically converts a candidate into an authoritative EmploymentRecord,
     * links the application, initializes the onboarding DAG workflow, and emits outbox event.
     */
    public function execute(CandidateApplication $application, int $actorUserId, array $overrides = []): array
    {
        if ($application->converted_employment_record_id) {
            throw new InvalidArgumentException("This application has already been converted to an employee record.");
        }

        $candidate = $application->candidate;
        $requisition = $application->requisition;
        $latestOffer = $application->latestOffer;

        $hireDate = !empty($overrides['hire_date'])
            ? $overrides['hire_date']
            : ($latestOffer?->proposed_start_date?->toDateString() ?? date('Y-m-d'));

        return DB::transaction(function () use ($application, $candidate, $requisition, $latestOffer, $hireDate, $actorUserId, $overrides) {
            // 1. Provision workforce system-of-record
            $employeeData = [
                'company_id' => $application->company_id,
                'name' => $candidate->full_name,
                'email' => $candidate->email,
                'department_id' => $overrides['department_id'] ?? $requisition->department_id,
                'job_position_id' => $overrides['job_position_id'] ?? $requisition->job_position_id,
                'manager_membership_id' => $overrides['manager_membership_id'] ?? null,
                'employment_type' => $requisition->employment_type ?? 'full_time',
                'hire_date' => $hireDate,
                'probation_end_date' => !empty($overrides['probation_end_date']) ? $overrides['probation_end_date'] : null,
                'work_location' => $overrides['work_location'] ?? 'headquarters',
                'personal_details' => [
                    'personal_email' => $candidate->email,
                    'personal_phone' => $candidate->phone,
                    'residential_address' => $overrides['residential_address'] ?? null,
                ],
            ];

            $employmentRecord = $this->createEmployeeAction->execute($employeeData, $actorUserId);

            // 2. Mark application as hired
            $application->update([
                'current_stage' => 'hired',
                'converted_employment_record_id' => $employmentRecord->id,
                'converted_at' => now(),
            ]);

            // 3. Initialize onboarding lifecycle DAG workflow
            $lifecycleInstance = LifecycleInstance::create([
                'company_id' => $application->company_id,
                'employment_record_id' => $employmentRecord->id,
                'type' => 'onboarding',
                'status' => 'in_progress',
                'target_date' => Carbon::parse($hireDate)->addDays(14)->toDateString(),
                'initiated_by_user_id' => $actorUserId,
                'notes' => "Automated onboarding initiated from recruitment requisition #{$requisition->requisition_number}",
            ]);

            $this->lifecycleDagEngine->initializeInstanceTasks($lifecycleInstance);

            // 4. Emit domain event outbox
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $application->company_id,
                'event_type' => 'candidate.hired',
                'schema_version' => 1,
                'producer' => 'finovo_m05_recruitment',
                'payload' => json_encode([
                    'candidate_id' => $candidate->id,
                    'candidate_application_id' => $application->id,
                    'requisition_id' => $requisition->id,
                    'employment_record_id' => $employmentRecord->id,
                    'lifecycle_instance_id' => $lifecycleInstance->id,
                    'hire_date' => $hireDate,
                    'actor_user_id' => $actorUserId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'employment_record' => $employmentRecord,
                'lifecycle_instance' => $lifecycleInstance->load('tasks'),
                'application' => $application->fresh(),
            ];
        });
    }
}

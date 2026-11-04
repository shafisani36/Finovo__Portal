<?php

namespace App\Domain\Lifecycle\Services;

use App\Models\LifecycleInstance;
use App\Models\LifecycleTask;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class LifecycleDagEngine
{
    /**
     * Standard DAG templates for organizational workforce transitions
     */
    public const ONBOARDING_TEMPLATE = [
        [
            'task_key' => 'it_provision_credentials',
            'title' => 'Provision SSO & Corporate Email Accounts',
            'description' => 'Create Google Workspace / Microsoft 365, internal VPN, and core identity accounts.',
            'assigned_role_slug' => 'company-admin',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'hr_verify_i9_documents',
            'title' => 'Verify Identity & Tax Documentation (Form I-9 / W-4)',
            'description' => 'Upload and verify government identity cards, tax forms, and proof of work eligibility.',
            'assigned_role_slug' => 'hr-officer',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'it_ship_hardware',
            'title' => 'Configure & Issue Workstation Hardware',
            'description' => 'Enroll company laptop in MDM and ship to employee or provision at primary office.',
            'assigned_role_slug' => 'company-admin',
            'prerequisite_task_keys' => ['it_provision_credentials'],
        ],
        [
            'task_key' => 'dept_assign_buddy',
            'title' => 'Assign Department Mentor & 30-Day Roadmap',
            'description' => 'Pair new hire with an experienced peer and schedule week-1 orientation sessions.',
            'assigned_role_slug' => 'department-manager',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'complete_security_compliance',
            'title' => 'Complete SOC-2 & Security Awareness Training',
            'description' => 'Employee completes required compliance courses and signs NDA/Security policies.',
            'assigned_role_slug' => 'employee',
            'prerequisite_task_keys' => ['it_provision_credentials', 'it_ship_hardware'],
        ],
        [
            'task_key' => 'manager_first_week_checkin',
            'title' => 'Manager Day-7 1-on-1 Review',
            'description' => 'Formal first-week check-in to review onboarding milestones and unblock tooling.',
            'assigned_role_slug' => 'department-manager',
            'prerequisite_task_keys' => ['complete_security_compliance', 'dept_assign_buddy'],
        ],
    ];

    public const OFFBOARDING_TEMPLATE = [
        [
            'task_key' => 'hr_exit_interview',
            'title' => 'Conduct Confidential Exit Interview',
            'description' => 'Document reasons for departure, feedback, and forwarding contact details.',
            'assigned_role_slug' => 'hr-officer',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'it_revoke_access',
            'title' => 'Immediate Access Revocation & Session Invalidation',
            'description' => 'Invalidate OAuth tokens, VPN certificates, and disable directory identity.',
            'assigned_role_slug' => 'company-admin',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'asset_recovery',
            'title' => 'Recover Hardware, Access Badges & Peripherals',
            'description' => 'Inspect and log return of company laptop, access keys, and mobile equipment.',
            'assigned_role_slug' => 'company-admin',
            'prerequisite_task_keys' => [],
        ],
        [
            'task_key' => 'finance_final_settlement',
            'title' => 'Process Final Payroll & Accrued Leave Payout',
            'description' => 'Calculate final salary prorations, unused PTO reimbursement, and severance balance.',
            'assigned_role_slug' => 'payroll-officer',
            'prerequisite_task_keys' => ['it_revoke_access', 'asset_recovery'],
        ],
        [
            'task_key' => 'hr_close_employment',
            'title' => 'Terminate Employment Record & Archive File',
            'description' => 'Set EmploymentRecord status to former_employee and issue service certificate.',
            'assigned_role_slug' => 'hr-officer',
            'prerequisite_task_keys' => ['hr_exit_interview', 'finance_final_settlement'],
        ],
    ];

    /**
     * Seeds DAG tasks for a new LifecycleInstance based on workflow type
     */
    public function initializeInstanceTasks(LifecycleInstance $instance): void
    {
        $template = match ($instance->type) {
            'onboarding' => self::ONBOARDING_TEMPLATE,
            'offboarding' => self::OFFBOARDING_TEMPLATE,
            default => self::ONBOARDING_TEMPLATE,
        };

        // Detect cycles in template DAG definition before insertion
        $this->validateDagAcyclicity($template);

        foreach ($template as $step) {
            $hasPrereqs = !empty($step['prerequisite_task_keys']);
            LifecycleTask::create([
                'lifecycle_instance_id' => $instance->id,
                'company_id' => $instance->company_id,
                'task_key' => $step['task_key'],
                'title' => $step['title'],
                'description' => $step['description'],
                'assigned_role_slug' => $step['assigned_role_slug'],
                'status' => $hasPrereqs ? 'blocked' : 'ready',
                'prerequisite_task_keys' => $step['prerequisite_task_keys'],
                'due_date' => $instance->target_date,
            ]);
        }
    }

    /**
     * Completes a DAG task, verifies all prerequisite nodes are satisfied,
     * and cascades unlock to dependent successor nodes.
     */
    public function completeTask(LifecycleTask $task, int $actorUserId, ?string $notes = null): LifecycleTask
    {
        if ($task->status === 'completed') {
            return $task;
        }

        if (!$task->arePrerequisitesSatisfied()) {
            throw new InvalidArgumentException(
                "Task '{$task->title}' cannot be completed because its prerequisite tasks are still pending."
            );
        }

        return DB::transaction(function () use ($task, $actorUserId, $notes) {
            $task->update([
                'status' => 'completed',
                'completed_by_user_id' => $actorUserId,
                'completed_at' => now(),
                'execution_notes' => $notes,
            ]);

            // Cascade: unlock any successor tasks whose prerequisites are now satisfied
            $instanceTasks = LifecycleTask::where('lifecycle_instance_id', $task->lifecycle_instance_id)->get();
            foreach ($instanceTasks as $candidate) {
                if ($candidate->status === 'blocked' && $candidate->arePrerequisitesSatisfied()) {
                    $candidate->update(['status' => 'ready']);
                }
            }

            // Check if entire instance is now completed
            $unfinishedCount = LifecycleTask::where('lifecycle_instance_id', $task->lifecycle_instance_id)
                ->whereNotIn('status', ['completed', 'skipped'])
                ->count();

            if ($unfinishedCount === 0) {
                $task->instance->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                ]);
            }

            return $task->fresh();
        });
    }

    /**
     * Validates that the DAG contains no directed cycles using Kahn's algorithm or DFS.
     */
    public function validateDagAcyclicity(array $steps): void
    {
        $graph = [];
        $inDegree = [];

        foreach ($steps as $s) {
            $key = $s['task_key'];
            $graph[$key] = [];
            $inDegree[$key] = 0;
        }

        foreach ($steps as $s) {
            $key = $s['task_key'];
            foreach ($s['prerequisite_task_keys'] ?? [] as $prereq) {
                if (isset($graph[$prereq])) {
                    $graph[$prereq][] = $key;
                    $inDegree[$key]++;
                }
            }
        }

        $queue = [];
        foreach ($inDegree as $node => $deg) {
            if ($deg === 0) {
                $queue[] = $node;
            }
        }

        $visitedCount = 0;
        while (!empty($queue)) {
            $u = array_shift($queue);
            $visitedCount++;

            foreach ($graph[$u] as $v) {
                $inDegree[$v]--;
                if ($inDegree[$v] === 0) {
                    $queue[] = $v;
                }
            }
        }

        if ($visitedCount !== count($steps)) {
            throw new InvalidArgumentException("Workflow DAG validation error: cycle detected in task dependencies.");
        }
    }
}

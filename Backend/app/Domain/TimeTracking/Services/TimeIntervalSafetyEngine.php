<?php

namespace App\Domain\TimeTracking\Services;

use App\Models\TimeEntry;
use App\Models\WorkSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class TimeIntervalSafetyEngine
{
    /**
     * Mathematical Overlap Prevention:
     * Two intervals [A_s, A_e) and [B_s, B_e) overlap iff:
     * max(A_s, B_s) < min(A_e, B_e) <=> (A_s < B_e) AND (A_e > B_s)
     */
    public function validateNoOverlap(
        int $companyId,
        int $membershipId,
        Carbon $start,
        Carbon $end,
        ?int $excludeEntryId = null
    ): void {
        if ($start->greaterThanOrEqualTo($end)) {
            throw new InvalidArgumentException("Interval start time must precede end time.");
        }

        $conflictQuery = TimeEntry::where('company_id', $companyId)
            ->where('membership_id', $membershipId)
            ->where('started_at', '<', $end)
            ->where('ended_at', '>', $start);

        if ($excludeEntryId) {
            $conflictQuery->where('id', '!=', $excludeEntryId);
        }

        $conflict = $conflictQuery->first();

        if ($conflict) {
            throw new InvalidArgumentException(
                "Overlap violation: Proposed interval [{$start->toIso8601String()} - {$end->toIso8601String()}) " .
                "collides with existing entry #{$conflict->id} [{$conflict->started_at} - {$conflict->ended_at})."
            );
        }
    }

    /**
     * Start active stopwatch timer ensuring singleton active session per member
     */
    public function startWorkSession(
        int $companyId,
        int $membershipId,
        ?int $employmentRecordId = null,
        ?int $projectId = null,
        ?int $taskId = null,
        string $activityType = 'task'
    ): WorkSession {
        return DB::transaction(function () use ($companyId, $membershipId, $employmentRecordId, $projectId, $taskId, $activityType) {
            $active = WorkSession::where('company_id', $companyId)
                ->where('membership_id', $membershipId)
                ->where('status', 'running')
                ->lockForUpdate()
                ->first();

            if ($active) {
                throw new InvalidArgumentException("An active timer session (#{$active->id}) is already running. Stop it before starting a new timer.");
            }

            return WorkSession::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'employment_record_id' => $employmentRecordId,
                'project_id' => $projectId,
                'task_id' => $taskId,
                'activity_type' => $activityType,
                'status' => 'running',
                'started_at' => now(),
                'version' => 1,
            ]);
        });
    }

    /**
     * Stop active stopwatch timer with Optimistic Concurrency Control (OCC) and automatic entry conversion
     */
    public function stopWorkSession(
        int $sessionId,
        int $expectedVersion,
        ?string $description = null
    ): array {
        return DB::transaction(function () use ($sessionId, $expectedVersion, $description) {
            $session = WorkSession::where('id', $sessionId)->lockForUpdate()->firstOrFail();

            if ($session->status !== 'running') {
                throw new InvalidArgumentException("Work session #{$sessionId} is already {$session->status}.");
            }

            // Optimistic concurrency check
            if ($session->version !== $expectedVersion) {
                throw new InvalidArgumentException(
                    "Optimistic lock conflict: Session version has modified (expected v{$expectedVersion}, current v{$session->version})."
                );
            }

            $now = Carbon::now();
            $durationSeconds = max(1, $now->diffInSeconds($session->started_at));

            // Overlap check
            $this->validateNoOverlap(
                $session->company_id,
                $session->membership_id,
                Carbon::parse($session->started_at),
                $now
            );

            $session->status = 'stopped';
            $session->ended_at = $now;
            $session->duration_seconds = $durationSeconds;
            $session->version++;
            $session->save();

            // Convert to authoritative TimeEntry
            $timeEntry = TimeEntry::create([
                'company_id' => $session->company_id,
                'membership_id' => $session->membership_id,
                'employment_record_id' => $session->employment_record_id,
                'project_id' => $session->project_id,
                'task_id' => $session->task_id,
                'work_session_id' => $session->id,
                'started_at' => $session->started_at,
                'ended_at' => $now,
                'duration_seconds' => $durationSeconds,
                'source' => 'timer',
                'approval_status' => 'draft',
                'is_billable' => true,
                'description' => $description,
            ]);

            return [
                'session' => $session->fresh(),
                'time_entry' => $timeEntry,
            ];
        });
    }
}

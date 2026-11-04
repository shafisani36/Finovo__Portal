<?php

namespace App\Domain\TimeTracking\Services;

use App\Models\TimeEntry;
use App\Models\Timesheet;
use App\Models\TimesheetApproval;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class TimesheetAggregationService
{
    /**
     * Get or create a timesheet period container
     */
    public function getOrCreateTimesheet(
        int $companyId,
        int $membershipId,
        string $periodStart,
        string $periodEnd,
        ?int $employmentRecordId = null
    ): Timesheet {
        return Timesheet::firstOrCreate(
            [
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
            ],
            [
                'employment_record_id' => $employmentRecordId,
                'status' => 'draft',
                'version' => 1,
            ]
        );
    }

    /**
     * Submit timesheet and aggregate tracked hours from time entries
     */
    public function submitTimesheet(Timesheet $timesheet): Timesheet
    {
        return DB::transaction(function () use ($timesheet) {
            $entries = TimeEntry::where('company_id', $timesheet->company_id)
                ->where('membership_id', $timesheet->membership_id)
                ->where('started_at', '>=', $timesheet->period_start . ' 00:00:00')
                ->where('ended_at', '<=', $timesheet->period_end . ' 23:59:59')
                ->get();

            $totalSeconds = $entries->sum('duration_seconds');
            $billableSeconds = $entries->where('is_billable', true)->sum('duration_seconds');

            // Associate entries with timesheet
            TimeEntry::whereIn('id', $entries->pluck('id'))->update([
                'timesheet_id' => $timesheet->id,
                'approval_status' => 'submitted',
            ]);

            $timesheet->update([
                'status' => 'submitted',
                'total_tracked_seconds' => $totalSeconds,
                'total_submitted_seconds' => $totalSeconds,
                'total_billable_seconds' => $billableSeconds,
                'submitted_at' => now(),
                'version' => $timesheet->version + 1,
            ]);

            return $timesheet->fresh(['entries']);
        });
    }

    /**
     * Approve timesheet with strict maker-checker Separation of Duties (SoD)
     */
    public function approveTimesheet(
        Timesheet $timesheet,
        int $approverMembershipId,
        ?string $comments = null
    ): Timesheet {
        // Enforce dual custody / SoD: Submitter cannot approve their own timesheet
        if ($timesheet->membership_id === $approverMembershipId) {
            throw new InvalidArgumentException(
                "Separation of duties violation: Submitter (#{$timesheet->membership_id}) cannot approve their own timesheet."
            );
        }

        if ($timesheet->status !== 'submitted') {
            throw new InvalidArgumentException("Cannot approve timesheet with status '{$timesheet->status}'.");
        }

        return DB::transaction(function () use ($timesheet, $approverMembershipId, $comments) {
            $timesheet->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by_membership_id' => $approverMembershipId,
                'total_approved_seconds' => $timesheet->total_submitted_seconds,
                'version' => $timesheet->version + 1,
            ]);

            // Lock all linked entries as approved
            TimeEntry::where('timesheet_id', $timesheet->id)->update([
                'approval_status' => 'approved',
            ]);

            // Audit record
            TimesheetApproval::create([
                'company_id' => $timesheet->company_id,
                'timesheet_id' => $timesheet->id,
                'reviewer_membership_id' => $approverMembershipId,
                'action' => 'approved',
                'version_at_action' => $timesheet->version,
                'reason' => $comments ?? 'Approved by supervisor',
            ]);

            // Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $timesheet->company_id,
                'event_type' => 'timesheet.approved',
                'schema_version' => 1,
                'producer' => 'finovo_m08_timetracking',
                'payload' => json_encode([
                    'timesheet_id' => $timesheet->id,
                    'membership_id' => $timesheet->membership_id,
                    'approved_seconds' => $timesheet->total_approved_seconds,
                    'period_start' => $timesheet->period_start,
                    'period_end' => $timesheet->period_end,
                    'approver_membership_id' => $approverMembershipId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $timesheet->fresh(['entries', 'approvals']);
        });
    }
}

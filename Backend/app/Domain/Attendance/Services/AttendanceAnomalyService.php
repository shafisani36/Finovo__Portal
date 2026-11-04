<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceEvent;
use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AttendanceAnomalyService
{
    /**
     * Records a clock-in event and initializes or updates the daily attendance summary
     */
    public function recordClockIn(
        int $companyId,
        int $membershipId,
        ?int $employmentRecordId = null,
        ?string $occurredAt = null,
        string $source = 'web'
    ): AttendanceRecord {
        $timestamp = $occurredAt ? Carbon::parse($occurredAt) : Carbon::now();
        $workDate = $timestamp->toDateString();

        return DB::transaction(function () use ($companyId, $membershipId, $employmentRecordId, $timestamp, $workDate, $source) {
            // Find active shift assignment for today
            $assignment = ShiftAssignment::where('company_id', $companyId)
                ->where('membership_id', $membershipId)
                ->where('effective_from', '<=', $workDate)
                ->where(function ($q) use ($workDate) {
                    $q->whereNull('effective_to')->orWhere('effective_to', '>=', $workDate);
                })
                ->first();

            $shift = $assignment?->shift;

            $record = AttendanceRecord::firstOrCreate(
                [
                    'company_id' => $companyId,
                    'membership_id' => $membershipId,
                    'work_date' => $workDate,
                ],
                [
                    'employment_record_id' => $employmentRecordId,
                    'shift_id' => $shift?->id,
                    'status' => 'present',
                    'first_clock_in_at' => $timestamp,
                    'worked_seconds' => 0,
                    'version' => 1,
                ]
            );

            if (!$record->first_clock_in_at) {
                $record->first_clock_in_at = $timestamp;
            }

            if ($shift && !$record->shift_id) {
                $record->shift_id = $shift->id;
            }

            // Check for tardiness if shift is defined
            if ($shift) {
                $scheduledStart = Carbon::parse($workDate . ' ' . $shift->start_time);
                $graceThreshold = $scheduledStart->copy()->addMinutes($shift->grace_period_minutes);

                if ($timestamp->greaterThan($graceThreshold)) {
                    $record->late_seconds = (int) abs($timestamp->diffInSeconds($scheduledStart, false));
                    $record->status = 'late';
                }
            }

            $record->version++;
            $record->save();

            // Record immutable event
            AttendanceEvent::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'attendance_record_id' => $record->id,
                'event_type' => 'clock_in',
                'occurred_at' => $timestamp,
                'received_at' => now(),
                'source' => $source,
            ]);

            return $record->fresh();
        });
    }

    /**
     * Records a clock-out event, computes worked seconds, early departure, and overtime
     */
    public function recordClockOut(
        int $companyId,
        int $membershipId,
        ?string $occurredAt = null,
        string $source = 'web'
    ): AttendanceRecord {
        $timestamp = $occurredAt ? Carbon::parse($occurredAt) : Carbon::now();
        $workDate = $timestamp->toDateString();

        return DB::transaction(function () use ($companyId, $membershipId, $timestamp, $workDate, $source) {
            $record = AttendanceRecord::where('company_id', $companyId)
                ->where('membership_id', $membershipId)
                ->where('work_date', $workDate)
                ->lockForUpdate()
                ->first();

            if (!$record || !$record->first_clock_in_at) {
                throw new InvalidArgumentException("Cannot clock out without prior clock-in on {$workDate}.");
            }

            $record->last_clock_out_at = $timestamp;
            $clockIn = Carbon::parse($record->first_clock_in_at);
            $durationSeconds = (int) abs($timestamp->diffInSeconds($clockIn, false));
            $record->worked_seconds = $durationSeconds;

            if ($record->shift_id) {
                $shift = Shift::find($record->shift_id);
                if ($shift) {
                    $scheduledEnd = Carbon::parse($workDate . ' ' . $shift->end_time);
                    if ($shift->is_overnight) {
                        $scheduledEnd->addDay();
                    }

                    if ($timestamp->lessThan($scheduledEnd)) {
                        $record->early_departure_seconds = $scheduledEnd->diffInSeconds($timestamp);
                    } elseif ($timestamp->greaterThan($scheduledEnd->copy()->addMinutes(30))) {
                        $record->is_overtime = true;
                    }
                }
            }

            $record->version++;
            $record->save();

            AttendanceEvent::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'attendance_record_id' => $record->id,
                'event_type' => 'clock_out',
                'occurred_at' => $timestamp,
                'received_at' => now(),
                'source' => $source,
            ]);

            return $record->fresh();
        });
    }
}

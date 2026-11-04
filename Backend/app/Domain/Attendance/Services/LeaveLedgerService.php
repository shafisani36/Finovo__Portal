<?php

namespace App\Domain\Attendance\Services;

use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceTransaction;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class LeaveLedgerService
{
    /**
     * Accrue leave into employee ledger
     */
    public function accrue(int $companyId, int $membershipId, int $leaveTypeId, float $days, string $notes = 'Periodic Accrual'): LeaveBalanceTransaction
    {
        return DB::transaction(function () use ($companyId, $membershipId, $leaveTypeId, $days, $notes) {
            $year = (int) date('Y');
            $balance = LeaveBalance::firstOrCreate(
                [
                    'company_id' => $companyId,
                    'membership_id' => $membershipId,
                    'leave_type_id' => $leaveTypeId,
                    'year' => $year,
                ],
                [
                    'opening_days' => 0.00,
                    'accrued_days' => 0.00,
                    'used_days' => 0.00,
                    'reserved_days' => 0.00,
                    'available_days' => 0.00,
                ]
            );

            $balance->accrued_days += $days;
            $balance->available_days += $days;
            $balance->save();

            return LeaveBalanceTransaction::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'leave_type_id' => $leaveTypeId,
                'transaction_type' => 'accrual',
                'days' => $days,
                'balance_after' => $balance->available_days,
                'reference_type' => 'periodic_accrual',
                'notes' => $notes,
            ]);
        });
    }

    /**
     * Submit leave request with atomic balance reservation & overdraft protection
     */
    public function requestLeave(
        int $companyId,
        int $membershipId,
        int $leaveTypeId,
        string $startDate,
        string $endDate,
        float $requestedDays,
        string $reason
    ): LeaveRequest {
        return DB::transaction(function () use ($companyId, $membershipId, $leaveTypeId, $startDate, $endDate, $requestedDays, $reason) {
            $year = (int) Carbon::parse($startDate)->format('Y');

            $balance = LeaveBalance::where('company_id', $companyId)
                ->where('membership_id', $membershipId)
                ->where('leave_type_id', $leaveTypeId)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            $policy = LeavePolicy::where('company_id', $companyId)
                ->where('leave_type_id', $leaveTypeId)
                ->first();

            $allowNegative = $policy?->negative_balance_allowed ?? false;

            $currentAvailable = $balance ? (float) $balance->available_days : 0.00;

            if (!$allowNegative && $currentAvailable < $requestedDays) {
                throw new InvalidArgumentException(
                    "Insufficient leave balance: requested {$requestedDays} days but only {$currentAvailable} days available."
                );
            }

            if (!$balance) {
                $balance = LeaveBalance::create([
                    'company_id' => $companyId,
                    'membership_id' => $membershipId,
                    'leave_type_id' => $leaveTypeId,
                    'year' => $year,
                    'available_days' => 0.00,
                ]);
            }

            // Reserve days
            $balance->reserved_days += $requestedDays;
            $balance->available_days -= $requestedDays;
            $balance->save();

            $leaveRequest = LeaveRequest::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'leave_type_id' => $leaveTypeId,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'requested_units' => $requestedDays,
                'day_portion' => 'full',
                'reason' => $reason,
                'status' => 'submitted',
            ]);

            // Append-only ledger transaction
            LeaveBalanceTransaction::create([
                'company_id' => $companyId,
                'membership_id' => $membershipId,
                'leave_type_id' => $leaveTypeId,
                'transaction_type' => 'reservation',
                'days' => -$requestedDays,
                'balance_after' => $balance->available_days,
                'reference_type' => 'leave_request',
                'reference_id' => $leaveRequest->id,
                'notes' => "Reserved {$requestedDays} days for pending request #{$leaveRequest->id}",
            ]);

            return $leaveRequest;
        });
    }

    /**
     * Approve leave request, converting reserved days to used days
     */
    public function approveLeave(int $leaveRequestId, int $approverMembershipId, ?string $notes = null): LeaveRequest
    {
        return DB::transaction(function () use ($leaveRequestId, $approverMembershipId, $notes) {
            $leaveRequest = LeaveRequest::where('id', $leaveRequestId)->lockForUpdate()->firstOrFail();

            if ($leaveRequest->status !== 'submitted') {
                throw new InvalidArgumentException("Cannot approve leave request with status '{$leaveRequest->status}'.");
            }

            $year = (int) Carbon::parse($leaveRequest->start_date)->format('Y');
            $balance = LeaveBalance::where('company_id', $leaveRequest->company_id)
                ->where('membership_id', $leaveRequest->membership_id)
                ->where('leave_type_id', $leaveRequest->leave_type_id)
                ->where('year', $year)
                ->lockForUpdate()
                ->firstOrFail();

            // Convert reserved to used
            $balance->reserved_days -= $leaveRequest->requested_units;
            $balance->used_days += $leaveRequest->requested_units;
            $balance->save();

            $leaveRequest->update(['status' => 'approved']);

            // Audit approval
            LeaveApproval::create([
                'company_id' => $leaveRequest->company_id,
                'leave_request_id' => $leaveRequest->id,
                'reviewer_membership_id' => $approverMembershipId,
                'action' => 'approved',
                'reason' => $notes ?? 'Approved by manager',
            ]);

            // Append-only ledger transaction
            LeaveBalanceTransaction::create([
                'company_id' => $leaveRequest->company_id,
                'membership_id' => $leaveRequest->membership_id,
                'leave_type_id' => $leaveRequest->leave_type_id,
                'transaction_type' => 'usage',
                'days' => (float) $leaveRequest->requested_units,
                'balance_after' => $balance->available_days,
                'reference_type' => 'leave_request',
                'reference_id' => $leaveRequest->id,
                'notes' => "Usage confirmed upon approval of request #{$leaveRequest->id}",
            ]);

            // Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $leaveRequest->company_id,
                'event_type' => 'leave.approved',
                'schema_version' => 1,
                'producer' => 'finovo_m07_attendance',
                'payload' => json_encode([
                    'leave_request_id' => $leaveRequest->id,
                    'membership_id' => $leaveRequest->membership_id,
                    'days' => $leaveRequest->requested_units,
                    'start_date' => $leaveRequest->start_date,
                    'end_date' => $leaveRequest->end_date,
                    'approver_membership_id' => $approverMembershipId,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $leaveRequest->fresh();
        });
    }

    /**
     * Reject leave request, releasing reserved days back to available balance
     */
    public function rejectLeave(int $leaveRequestId, int $approverMembershipId, ?string $reason = null): LeaveRequest
    {
        return DB::transaction(function () use ($leaveRequestId, $approverMembershipId, $reason) {
            $leaveRequest = LeaveRequest::where('id', $leaveRequestId)->lockForUpdate()->firstOrFail();

            if ($leaveRequest->status !== 'submitted') {
                throw new InvalidArgumentException("Cannot reject leave request with status '{$leaveRequest->status}'.");
            }

            $year = (int) Carbon::parse($leaveRequest->start_date)->format('Y');
            $balance = LeaveBalance::where('company_id', $leaveRequest->company_id)
                ->where('membership_id', $leaveRequest->membership_id)
                ->where('leave_type_id', $leaveRequest->leave_type_id)
                ->where('year', $year)
                ->lockForUpdate()
                ->firstOrFail();

            // Release reserved days back to available
            $balance->reserved_days -= $leaveRequest->requested_units;
            $balance->available_days += $leaveRequest->requested_units;
            $balance->save();

            $leaveRequest->update(['status' => 'rejected']);

            LeaveApproval::create([
                'company_id' => $leaveRequest->company_id,
                'leave_request_id' => $leaveRequest->id,
                'reviewer_membership_id' => $approverMembershipId,
                'action' => 'rejected',
                'reason' => $reason ?? 'Rejected by manager',
            ]);

            LeaveBalanceTransaction::create([
                'company_id' => $leaveRequest->company_id,
                'membership_id' => $leaveRequest->membership_id,
                'leave_type_id' => $leaveRequest->leave_type_id,
                'transaction_type' => 'release',
                'days' => (float) $leaveRequest->requested_units,
                'balance_after' => $balance->available_days,
                'reference_type' => 'leave_request',
                'reference_id' => $leaveRequest->id,
                'notes' => "Released {$leaveRequest->requested_units} days upon rejection of request #{$leaveRequest->id}",
            ]);

            return $leaveRequest->fresh();
        });
    }
}

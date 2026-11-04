<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceTransaction;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use App\Models\LeaveRequestDay;
use App\Models\LeaveType;
use App\Models\SecurityAuditEvent;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function ensureDefaultLeaveTypes(Company $company): void
    {
        $types = [
            [
                'name' => 'Annual Leave',
                'code' => 'AL',
                'is_paid' => true,
                'requires_balance' => true,
                'allow_half_day' => true,
                'allow_partial_day' => false,
                'color' => '#10B981',
                'max_consecutive_days' => 14,
                'annual_days' => 14.00,
            ],
            [
                'name' => 'Sick Leave',
                'code' => 'SL',
                'is_paid' => true,
                'requires_balance' => true,
                'allow_half_day' => true,
                'allow_partial_day' => false,
                'color' => '#EF4444',
                'max_consecutive_days' => 7,
                'annual_days' => 10.00,
            ],
            [
                'name' => 'Casual Leave',
                'code' => 'CL',
                'is_paid' => true,
                'requires_balance' => true,
                'allow_half_day' => true,
                'allow_partial_day' => false,
                'color' => '#F59E0B',
                'max_consecutive_days' => 3,
                'annual_days' => 6.00,
            ],
            [
                'name' => 'Unpaid Leave',
                'code' => 'UL',
                'is_paid' => false,
                'requires_balance' => false,
                'allow_half_day' => true,
                'allow_partial_day' => true,
                'color' => '#6B7280',
                'max_consecutive_days' => 30,
                'annual_days' => 0.00,
            ],
        ];

        foreach ($types as $t) {
            $createdType = LeaveType::firstOrCreate(
                ['company_id' => $company->id, 'name' => $t['name']],
                [
                    'company_id' => $company->id,
                    'code' => $t['code'],
                    'is_paid' => $t['is_paid'],
                    'requires_balance' => $t['requires_balance'],
                    'allow_half_day' => $t['allow_half_day'],
                    'allow_partial_day' => $t['allow_partial_day'],
                    'color' => $t['color'],
                    'max_consecutive_days' => $t['max_consecutive_days'],
                    'is_active' => true,
                ]
            );

            // Ensure policy exists
            LeavePolicy::firstOrCreate(
                ['company_id' => $company->id, 'leave_type_id' => $createdType->id],
                [
                    'annual_accrual_days' => $t['annual_days'],
                    'accrual_frequency' => 'annually',
                    'carry_forward_limit_days' => 5.00,
                    'negative_balance_allowed' => false,
                    'min_notice_days' => 1,
                    'effective_from' => Carbon::now()->startOfYear()->toDateString(),
                ]
            );
        }
    }

    private function getOrCreateBalance(Company $company, CompanyMembership $membership, LeaveType $leaveType, int $year): LeaveBalance
    {
        $balance = LeaveBalance::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('leave_type_id', $leaveType->id)
            ->where('year', $year)
            ->first();

        if (!$balance) {
            $policy = LeavePolicy::where('company_id', $company->id)
                ->where('leave_type_id', $leaveType->id)
                ->first();

            $allowance = $policy ? (float) $policy->annual_accrual_days : 14.00;

            $balance = LeaveBalance::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'leave_type_id' => $leaveType->id,
                'year' => $year,
                'opening_days' => $allowance,
                'accrued_days' => 0.00,
                'used_days' => 0.00,
                'reserved_days' => 0.00,
                'carried_over_days' => 0.00,
                'adjusted_days' => 0.00,
                'available_days' => $allowance,
            ]);

            if ($allowance > 0) {
                LeaveBalanceTransaction::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'leave_type_id' => $leaveType->id,
                    'transaction_type' => 'accrual',
                    'days' => $allowance,
                    'balance_after' => $allowance,
                    'notes' => "Initial yearly allowance for {$year}",
                ]);
            }
        }

        return $balance;
    }

    // ==========================================
    // 1. LEAVE TYPES & BALANCES (FR-05, FR-08)
    // ==========================================

    public function types(Request $request, Company $company): JsonResponse
    {
        $this->ensureDefaultLeaveTypes($company);
        $types = LeaveType::where('company_id', $company->id)
            ->where('is_active', true)
            ->with('policy')
            ->get();

        return response()->json(['leave_types' => $types]);
    }

    public function myBalances(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $this->ensureDefaultLeaveTypes($company);

        $year = (int) $request->get('year', Carbon::now()->year);
        $types = LeaveType::where('company_id', $company->id)->where('is_active', true)->get();

        $balances = [];
        foreach ($types as $type) {
            $bal = $this->getOrCreateBalance($company, $membership, $type, $year);
            $balances[] = [
                'leave_type' => $type,
                'year' => $year,
                'opening_days' => (float) $bal->opening_days,
                'accrued_days' => (float) $bal->accrued_days,
                'used_days' => (float) $bal->used_days,
                'reserved_days' => (float) $bal->reserved_days,
                'adjusted_days' => (float) $bal->adjusted_days,
                'available_days' => (float) $bal->available_days,
            ];
        }

        return response()->json([
            'year' => $year,
            'balances' => $balances,
        ]);
    }

    // ==========================================
    // 2. LEAVE REQUESTS (FR-06, FR-07)
    // ==========================================

    public function requests(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = LeaveRequest::where('company_id', $company->id)
            ->with(['leaveType', 'membership.user', 'days', 'approvals.reviewerMembership.user']);

        $canViewAll = $membership->hasPermission('leave.view_company') || $membership->hasRole(['company-admin', 'company-owner', 'hr-officer']);
        $canViewTeam = $membership->hasPermission('leave.view_team') || $membership->hasRole(['project-manager']);

        if (!$canViewAll && !$canViewTeam) {
            $query->where('membership_id', $membership->id);
        } elseif ($request->filled('membership_id')) {
            $query->where('membership_id', $request->membership_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('leave_type_id')) {
            $query->where('leave_type_id', $request->leave_type_id);
        }

        $requests = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json($requests);
    }

    public function submitRequest(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'leave_type_id' => 'required|exists:leave_types,id',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'day_portion' => 'required|string|in:full,first_half,second_half',
            'reason' => 'required|string|max:1000',
        ]);

        $leaveType = LeaveType::where('company_id', $company->id)
            ->whereKey($validated['leave_type_id'])
            ->firstOrFail();

        $startDate = Carbon::parse($validated['start_date']);
        $endDate = Carbon::parse($validated['end_date']);
        $year = $startDate->year;

        // 1. Check for overlapping requests
        $overlap = LeaveRequest::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->whereIn('status', ['submitted', 'pending', 'approved'])
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhere(function ($sub) use ($startDate, $endDate) {
                      $sub->where('start_date', '<=', $startDate->toDateString())
                          ->where('end_date', '>=', $endDate->toDateString());
                  });
            })
            ->exists();

        if ($overlap) {
            return response()->json(['message' => 'An active or pending leave request already overlaps with these dates.'], 422);
        }

        // 2. Calculate leave units (skip Saturdays/Sundays as non-working days by default)
        $period = CarbonPeriod::create($startDate, $endDate);
        $dayBreakdowns = [];
        $totalUnits = 0.0;

        foreach ($period as $date) {
            if ($date->isWeekend()) {
                continue;
            }

            $portion = $validated['day_portion'];
            $unit = ($portion === 'first_half' || $portion === 'second_half') ? 0.5 : 1.0;

            $totalUnits += $unit;
            $dayBreakdowns[] = [
                'date' => $date->toDateString(),
                'units' => $unit,
            ];
        }

        if ($totalUnits <= 0) {
            return response()->json(['message' => 'The selected date range contains no working days.'], 422);
        }

        // 3. Balance Validation
        $balance = $this->getOrCreateBalance($company, $membership, $leaveType, $year);
        if ($leaveType->requires_balance && $balance->available_days < $totalUnits) {
            return response()->json([
                'message' => "Insufficient leave balance. You have {$balance->available_days} days available, but requested {$totalUnits} days.",
            ], 422);
        }

        return DB::transaction(function () use ($company, $membership, $leaveType, $balance, $validated, $startDate, $endDate, $totalUnits, $dayBreakdowns) {
            // Create leave request
            $leaveRequest = LeaveRequest::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'leave_type_id' => $leaveType->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'requested_units' => $totalUnits,
                'day_portion' => $validated['day_portion'],
                'reason' => $validated['reason'],
                'status' => 'pending',
                'submitted_at' => Carbon::now('UTC'),
                'version' => 1,
            ]);

            // Create breakdown days
            foreach ($dayBreakdowns as $day) {
                LeaveRequestDay::create([
                    'company_id' => $company->id,
                    'leave_request_id' => $leaveRequest->id,
                    'work_date' => $day['date'],
                    'units' => $day['units'],
                    'is_working_day' => true,
                ]);
            }

            // Reserve units on balance ledger
            if ($leaveType->requires_balance) {
                $balance->increment('reserved_days', $totalUnits);
                $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
                $balance->update(['available_days' => $newAvailable]);

                LeaveBalanceTransaction::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'leave_type_id' => $leaveType->id,
                    'transaction_type' => 'reservation',
                    'days' => $totalUnits,
                    'balance_after' => $newAvailable,
                    'reference_type' => LeaveRequest::class,
                    'reference_id' => $leaveRequest->id,
                    'notes' => "Reservation for leave request #{$leaveRequest->id}",
                ]);
            }

            SecurityAuditEvent::record(
                'leave.requested',
                $membership->user_id,
                $company->id,
                LeaveRequest::class,
                $leaveRequest->id,
                [
                    'leave_type' => $leaveType->name,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'requested_units' => $totalUnits,
                ]
            );

            return response()->json([
                'message' => 'Leave request submitted successfully.',
                'leave_request' => $leaveRequest->load(['days', 'leaveType']),
            ], 201);
        });
    }

    public function showRequest(Request $request, Company $company, int $id): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $leaveRequest = LeaveRequest::where('company_id', $company->id)
            ->whereKey($id)
            ->with(['leaveType', 'membership.user', 'days', 'approvals.reviewerMembership.user'])
            ->firstOrFail();

        $canViewAll = $membership->hasPermission('leave.view_company') || $membership->hasRole(['company-admin', 'company-owner', 'hr-officer', 'project-manager']);
        if (!$canViewAll && $leaveRequest->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json(['leave_request' => $leaveRequest]);
    }

    // ==========================================
    // 3. APPROVAL & REJECTION (FR-07)
    // ==========================================

    public function approveRequest(Request $request, Company $company, int $id): JsonResponse
    {
        $reviewerMembership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'decision_reason' => 'nullable|string|max:500',
        ]);

        $leaveRequest = LeaveRequest::where('company_id', $company->id)
            ->whereKey($id)
            ->whereIn('status', ['submitted', 'pending'])
            ->firstOrFail();

        // Separation of Duties: Approver CANNOT approve their own request
        if ($leaveRequest->membership_id === $reviewerMembership->id) {
            return response()->json(['message' => 'Separation of Duties violation: You cannot approve your own leave request.'], 403);
        }

        return DB::transaction(function () use ($company, $reviewerMembership, $leaveRequest, $validated) {
            $leaveType = $leaveRequest->leaveType;
            $units = (float) $leaveRequest->requested_units;
            $year = Carbon::parse($leaveRequest->start_date)->year;

            // Update balance ledger: Move reservation to usage
            if ($leaveType->requires_balance) {
                $balance = $this->getOrCreateBalance($company, $leaveRequest->membership, $leaveType, $year);

                $balance->decrement('reserved_days', $units);
                $balance->increment('used_days', $units);
                $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
                $balance->update(['available_days' => $newAvailable]);

                LeaveBalanceTransaction::create([
                    'company_id' => $company->id,
                    'membership_id' => $leaveRequest->membership_id,
                    'leave_type_id' => $leaveType->id,
                    'transaction_type' => 'usage',
                    'days' => -$units,
                    'balance_after' => $newAvailable,
                    'reference_type' => LeaveRequest::class,
                    'reference_id' => $leaveRequest->id,
                    'notes' => "Approved leave deduction for request #{$leaveRequest->id}",
                ]);
            }

            $nowUtc = Carbon::now('UTC');
            $leaveRequest->update([
                'status' => 'approved',
                'reviewed_at' => $nowUtc,
                'reviewed_by_membership_id' => $reviewerMembership->id,
                'version' => $leaveRequest->version + 1,
            ]);

            // Create leave approval record
            LeaveApproval::create([
                'company_id' => $company->id,
                'leave_request_id' => $leaveRequest->id,
                'reviewer_membership_id' => $reviewerMembership->id,
                'action' => 'approved',
                'reason' => $validated['decision_reason'] ?? 'Approved',
            ]);

            // Recalculate daily attendance: mark employee as 'on_leave' for all requested days
            $days = LeaveRequestDay::where('leave_request_id', $leaveRequest->id)->get();
            foreach ($days as $day) {
                AttendanceRecord::updateOrCreate(
                    [
                        'company_id' => $company->id,
                        'membership_id' => $leaveRequest->membership_id,
                        'work_date' => $day->work_date,
                    ],
                    [
                        'status' => 'on_leave',
                        'is_approved_leave' => true,
                    ]
                );
            }

            SecurityAuditEvent::record(
                'leave.approved',
                $reviewerMembership->user_id,
                $company->id,
                LeaveRequest::class,
                $leaveRequest->id,
                ['reviewer' => $reviewerMembership->user_id, 'units' => $units]
            );

            return response()->json([
                'message' => 'Leave request approved successfully.',
                'leave_request' => $leaveRequest->fresh(['days', 'approvals']),
            ]);
        });
    }

    public function rejectRequest(Request $request, Company $company, int $id): JsonResponse
    {
        $reviewerMembership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'decision_reason' => 'required|string|max:500',
        ]);

        $leaveRequest = LeaveRequest::where('company_id', $company->id)
            ->whereKey($id)
            ->whereIn('status', ['submitted', 'pending'])
            ->firstOrFail();

        // Separation of Duties: Reviewer cannot decide their own request
        if ($leaveRequest->membership_id === $reviewerMembership->id) {
            return response()->json(['message' => 'Separation of Duties violation: You cannot reject your own leave request.'], 403);
        }

        return DB::transaction(function () use ($company, $reviewerMembership, $leaveRequest, $validated) {
            $leaveType = $leaveRequest->leaveType;
            $units = (float) $leaveRequest->requested_units;
            $year = Carbon::parse($leaveRequest->start_date)->year;

            // Release balance reservation
            if ($leaveType->requires_balance) {
                $balance = $this->getOrCreateBalance($company, $leaveRequest->membership, $leaveType, $year);
                $balance->decrement('reserved_days', $units);
                $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
                $balance->update(['available_days' => $newAvailable]);

                LeaveBalanceTransaction::create([
                    'company_id' => $company->id,
                    'membership_id' => $leaveRequest->membership_id,
                    'leave_type_id' => $leaveType->id,
                    'transaction_type' => 'release',
                    'days' => $units,
                    'balance_after' => $newAvailable,
                    'reference_type' => LeaveRequest::class,
                    'reference_id' => $leaveRequest->id,
                    'notes' => "Released reservation for rejected leave request #{$leaveRequest->id}",
                ]);
            }

            $nowUtc = Carbon::now('UTC');
            $leaveRequest->update([
                'status' => 'rejected',
                'rejection_reason' => $validated['decision_reason'],
                'reviewed_at' => $nowUtc,
                'reviewed_by_membership_id' => $reviewerMembership->id,
                'version' => $leaveRequest->version + 1,
            ]);

            LeaveApproval::create([
                'company_id' => $company->id,
                'leave_request_id' => $leaveRequest->id,
                'reviewer_membership_id' => $reviewerMembership->id,
                'action' => 'rejected',
                'reason' => $validated['decision_reason'],
            ]);

            SecurityAuditEvent::record(
                'leave.rejected',
                $reviewerMembership->user_id,
                $company->id,
                LeaveRequest::class,
                $leaveRequest->id,
                ['reviewer' => $reviewerMembership->user_id, 'reason' => $validated['decision_reason']]
            );

            return response()->json([
                'message' => 'Leave request rejected.',
                'leave_request' => $leaveRequest->fresh(['days', 'approvals']),
            ]);
        });
    }

    // ==========================================
    // 4. CANCELLATION (FR-06)
    // ==========================================

    public function cancelRequest(Request $request, Company $company, int $id): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $leaveRequest = LeaveRequest::where('company_id', $company->id)
            ->whereKey($id)
            ->firstOrFail();

        $isAdmin = $membership->hasRole(['company-admin', 'company-owner', 'hr-officer']);
        if (!$isAdmin && $leaveRequest->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized to cancel this leave request.'], 403);
        }

        if (!in_array($leaveRequest->status, ['submitted', 'pending', 'approved'])) {
            return response()->json(['message' => 'Only pending or approved requests can be cancelled.'], 422);
        }

        return DB::transaction(function () use ($company, $membership, $leaveRequest) {
            $leaveType = $leaveRequest->leaveType;
            $units = (float) $leaveRequest->requested_units;
            $year = Carbon::parse($leaveRequest->start_date)->year;
            $balance = $this->getOrCreateBalance($company, $leaveRequest->membership, $leaveType, $year);

            if (in_array($leaveRequest->status, ['submitted', 'pending'])) {
                if ($leaveType->requires_balance) {
                    $balance->decrement('reserved_days', $units);
                    $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
                    $balance->update(['available_days' => $newAvailable]);

                    LeaveBalanceTransaction::create([
                        'company_id' => $company->id,
                        'membership_id' => $leaveRequest->membership_id,
                        'leave_type_id' => $leaveType->id,
                        'transaction_type' => 'release',
                        'days' => $units,
                        'balance_after' => $newAvailable,
                        'reference_type' => LeaveRequest::class,
                        'reference_id' => $leaveRequest->id,
                        'notes' => "Released reservation due to cancellation of pending request #{$leaveRequest->id}",
                    ]);
                }
            } elseif ($leaveRequest->status === 'approved') {
                if ($leaveType->requires_balance) {
                    $balance->decrement('used_days', $units);
                    $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
                    $balance->update(['available_days' => $newAvailable]);

                    LeaveBalanceTransaction::create([
                        'company_id' => $company->id,
                        'membership_id' => $leaveRequest->membership_id,
                        'leave_type_id' => $leaveType->id,
                        'transaction_type' => 'adjustment',
                        'days' => $units,
                        'balance_after' => $newAvailable,
                        'reference_type' => LeaveRequest::class,
                        'reference_id' => $leaveRequest->id,
                        'notes' => "Compensating adjustment for cancelled approved leave #{$leaveRequest->id}",
                    ]);
                }

                $days = LeaveRequestDay::where('leave_request_id', $leaveRequest->id)->get();
                foreach ($days as $day) {
                    $att = AttendanceRecord::where('company_id', $company->id)
                        ->where('membership_id', $leaveRequest->membership_id)
                        ->where('work_date', $day->work_date)
                        ->first();
                    if ($att && $att->is_approved_leave) {
                        $att->update(['status' => 'not_clocked_in', 'is_approved_leave' => false]);
                    }
                }
            }

            $leaveRequest->update(['status' => 'cancelled']);

            LeaveApproval::create([
                'company_id' => $company->id,
                'leave_request_id' => $leaveRequest->id,
                'reviewer_membership_id' => $membership->id,
                'action' => 'cancelled',
                'reason' => 'Request cancelled by user',
            ]);

            SecurityAuditEvent::record(
                'leave.cancelled',
                $membership->user_id,
                $company->id,
                LeaveRequest::class,
                $leaveRequest->id,
                ['cancelled_by' => $membership->user_id]
            );

            return response()->json([
                'message' => 'Leave request cancelled successfully.',
                'leave_request' => $leaveRequest->fresh(),
            ]);
        });
    }

    // ==========================================
    // 5. BALANCE ADJUSTMENT (FR-08)
    // ==========================================

    public function adjustBalance(Request $request, Company $company, int $membershipId): JsonResponse
    {
        $actorMembership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'leave_type_id' => 'required|exists:leave_types,id',
            'units' => 'required|numeric',
            'reason' => 'required|string|max:500',
            'year' => 'nullable|integer',
        ]);

        $targetMembership = CompanyMembership::where('company_id', $company->id)
            ->whereKey($membershipId)
            ->firstOrFail();

        $leaveType = LeaveType::where('company_id', $company->id)
            ->whereKey($validated['leave_type_id'])
            ->firstOrFail();

        $year = $validated['year'] ?? Carbon::now()->year;

        return DB::transaction(function () use ($company, $actorMembership, $targetMembership, $leaveType, $year, $validated) {
            $balance = $this->getOrCreateBalance($company, $targetMembership, $leaveType, $year);
            $units = (float) $validated['units'];

            $balance->increment('adjusted_days', $units);
            $newAvailable = max(0, $balance->opening_days + $balance->accrued_days + $balance->adjusted_days - $balance->used_days - $balance->reserved_days);
            $balance->update(['available_days' => $newAvailable]);

            $transaction = LeaveBalanceTransaction::create([
                'company_id' => $company->id,
                'membership_id' => $targetMembership->id,
                'leave_type_id' => $leaveType->id,
                'transaction_type' => 'adjustment',
                'days' => $units,
                'balance_after' => $newAvailable,
                'notes' => $validated['reason'],
            ]);

            SecurityAuditEvent::record(
                'leave.balance.adjusted',
                $actorMembership->user_id,
                $company->id,
                LeaveBalance::class,
                $balance->id,
                ['units' => $units, 'reason' => $validated['reason'], 'target_member' => $targetMembership->id]
            );

            return response()->json([
                'message' => 'Leave balance adjusted successfully.',
                'balance' => $balance->fresh(),
                'transaction' => $transaction,
            ]);
        });
    }

    // ==========================================
    // 6. PENDING APPROVALS QUEUE (FR-07)
    // ==========================================

    public function pendingApprovals(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $leaveRequests = LeaveRequest::where('company_id', $company->id)
            ->whereIn('status', ['submitted', 'pending'])
            ->where('membership_id', '!=', $membership->id)
            ->with(['membership.user', 'leaveType', 'days'])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'pending_requests' => $leaveRequests,
            'count' => $leaveRequests->count(),
        ]);
    }

    // ==========================================
    // 7. SUMMARY REPORT (FR-10)
    // ==========================================

    public function summaryReport(Request $request, Company $company): JsonResponse
    {
        $year = (int) $request->get('year', Carbon::now()->year);

        $types = LeaveType::where('company_id', $company->id)->where('is_active', true)->get();
        $balances = LeaveBalance::where('company_id', $company->id)
            ->where('year', $year)
            ->with(['membership.user', 'leaveType'])
            ->get();

        $summary = [
            'total_balances' => $balances->count(),
            'total_days_used' => (float) $balances->sum('used_days'),
            'total_days_reserved' => (float) $balances->sum('reserved_days'),
            'by_type' => $types->map(function ($t) use ($balances) {
                $subset = $balances->where('leave_type_id', $t->id);
                return [
                    'type_id' => $t->id,
                    'type_name' => $t->name,
                    'color' => $t->color,
                    'used' => (float) $subset->sum('used_days'),
                    'reserved' => (float) $subset->sum('reserved_days'),
                ];
            }),
        ];

        return response()->json([
            'year' => $year,
            'summary' => $summary,
            'balances' => $balances,
        ]);
    }
}

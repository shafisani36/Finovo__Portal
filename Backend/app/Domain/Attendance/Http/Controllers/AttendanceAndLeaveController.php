<?php

namespace App\Domain\Attendance\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Attendance\Services\AttendanceAnomalyService;
use App\Domain\Attendance\Services\LeaveLedgerService;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceTransaction;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceAndLeaveController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected AttendanceAnomalyService $attendanceService,
        protected LeaveLedgerService $leaveService
    ) {}

    /**
     * Daily clock-in
     */
    public function clockIn(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $employmentRecord = $membership->employmentRecords()->first();

        $record = $this->attendanceService->recordClockIn(
            $company->id,
            $membership->id,
            $employmentRecord?->id,
            $request->input('occurred_at'),
            $request->input('source', 'web')
        );

        return response()->json([
            'success' => true,
            'message' => 'Clock-in recorded successfully.',
            'data' => $record,
        ]);
    }

    /**
     * Daily clock-out
     */
    public function clockOut(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        try {
            $record = $this->attendanceService->recordClockOut(
                $company->id,
                $membership->id,
                $request->input('occurred_at'),
                $request->input('source', 'web')
            );

            return response()->json([
                'success' => true,
                'message' => 'Clock-out recorded successfully.',
                'data' => $record,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Get employee leave balances & ledger
     */
    public function getLeaveBalances(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $targetMembershipId = $request->input('membership_id', $membership->id);

        $balances = LeaveBalance::where('company_id', $company->id)
            ->where('membership_id', $targetMembershipId)
            ->with('leaveType')
            ->get();

        $transactions = LeaveBalanceTransaction::where('company_id', $company->id)
            ->where('membership_id', $targetMembershipId)
            ->with('leaveType')
            ->orderByDesc('id')
            ->take(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'balances' => $balances,
                'transactions' => $transactions,
            ],
        ]);
    }

    /**
     * Submit leave request
     */
    public function submitLeaveRequest(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $validated = $request->validate([
            'leave_type_id' => 'required|integer|exists:leave_types,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'requested_units' => 'required|numeric|min:0.5',
            'reason' => 'required|string|max:500',
        ]);

        try {
            $leaveRequest = $this->leaveService->requestLeave(
                $company->id,
                $membership->id,
                $validated['leave_type_id'],
                $validated['start_date'],
                $validated['end_date'],
                (float) $validated['requested_units'],
                $validated['reason']
            );

            return response()->json([
                'success' => true,
                'message' => 'Leave request submitted and balance reserved.',
                'data' => $leaveRequest,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Approve leave request
     */
    public function approveLeave(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        try {
            $approved = $this->leaveService->approveLeave($id, $membership->id, $request->input('comments'));

            return response()->json([
                'success' => true,
                'message' => 'Leave request approved and ledger updated.',
                'data' => $approved,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }
}

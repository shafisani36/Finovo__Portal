<?php

namespace App\Domain\TimeTracking\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Domain\TimeTracking\Services\TimeIntervalSafetyEngine;
use App\Domain\TimeTracking\Services\TimesheetAggregationService;
use App\Http\Controllers\Controller;
use App\Models\TimeEntry;
use App\Models\Timesheet;
use App\Models\WorkSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TimeTrackingController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected TimeIntervalSafetyEngine $safetyEngine,
        protected TimesheetAggregationService $timesheetService
    ) {}

    /**
     * Start active stopwatch timer
     */
    public function startTimer(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();
        $employmentRecord = $membership->employmentRecords()->first();

        try {
            $session = $this->safetyEngine->startWorkSession(
                $company->id,
                $membership->id,
                $employmentRecord?->id,
                $request->input('project_id'),
                $request->input('task_id'),
                $request->input('activity_type', 'task')
            );

            return response()->json([
                'success' => true,
                'message' => 'Timer session started.',
                'data' => $session,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Stop active stopwatch timer with OCC version validation
     */
    public function stopTimer(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $session = WorkSession::where('company_id', $company->id)
            ->where('id', $id)
            ->where('membership_id', $membership->id)
            ->firstOrFail();

        $expectedVersion = (int) $request->input('version', $session->version);

        try {
            $result = $this->safetyEngine->stopWorkSession(
                $session->id,
                $expectedVersion,
                $request->input('description')
            );

            return response()->json([
                'success' => true,
                'message' => 'Timer stopped and time entry recorded without interval conflict.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Record manual time entry with strict overlap check
     */
    public function manualEntry(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();
        $employmentRecord = $membership->employmentRecords()->first();

        $validated = $request->validate([
            'started_at' => 'required|date',
            'ended_at' => 'required|date|after:started_at',
            'project_id' => 'nullable|integer|exists:projects,id',
            'task_id' => 'nullable|integer|exists:tasks,id',
            'is_billable' => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $start = Carbon::parse($validated['started_at']);
        $end = Carbon::parse($validated['ended_at']);

        try {
            $this->safetyEngine->validateNoOverlap($company->id, $membership->id, $start, $end);

            $entry = TimeEntry::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'employment_record_id' => $employmentRecord?->id,
                'project_id' => $validated['project_id'] ?? null,
                'task_id' => $validated['task_id'] ?? null,
                'started_at' => $start,
                'ended_at' => $end,
                'duration_seconds' => $end->diffInSeconds($start),
                'source' => 'manual',
                'approval_status' => 'draft',
                'is_billable' => $validated['is_billable'] ?? true,
                'description' => $validated['description'] ?? null,
            ]);

            return response()->json(['success' => true, 'data' => $entry], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Submit timesheet for period review
     */
    public function submitTimesheet(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $validated = $request->validate([
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
        ]);

        $timesheet = $this->timesheetService->getOrCreateTimesheet(
            $company->id,
            $membership->id,
            $validated['period_start'],
            $validated['period_end']
        );

        $submitted = $this->timesheetService->submitTimesheet($timesheet);

        return response()->json([
            'success' => true,
            'message' => 'Timesheet submitted successfully.',
            'data' => $submitted,
        ]);
    }

    /**
     * Approve timesheet with Maker-Checker dual custody verification
     */
    public function approveTimesheet(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $timesheet = Timesheet::where('company_id', $company->id)->where('id', $id)->firstOrFail();

        try {
            $approved = $this->timesheetService->approveTimesheet(
                $timesheet,
                $membership->id,
                $request->input('comments')
            );

            return response()->json([
                'success' => true,
                'message' => 'Timesheet approved and locked for payroll processing.',
                'data' => $approved,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }
}

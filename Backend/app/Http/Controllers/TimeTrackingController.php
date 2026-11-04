<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\Project;
use App\Models\SecurityAuditEvent;
use App\Models\Task;
use App\Models\TimeBreak;
use App\Models\TimeEntry;
use App\Models\TimeEntryAdjustment;
use App\Models\TimePolicy;
use App\Models\TimeSyncBatch;
use App\Models\Timesheet;
use App\Models\TimesheetApproval;
use App\Models\TrackerDevice;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimeTrackingController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function getOrCreatePolicy(Company $company): TimePolicy
    {
        return TimePolicy::firstOrCreate(
            ['company_id' => $company->id],
            [
                'allow_concurrent_sessions' => false,
                'max_manual_entry_hours' => 12,
                'idle_timeout_minutes' => 15,
                'require_timesheet_approval' => true,
                'enforce_separation_of_duties' => true,
                'timesheet_frequency' => 'weekly',
                'timezone' => 'UTC',
            ]
        );
    }

    // ==========================================
    // 1. WORK SESSION LIFECYCLE (FR-01, FR-02)
    // ==========================================

    public function startSession(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'task_id' => 'nullable|integer',
            'project_id' => 'nullable|integer',
            'activity_type' => 'nullable|string|in:task,meeting,training,internal',
            'tracker_device_id' => 'nullable|integer',
            'started_at' => 'nullable|date',
            'idempotency_key' => 'nullable|string|max:100',
        ]);

        // 1. Idempotency Check
        if (!empty($validated['idempotency_key'])) {
            $existing = WorkSession::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->where('idempotency_key', $validated['idempotency_key'])
                ->first();
            if ($existing) {
                return response()->json([
                    'message' => 'Session already created (idempotent replay).',
                    'session' => $existing->load(['task', 'project', 'trackerDevice']),
                ], 200);
            }
        }

        // 2. Device Validation
        if (!empty($validated['tracker_device_id'])) {
            $device = TrackerDevice::where('company_id', $company->id)
                ->whereKey($validated['tracker_device_id'])
                ->first();
            if (!$device || $device->status === 'revoked') {
                return response()->json(['message' => 'Tracker device is invalid or has been revoked.'], 403);
            }
        }

        // 3. Task & Project Validation (Same Company + Eligibility)
        $task = null;
        $project = null;
        if (!empty($validated['task_id'])) {
            $task = Task::where('company_id', $company->id)
                ->whereKey($validated['task_id'])
                ->first();
            if (!$task) {
                return response()->json(['message' => 'Task does not belong to this company.'], 404);
            }
            if (in_array($task->status, ['cancelled', 'archived'])) {
                return response()->json(['message' => 'Task is in a terminal status and cannot be tracked.'], 422);
            }
            $project = $task->project;
        } elseif (!empty($validated['project_id'])) {
            $project = Project::where('company_id', $company->id)
                ->whereKey($validated['project_id'])
                ->first();
            if (!$project) {
                return response()->json(['message' => 'Project does not belong to this company.'], 404);
            }
        }

        // 4. Concurrency Policy
        $policy = $this->getOrCreatePolicy($company);
        if (!$policy->allow_concurrent_sessions) {
            $activeRunning = WorkSession::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->where('status', 'running')
                ->first();
            if ($activeRunning) {
                return response()->json([
                    'message' => 'A tracking session is already running for this user. Pause or stop it before starting another.',
                    'active_session_id' => $activeRunning->id,
                ], 409);
            }
        }

        $startedAt = !empty($validated['started_at']) ? Carbon::parse($validated['started_at']) : Carbon::now();
        $employmentRecord = EmploymentRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->first();

        $session = DB::transaction(function () use ($company, $membership, $employmentRecord, $validated, $task, $project, $startedAt) {
            $s = WorkSession::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'employment_record_id' => $employmentRecord?->id,
                'tracker_device_id' => $validated['tracker_device_id'] ?? null,
                'project_id' => $project?->id,
                'task_id' => $task?->id,
                'activity_type' => $validated['activity_type'] ?? 'task',
                'status' => 'running',
                'started_at' => $startedAt,
                'last_event_at' => $startedAt,
                'duration_seconds' => 0,
                'idempotency_key' => $validated['idempotency_key'] ?? null,
                'version' => 1,
            ]);

            SecurityAuditEvent::create([
                'company_id' => $company->id,
                'user_id' => $membership->user_id,
                'action' => 'time.session.started',
                'auditable_type' => WorkSession::class,
                'auditable_id' => $s->id,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'metadata' => [
                    'session_id' => $s->id,
                    'task_id' => $s->task_id,
                    'started_at' => $s->started_at->toIso8601String(),
                ],
            ]);

            return $s;
        });

        return response()->json([
            'message' => 'Tracking session started successfully.',
            'session' => $session->load(['task', 'project', 'trackerDevice']),
        ], 201);
    }

    public function currentSession(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $session = WorkSession::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->whereIn('status', ['running', 'paused'])
            ->latest('id')
            ->with(['task', 'project', 'trackerDevice', 'breaks' => fn($q) => $q->latest('id')->limit(5)])
            ->first();

        return response()->json([
            'session' => $session,
            'is_tracking' => $session ? $session->status === 'running' : false,
        ]);
    }

    public function pauseSession(Request $request, Company $company, WorkSession $session): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($session->company_id !== $company->id || $session->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized session access.'], 403);
        }

        if ($session->status !== 'running') {
            return response()->json(['message' => 'Session is not currently running.'], 422);
        }

        $now = Carbon::now();
        $intervalSeconds = max(0, $now->diffInSeconds($session->last_event_at ?? $session->started_at));

        DB::transaction(function () use ($session, $now, $intervalSeconds, $company) {
            $session->duration_seconds += $intervalSeconds;
            $session->status = 'paused';
            $session->last_event_at = $now;
            $session->version += 1;
            $session->save();

            TimeBreak::create([
                'company_id' => $company->id,
                'work_session_id' => $session->id,
                'break_type' => 'pause',
                'started_at' => $now,
            ]);
        });

        return response()->json([
            'message' => 'Session paused successfully.',
            'session' => $session->fresh(['task', 'project', 'breaks']),
        ]);
    }

    public function resumeSession(Request $request, Company $company, WorkSession $session): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($session->company_id !== $company->id || $session->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized session access.'], 403);
        }

        if ($session->status !== 'paused') {
            return response()->json(['message' => 'Session is not paused.'], 422);
        }

        $now = Carbon::now();

        DB::transaction(function () use ($session, $now) {
            // Close active break
            $activeBreak = TimeBreak::where('work_session_id', $session->id)
                ->whereNull('ended_at')
                ->latest('id')
                ->first();
            if ($activeBreak) {
                $activeBreak->ended_at = $now;
                $activeBreak->duration_seconds = max(0, $now->diffInSeconds($activeBreak->started_at));
                $activeBreak->save();
            }

            $session->status = 'running';
            $session->last_event_at = $now;
            $session->version += 1;
            $session->save();
        });

        return response()->json([
            'message' => 'Session resumed.',
            'session' => $session->fresh(['task', 'project']),
        ]);
    }

    public function switchTask(Request $request, Company $company, WorkSession $session): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($session->company_id !== $company->id || $session->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized session access.'], 403);
        }

        if ($session->status === 'stopped') {
            return response()->json(['message' => 'Cannot switch task on a stopped session.'], 422);
        }

        $validated = $request->validate([
            'task_id' => 'required|integer',
        ]);

        $newTask = Task::where('company_id', $company->id)
            ->whereKey($validated['task_id'])
            ->firstOrFail();

        $now = Carbon::now();

        DB::transaction(function () use ($session, $newTask, $now, $company, $membership) {
            if ($session->status === 'running') {
                $segmentDuration = max(0, $now->diffInSeconds($session->last_event_at ?? $session->started_at));
                $session->duration_seconds += $segmentDuration;

                if ($segmentDuration > 0) {
                    TimeEntry::create([
                        'company_id' => $company->id,
                        'membership_id' => $membership->id,
                        'employment_record_id' => $session->employment_record_id,
                        'project_id' => $session->project_id,
                        'task_id' => $session->task_id,
                        'work_session_id' => $session->id,
                        'started_at' => $session->last_event_at ?? $session->started_at,
                        'ended_at' => $now,
                        'duration_seconds' => $segmentDuration,
                        'source' => 'timer',
                        'approval_status' => 'draft',
                        'is_billable' => true,
                        'description' => 'Time interval prior to task switch',
                    ]);
                }
            }

            $session->task_id = $newTask->id;
            $session->project_id = $newTask->project_id;
            $session->last_event_at = $now;
            $session->version += 1;
            $session->save();
        });

        return response()->json([
            'message' => 'Task switched successfully.',
            'session' => $session->fresh(['task', 'project']),
        ]);
    }

    public function stopSession(Request $request, Company $company, WorkSession $session): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($session->company_id !== $company->id || $session->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized session access.'], 403);
        }

        if ($session->status === 'stopped') {
            return response()->json([
                'message' => 'Session already stopped (idempotent).',
                'session' => $session,
            ]);
        }

        $now = Carbon::now();

        DB::transaction(function () use ($session, $now, $company, $membership) {
            if ($session->status === 'running') {
                $segmentDuration = max(0, $now->diffInSeconds($session->last_event_at ?? $session->started_at));
                $session->duration_seconds += $segmentDuration;
            } elseif ($session->status === 'paused') {
                $activeBreak = TimeBreak::where('work_session_id', $session->id)
                    ->whereNull('ended_at')
                    ->latest('id')
                    ->first();
                if ($activeBreak) {
                    $activeBreak->ended_at = $now;
                    $activeBreak->duration_seconds = max(0, $now->diffInSeconds($activeBreak->started_at));
                    $activeBreak->save();
                }
            }

            $session->status = 'stopped';
            $session->ended_at = $now;
            $session->version += 1;
            $session->save();

            // Create authoritative TimeEntry for this completed session (or segment)
            if ($session->duration_seconds > 0) {
                TimeEntry::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'employment_record_id' => $session->employment_record_id,
                    'project_id' => $session->project_id,
                    'task_id' => $session->task_id,
                    'work_session_id' => $session->id,
                    'started_at' => $session->started_at,
                    'ended_at' => $now,
                    'duration_seconds' => $session->duration_seconds,
                    'source' => 'timer',
                    'approval_status' => 'draft',
                    'is_billable' => true,
                    'description' => 'Timer session tracked',
                ]);
            }

            SecurityAuditEvent::create([
                'company_id' => $company->id,
                'user_id' => $membership->user_id,
                'action' => 'time.session.stopped',
                'auditable_type' => WorkSession::class,
                'auditable_id' => $session->id,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'metadata' => [
                    'session_id' => $session->id,
                    'duration_seconds' => $session->duration_seconds,
                ],
            ]);
        });

        return response()->json([
            'message' => 'Tracking session stopped.',
            'session' => $session->fresh(['task', 'project']),
        ]);
    }

    // ==========================================
    // 2. TIME ENTRIES & MANUAL ENTRIES (FR-03)
    // ==========================================

    public function listEntries(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = TimeEntry::where('company_id', $company->id)
            ->with(['task:id,task_code,title', 'project:id,project_code,name', 'membership.user:id,name,email']);

        // Check if viewing team entries
        if (!$request->user()->can('time.entries.view_team') && !$membership->hasRole(['company-owner', 'company-admin', 'project-manager'])) {
            $query->where('membership_id', $membership->id);
        } elseif ($request->has('membership_id')) {
            $query->where('membership_id', $request->query('membership_id'));
        }

        if ($request->has('task_id')) {
            $query->where('task_id', $request->query('task_id'));
        }
        if ($request->has('project_id')) {
            $query->where('project_id', $request->query('project_id'));
        }
        if ($request->has('source')) {
            $query->where('source', $request->query('source'));
        }
        if ($request->has('date_from')) {
            $query->where('started_at', '>=', Carbon::parse($request->query('date_from'))->startOfDay());
        }
        if ($request->has('date_to')) {
            $query->where('ended_at', '<=', Carbon::parse($request->query('date_to'))->endOfDay());
        }

        $entries = $query->orderBy('started_at', 'desc')->paginate(25);

        return response()->json($entries);
    }

    public function createManualEntry(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'task_id' => 'nullable|integer',
            'project_id' => 'nullable|integer',
            'started_at' => 'required|date',
            'ended_at' => 'required|date|after:started_at',
            'is_billable' => 'nullable|boolean',
            'description' => 'required|string|max:1000',
        ]);

        $start = Carbon::parse($validated['started_at']);
        $end = Carbon::parse($validated['ended_at']);

        // Plausibility check: Cannot be future date
        if ($end->isFuture()) {
            return response()->json(['message' => 'Time entries cannot be recorded in the future.'], 422);
        }

        $durationSeconds = $end->diffInSeconds($start);
        $policy = $this->getOrCreatePolicy($company);

        // Maximum duration limit
        if ($durationSeconds > ($policy->max_manual_entry_hours * 3600)) {
            return response()->json([
                'message' => "Manual time entries cannot exceed {$policy->max_manual_entry_hours} hours per interval.",
            ], 422);
        }

        // Overlap detection (Algorithm C: a_s < b_e && b_s < a_e)
        $hasOverlap = TimeEntry::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where(function ($q) use ($start, $end) {
                $q->where('started_at', '<', $end)
                    ->where('ended_at', '>', $start);
            })
            ->exists();

        if ($hasOverlap) {
            return response()->json([
                'message' => 'The submitted manual time interval overlaps with an existing time entry.',
            ], 409);
        }

        // Task & Project validation
        $task = null;
        $project = null;
        if (!empty($validated['task_id'])) {
            $task = Task::where('company_id', $company->id)->whereKey($validated['task_id'])->firstOrFail();
            $project = $task->project;
        } elseif (!empty($validated['project_id'])) {
            $project = Project::where('company_id', $company->id)->whereKey($validated['project_id'])->firstOrFail();
        }

        $employmentRecord = EmploymentRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->first();

        $entry = TimeEntry::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'employment_record_id' => $employmentRecord?->id,
            'project_id' => $project?->id,
            'task_id' => $task?->id,
            'started_at' => $start,
            'ended_at' => $end,
            'duration_seconds' => $durationSeconds,
            'source' => 'manual',
            'approval_status' => 'draft',
            'is_billable' => $validated['is_billable'] ?? true,
            'description' => $validated['description'],
        ]);

        return response()->json([
            'message' => 'Manual time entry created successfully.',
            'entry' => $entry->load(['task', 'project']),
        ], 201);
    }

    public function updateEntry(Request $request, Company $company, TimeEntry $entry): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($entry->company_id !== $company->id || $entry->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized entry access.'], 403);
        }

        // Approved entries cannot be directly updated (must use corrections)
        if ($entry->approval_status === 'approved') {
            return response()->json([
                'message' => 'Approved time entries are immutable. Please submit a correction request instead.',
            ], 409);
        }

        $validated = $request->validate([
            'description' => 'nullable|string|max:1000',
            'is_billable' => 'nullable|boolean',
        ]);

        $entry->update($validated);

        return response()->json([
            'message' => 'Time entry updated.',
            'entry' => $entry,
        ]);
    }

    public function requestCorrection(Request $request, Company $company, TimeEntry $entry): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($entry->company_id !== $company->id || $entry->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized entry access.'], 403);
        }

        $validated = $request->validate([
            'proposed_started_at' => 'required|date',
            'proposed_ended_at' => 'required|date|after:proposed_started_at',
            'reason' => 'required|string|max:1000',
        ]);

        $start = Carbon::parse($validated['proposed_started_at']);
        $end = Carbon::parse($validated['proposed_ended_at']);
        $newDuration = $end->diffInSeconds($start);

        $adjustment = TimeEntryAdjustment::create([
            'company_id' => $company->id,
            'time_entry_id' => $entry->id,
            'requester_membership_id' => $membership->id,
            'original_duration_seconds' => $entry->duration_seconds,
            'proposed_duration_seconds' => $newDuration,
            'original_started_at' => $entry->started_at,
            'proposed_started_at' => $start,
            'original_ended_at' => $entry->ended_at,
            'proposed_ended_at' => $end,
            'reason' => $validated['reason'],
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Correction request submitted for manager review.',
            'adjustment' => $adjustment,
        ], 201);
    }

    // ==========================================
    // 3. TIMESHEET LIFECYCLE & APPROVALS (FR-05, FR-06)
    // ==========================================

    public function listTimesheets(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = Timesheet::where('company_id', $company->id)
            ->with(['membership.user:id,name,email', 'approver.user:id,name']);

        if (!$request->user()->can('time.timesheets.view_team') && !$membership->hasRole(['company-owner', 'company-admin', 'project-manager'])) {
            $query->where('membership_id', $membership->id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        $timesheets = $query->orderBy('period_start', 'desc')->paginate(20);

        return response()->json($timesheets);
    }

    public function storeTimesheet(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
        ]);

        $start = Carbon::parse($validated['period_start'])->startOfDay();
        $end = Carbon::parse($validated['period_end'])->endOfDay();

        // Check if timesheet already exists for this exact period
        $existing = Timesheet::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('period_start', $start->toDateString())
            ->where('period_end', $end->toDateString())
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'A timesheet for this period already exists.',
                'timesheet' => $existing->load('entries'),
            ], 200);
        }

        // Aggregate unassociated entries in that period
        $entries = TimeEntry::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('started_at', '>=', $start)
            ->where('ended_at', '<=', $end)
            ->whereNull('timesheet_id')
            ->get();

        $totalTracked = $entries->sum('duration_seconds');
        $totalBillable = $entries->where('is_billable', true)->sum('duration_seconds');

        $employmentRecord = EmploymentRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->first();

        $timesheet = DB::transaction(function () use ($company, $membership, $employmentRecord, $start, $end, $totalTracked, $totalBillable, $entries) {
            $ts = Timesheet::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'employment_record_id' => $employmentRecord?->id,
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'status' => 'draft',
                'total_tracked_seconds' => $totalTracked,
                'total_submitted_seconds' => 0,
                'total_approved_seconds' => 0,
                'total_billable_seconds' => $totalBillable,
                'version' => 1,
            ]);

            TimeEntry::whereIn('id', $entries->pluck('id'))->update(['timesheet_id' => $ts->id]);

            return $ts;
        });

        return response()->json([
            'message' => 'Timesheet draft generated.',
            'timesheet' => $timesheet->load('entries'),
        ], 201);
    }

    public function submitTimesheet(Request $request, Company $company, Timesheet $timesheet): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if ($timesheet->company_id !== $company->id || $timesheet->membership_id !== $membership->id) {
            return response()->json(['message' => 'Unauthorized timesheet access.'], 403);
        }

        if (!in_array($timesheet->status, ['draft', 'rejected'])) {
            return response()->json(['message' => 'Only draft or rejected timesheets can be submitted.'], 422);
        }

        DB::transaction(function () use ($timesheet, $company, $membership) {
            $trackedSeconds = $timesheet->entries()->sum('duration_seconds');

            $timesheet->status = 'submitted';
            $timesheet->submitted_at = Carbon::now();
            $timesheet->total_submitted_seconds = $trackedSeconds;
            $timesheet->version += 1;
            $timesheet->rejection_reason = null;
            $timesheet->save();

            $timesheet->entries()->update(['approval_status' => 'submitted']);

            TimesheetApproval::create([
                'company_id' => $company->id,
                'timesheet_id' => $timesheet->id,
                'reviewer_membership_id' => $membership->id,
                'action' => 'submitted',
                'version_at_action' => $timesheet->version,
                'reason' => 'Timesheet submitted by employee for review',
            ]);
        });

        return response()->json([
            'message' => 'Timesheet submitted for approval.',
            'timesheet' => $timesheet->fresh(['entries']),
        ]);
    }

    public function approveTimesheet(Request $request, Company $company, Timesheet $timesheet): JsonResponse
    {
        $reviewerMembership = $this->resolveMembership($company, $request);
        $policy = $this->getOrCreatePolicy($company);

        // Algorithm E: Separation of Duties Enforcement
        if ($policy->enforce_separation_of_duties && $timesheet->membership_id === $reviewerMembership->id) {
            return response()->json([
                'message' => 'Separation of duties policy violation: You cannot approve your own timesheet.',
            ], 403);
        }

        if ($timesheet->status !== 'submitted') {
            return response()->json(['message' => 'Only submitted timesheets can be approved.'], 422);
        }

        // Optimistic locking / version check
        if ($request->has('version') && (int)$request->input('version') !== $timesheet->version) {
            return response()->json(['message' => 'Timesheet was modified by another operation. Please refresh.'], 409);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($timesheet, $reviewerMembership, $company, $validated) {
            $timesheet->status = 'approved';
            $timesheet->approved_at = Carbon::now();
            $timesheet->approved_by_membership_id = $reviewerMembership->id;
            $timesheet->total_approved_seconds = $timesheet->total_submitted_seconds;
            $timesheet->version += 1;
            $timesheet->save();

            $timesheet->entries()->update(['approval_status' => 'approved']);

            TimesheetApproval::create([
                'company_id' => $company->id,
                'timesheet_id' => $timesheet->id,
                'reviewer_membership_id' => $reviewerMembership->id,
                'action' => 'approved',
                'version_at_action' => $timesheet->version,
                'reason' => $validated['reason'] ?? 'Approved by manager',
            ]);

            SecurityAuditEvent::create([
                'company_id' => $company->id,
                'user_id' => $reviewerMembership->user_id,
                'action' => 'time.timesheet.approved',
                'auditable_type' => Timesheet::class,
                'auditable_id' => $timesheet->id,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'metadata' => [
                    'timesheet_id' => $timesheet->id,
                    'approved_seconds' => $timesheet->total_approved_seconds,
                    'reviewer_id' => $reviewerMembership->id,
                ],
            ]);
        });

        return response()->json([
            'message' => 'Timesheet approved successfully.',
            'timesheet' => $timesheet->fresh(['approver.user']),
        ]);
    }

    public function rejectTimesheet(Request $request, Company $company, Timesheet $timesheet): JsonResponse
    {
        $reviewerMembership = $this->resolveMembership($company, $request);

        if ($timesheet->status !== 'submitted') {
            return response()->json(['message' => 'Only submitted timesheets can be rejected.'], 422);
        }

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:1000',
        ]);

        DB::transaction(function () use ($timesheet, $reviewerMembership, $company, $validated) {
            $timesheet->status = 'rejected';
            $timesheet->rejection_reason = $validated['rejection_reason'];
            $timesheet->version += 1;
            $timesheet->save();

            $timesheet->entries()->update(['approval_status' => 'rejected']);

            TimesheetApproval::create([
                'company_id' => $company->id,
                'timesheet_id' => $timesheet->id,
                'reviewer_membership_id' => $reviewerMembership->id,
                'action' => 'rejected',
                'version_at_action' => $timesheet->version,
                'reason' => $validated['rejection_reason'],
            ]);
        });

        return response()->json([
            'message' => 'Timesheet rejected with feedback returned to employee.',
            'timesheet' => $timesheet->fresh(),
        ]);
    }

    public function reopenTimesheet(Request $request, Company $company, Timesheet $timesheet): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        if (!in_array($timesheet->status, ['approved', 'rejected'])) {
            return response()->json(['message' => 'Only approved or rejected timesheets can be reopened.'], 422);
        }

        DB::transaction(function () use ($timesheet, $company, $membership) {
            $timesheet->status = 'draft';
            $timesheet->version += 1;
            $timesheet->save();

            $timesheet->entries()->update(['approval_status' => 'draft']);

            TimesheetApproval::create([
                'company_id' => $company->id,
                'timesheet_id' => $timesheet->id,
                'reviewer_membership_id' => $membership->id,
                'action' => 'reopened',
                'version_at_action' => $timesheet->version,
                'reason' => 'Reopened for corrections',
            ]);
        });

        return response()->json([
            'message' => 'Timesheet reopened for revision.',
            'timesheet' => $timesheet->fresh(),
        ]);
    }

    // ==========================================
    // 4. DEVICE REGISTRATION & REVOCATION (FR-09)
    // ==========================================

    public function registerDevice(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'device_uid' => 'required|string|max:100',
            'device_name' => 'required|string|max:150',
            'os_version' => 'nullable|string|max:100',
            'app_version' => 'nullable|string|max:50',
        ]);

        $device = TrackerDevice::updateOrCreate(
            ['company_id' => $company->id, 'device_uid' => $validated['device_uid']],
            [
                'membership_id' => $membership->id,
                'device_name' => $validated['device_name'],
                'os_version' => $validated['os_version'] ?? 'Windows 11',
                'app_version' => $validated['app_version'] ?? '1.0.0',
                'status' => 'active',
                'last_sync_at' => Carbon::now(),
            ]
        );

        return response()->json([
            'message' => 'Device registered successfully.',
            'device' => $device,
        ], 201);
    }

    public function listDevices(Request $request, Company $company): JsonResponse
    {
        $devices = TrackerDevice::where('company_id', $company->id)
            ->with('membership.user:id,name,email')
            ->latest('last_sync_at')
            ->paginate(20);

        return response()->json($devices);
    }

    public function revokeDevice(Request $request, Company $company, TrackerDevice $device): JsonResponse
    {
        if ($device->company_id !== $company->id) {
            return response()->json(['message' => 'Device not found in company.'], 404);
        }

        $device->status = 'revoked';
        $device->revoked_at = Carbon::now();
        $device->save();

        return response()->json([
            'message' => 'Device revoked. All pending sync batches from this device will be rejected.',
            'device' => $device,
        ]);
    }

    // ==========================================
    // 5. OFFLINE SYNC BATCHES (FR-10, Algorithm F)
    // ==========================================

    public function syncBatch(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'batch_uid' => 'required|string|max:100',
            'device_uid' => 'nullable|string|max:100',
            'events' => 'required|array',
            'events.*.event_id' => 'required|string',
            'events.*.event_type' => 'required|string|in:start,stop,interval',
            'events.*.task_id' => 'nullable|integer',
            'events.*.started_at' => 'required|date',
            'events.*.ended_at' => 'nullable|date',
            'events.*.duration_seconds' => 'nullable|integer',
        ]);

        // Device Check
        $device = null;
        if (!empty($validated['device_uid'])) {
            $device = TrackerDevice::where('company_id', $company->id)
                ->where('device_uid', $validated['device_uid'])
                ->first();
            if ($device && $device->status === 'revoked') {
                return response()->json(['message' => 'Device is revoked. Batch rejected.'], 403);
            }
        }

        // Idempotent Batch Check
        $existingBatch = TimeSyncBatch::where('company_id', $company->id)
            ->where('batch_uid', $validated['batch_uid'])
            ->first();

        if ($existingBatch) {
            return response()->json([
                'message' => 'Batch already processed (idempotent response).',
                'batch' => $existingBatch,
                'status' => 'acknowledged',
            ], 200);
        }

        $syncedCount = 0;
        $conflicts = [];
        $employmentRecord = EmploymentRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->first();

        DB::transaction(function () use ($company, $membership, $employmentRecord, $device, $validated, &$syncedCount, &$conflicts) {
            foreach ($validated['events'] as $evt) {
                $start = Carbon::parse($evt['started_at']);
                $end = !empty($evt['ended_at']) ? Carbon::parse($evt['ended_at']) : Carbon::now();
                $dur = $evt['duration_seconds'] ?? max(0, $end->diffInSeconds($start));

                // Overlap Check against approved entries
                $hasApprovedOverlap = TimeEntry::where('company_id', $company->id)
                    ->where('membership_id', $membership->id)
                    ->where('approval_status', 'approved')
                    ->where('started_at', '<', $end)
                    ->where('ended_at', '>', $start)
                    ->exists();

                if ($hasApprovedOverlap) {
                    $conflicts[] = [
                        'event_id' => $evt['event_id'],
                        'reason' => 'Overlaps with existing approved time entry.',
                    ];
                    continue;
                }

                $task = null;
                if (!empty($evt['task_id'])) {
                    $task = Task::where('company_id', $company->id)->whereKey($evt['task_id'])->first();
                }

                TimeEntry::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'employment_record_id' => $employmentRecord?->id,
                    'project_id' => $task?->project_id,
                    'task_id' => $task?->id,
                    'started_at' => $start,
                    'ended_at' => $end,
                    'duration_seconds' => $dur,
                    'source' => 'timer',
                    'approval_status' => 'draft',
                    'is_billable' => true,
                    'description' => 'Offline synchronized entry (' . $evt['event_id'] . ')',
                ]);

                $syncedCount++;
            }

            if ($device) {
                $device->last_sync_at = Carbon::now();
                $device->save();
            }

            TimeSyncBatch::create([
                'company_id' => $company->id,
                'tracker_device_id' => $device?->id,
                'membership_id' => $membership->id,
                'batch_uid' => $validated['batch_uid'],
                'events_count' => count($validated['events']),
                'status' => count($conflicts) > 0 ? 'partial_conflicts' : 'completed',
                'conflicts_payload' => $conflicts,
            ]);
        });

        return response()->json([
            'message' => 'Sync batch processed successfully.',
            'batch_uid' => $validated['batch_uid'],
            'synced_events' => $syncedCount,
            'conflicts' => $conflicts,
        ], 200);
    }

    // ==========================================
    // 6. REPORTING & EXPORT (FR-08)
    // ==========================================

    public function reportsSummary(Request $request, Company $company): JsonResponse
    {
        $entries = TimeEntry::where('company_id', $company->id);

        $totalTracked = (clone $entries)->sum('duration_seconds');
        $totalSubmitted = (clone $entries)->where('approval_status', 'submitted')->sum('duration_seconds');
        $totalApproved = (clone $entries)->where('approval_status', 'approved')->sum('duration_seconds');
        $totalBillable = (clone $entries)->where('is_billable', true)->sum('duration_seconds');

        // Project breakdown
        $projects = Project::where('company_id', $company->id)
            ->withSum('timeEntries', 'duration_seconds')
            ->limit(10)
            ->get(['id', 'project_code', 'name']);

        // Utilization calculation (Algorithm H)
        $scheduledHours = 40 * 3600; // standard 40 hr week in seconds
        $utilizationPercent = $scheduledHours > 0 ? round(($totalApproved / $scheduledHours) * 100, 2) : 0;

        return response()->json([
            'metrics' => [
                'tracked_hours' => round($totalTracked / 3600, 2),
                'submitted_hours' => round($totalSubmitted / 3600, 2),
                'approved_hours' => round($totalApproved / 3600, 2),
                'billable_hours' => round($totalBillable / 3600, 2),
                'utilization_percent' => $utilizationPercent,
            ],
            'projects' => $projects,
        ]);
    }

    public function exportCsv(Request $request, Company $company): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="time_entries_' . $company->slug . '_' . date('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($company) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Entry ID', 'Employee', 'Project', 'Task', 'Started At', 'Ended At', 'Duration (Hours)', 'Source', 'Approval Status', 'Billable']);

            TimeEntry::where('company_id', $company->id)
                ->with(['membership.user', 'project', 'task'])
                ->chunk(100, function ($entries) use ($handle) {
                    foreach ($entries as $e) {
                        fputcsv($handle, [
                            $e->id,
                            $e->membership?->user?->name ?? 'N/A',
                            $e->project?->name ?? 'N/A',
                            $e->task?->title ?? 'N/A',
                            $e->started_at->toIso8601String(),
                            $e->ended_at->toIso8601String(),
                            round($e->duration_seconds / 3600, 2),
                            $e->source,
                            $e->approval_status,
                            $e->is_billable ? 'Yes' : 'No',
                        ]);
                    }
                });

            fclose($handle);
        }, 200, $headers);
    }
}

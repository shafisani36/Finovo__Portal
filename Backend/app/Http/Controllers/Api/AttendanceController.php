<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceBreak;
use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceEvent;
use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\SecurityAuditEvent;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function getOrCreatePolicy(Company $company): AttendancePolicy
    {
        return AttendancePolicy::firstOrCreate(
            ['company_id' => $company->id],
            [
                'require_shift_assignment' => false,
                'auto_clock_out_hours' => 14,
                'late_tolerance_minutes' => 15,
                'early_departure_tolerance_minutes' => 15,
                'enable_offline_sync' => true,
            ]
        );
    }

    private function resolveShiftAndWorkDate(Company $company, CompanyMembership $membership, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : Carbon::now('UTC');
        $tz = $company->timezone ?: 'UTC';
        $localNow = $now->copy()->setTimezone($tz);
        $localDate = $localNow->toDateString();

        // 1. Look for explicit shift assignment active on $localDate
        $assignment = ShiftAssignment::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('effective_from', '<=', $localDate)
            ->where(function ($q) use ($localDate) {
                $q->whereNull('effective_to')
                  ->orWhere('effective_to', '>=', $localDate);
            })
            ->with('shift')
            ->latest('effective_from')
            ->first();

        $shift = $assignment ? $assignment->shift : null;

        // 2. If no shift assignment, look for company default shift or create standard 09:00 - 18:00
        if (!$shift) {
            $shift = Shift::where('company_id', $company->id)->where('is_active', true)->first();
            if (!$shift) {
                $shift = Shift::create([
                    'company_id' => $company->id,
                    'name' => 'Standard Shift',
                    'code' => 'STD-0918',
                    'timezone' => $tz,
                    'start_time' => '09:00:00',
                    'end_time' => '18:00:00',
                    'grace_period_minutes' => 15,
                    'is_overnight' => false,
                    'is_active' => true,
                ]);
            }
        }

        // 3. Handle overnight shifts
        $workDate = $localDate;
        if ($shift->is_overnight || $shift->start_time > $shift->end_time) {
            $shiftEndToday = Carbon::parse($localDate . ' ' . $shift->end_time, $tz);
            // If current time is in early morning before shift ends, work date was yesterday
            if ($localNow->lt($shiftEndToday)) {
                $workDate = $localNow->copy()->subDay()->toDateString();
            }
        }

        return [$shift, $workDate, $tz, $localNow];
    }

    // ==========================================
    // 1. CURRENT STATE & TODAY (FR-01, FR-03)
    // ==========================================

    public function today(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        [$shift, $workDate, $tz, $localNow] = $this->resolveShiftAndWorkDate($company, $membership);

        $record = AttendanceRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->whereDate('work_date', $workDate)
            ->with(['breaks', 'events', 'shift'])
            ->first();

        $activeBreak = null;
        if ($record) {
            $activeBreak = $record->breaks()->whereNull('ended_at')->latest('started_at')->first();
        }

        return response()->json([
            'work_date' => $workDate,
            'local_time' => $localNow->toIso8601String(),
            'timezone' => $tz,
            'shift' => $shift,
            'attendance' => $record,
            'active_break' => $activeBreak,
            'status' => $record ? $record->status : 'not_clocked_in',
        ]);
    }

    public function history(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = AttendanceRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->with(['shift', 'breaks']);

        if ($request->filled('start_date')) {
            $query->where('work_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->where('work_date', '<=', $request->end_date);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $records = $query->orderBy('work_date', 'desc')->paginate($request->get('per_page', 20));

        return response()->json($records);
    }

    // ==========================================
    // 2. CLOCK IN (FR-01, FR-02, FR-03)
    // ==========================================

    public function clockIn(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $policy = $this->getOrCreatePolicy($company);

        // Security Enforcement: Authorize clock-in only for approved desktop clients
        $deviceUid = $request->header('X-Device-UID') ?: $request->input('device_uid') ?: $request->input('device_id');
        if (!$deviceUid) {
            return response()->json([
                'message' => 'Clock-in is restricted to registered Finovo Global Desktop Workstations. Please launch the Finovo Desktop application.',
            ], 403);
        }

        $registeredDevice = \App\Models\TrackerDevice::where('company_id', $company->id)
            ->where('device_uid', $deviceUid)
            ->where('status', 'active')
            ->first();

        if (!$registeredDevice) {
            return response()->json([
                'message' => 'Unrecognized or unauthorized desktop hardware device. Device must be approved before tracking.',
            ], 403);
        }

        $validated = $request->validate([
            'source' => 'nullable|string|in:web,mobile,desktop,kiosk,api',
            'device_id' => 'nullable|string|max:100',
            'device_uid' => 'nullable|string|max:100',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'idempotency_key' => 'nullable|string|max:100',
        ]);

        $source = 'desktop';
        $nowUtc = Carbon::now('UTC');
        [$shift, $workDate, $tz, $localNow] = $this->resolveShiftAndWorkDate($company, $membership, $nowUtc);

        // Idempotency check
        if (!empty($validated['idempotency_key'])) {
            $existingEvent = AttendanceEvent::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->where('idempotency_key', $validated['idempotency_key'])
                ->first();
            if ($existingEvent) {
                $record = AttendanceRecord::find($existingEvent->attendance_record_id);
                return response()->json([
                    'message' => 'Clock-in already recorded (idempotent replay).',
                    'attendance' => $record ? $record->load(['breaks', 'shift']) : null,
                ], 200);
            }
        }

        return DB::transaction(function () use ($company, $membership, $shift, $workDate, $policy, $tz, $localNow, $nowUtc, $validated, $source) {
            // Check for existing active attendance record
            $existingRecord = AttendanceRecord::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->whereDate('work_date', $workDate)
                ->lockForUpdate()
                ->first();

            if ($existingRecord && $existingRecord->first_clock_in_at && !$existingRecord->last_clock_out_at) {
                return response()->json([
                    'message' => 'You are already clocked in for this work date. Please clock out before starting a new session.',
                    'attendance' => $existingRecord->load(['breaks', 'shift']),
                ], 409);
            }

            // Calculate shift start and lateness
            $shiftStartTime = Carbon::parse($workDate . ' ' . $shift->start_time, $tz);
            $graceMinutes = $shift->grace_period_minutes ?? $policy->late_tolerance_minutes ?? 15;
            $graceCutoff = $shiftStartTime->copy()->addMinutes($graceMinutes);

            $lateSeconds = 0;
            $status = 'present';

            if ($localNow->gt($graceCutoff)) {
                $lateSeconds = (int) abs($localNow->diffInSeconds($shiftStartTime));
                $status = 'late';
            }

            if (!$existingRecord) {
                $record = AttendanceRecord::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'work_date' => $workDate,
                    'shift_id' => $shift->id,
                    'status' => $status,
                    'first_clock_in_at' => $nowUtc,
                    'late_seconds' => $lateSeconds,
                    'version' => 1,
                ]);
            } else {
                $existingRecord->update([
                    'status' => $status,
                    'first_clock_in_at' => $nowUtc,
                    'last_clock_out_at' => null,
                    'late_seconds' => $lateSeconds,
                    'version' => $existingRecord->version + 1,
                ]);
                $record = $existingRecord;
            }

            // Create immutable attendance event
            AttendanceEvent::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'attendance_record_id' => $record->id,
                'event_type' => 'clock_in',
                'occurred_at' => $nowUtc,
                'received_at' => Carbon::now('UTC'),
                'source' => $source,
                'device_id' => $validated['device_id'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'idempotency_key' => $validated['idempotency_key'] ?? null,
                'metadata' => [
                    'shift_id' => $shift->id,
                    'work_date' => $workDate,
                    'late_seconds' => $lateSeconds,
                ],
            ]);

            SecurityAuditEvent::record(
                'attendance.clock_in',
                $membership->user_id,
                $company->id,
                AttendanceRecord::class,
                $record->id,
                [
                    'work_date' => $workDate,
                    'status' => $status,
                    'late_seconds' => $lateSeconds,
                    'source' => $source,
                ]
            );

            return response()->json([
                'message' => 'Clock-in recorded successfully.',
                'attendance' => $record->fresh()->load(['breaks', 'shift']),
            ], 201);
        });
    }

    // ==========================================
    // 3. CLOCK OUT (FR-01, FR-02, FR-03)
    // ==========================================

    public function clockOut(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $policy = $this->getOrCreatePolicy($company);

        // Security Enforcement: Authorize clock-out only for approved desktop clients
        $deviceUid = $request->header('X-Device-UID') ?: $request->input('device_uid') ?: $request->input('device_id');
        if (!$deviceUid) {
            return response()->json([
                'message' => 'Clock-out is restricted to registered Finovo Global Desktop Workstations. Please launch the Finovo Desktop application.',
            ], 403);
        }

        $registeredDevice = \App\Models\TrackerDevice::where('company_id', $company->id)
            ->where('device_uid', $deviceUid)
            ->where('status', 'active')
            ->first();

        if (!$registeredDevice) {
            return response()->json([
                'message' => 'Unrecognized or unauthorized desktop hardware device.',
            ], 403);
        }

        $validated = $request->validate([
            'source' => 'nullable|string|in:web,mobile,desktop,kiosk,api',
            'device_id' => 'nullable|string|max:100',
            'device_uid' => 'nullable|string|max:100',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'idempotency_key' => 'nullable|string|max:100',
        ]);

        $source = 'desktop';
        $nowUtc = Carbon::now('UTC');
        [$shift, $workDate, $tz, $localNow] = $this->resolveShiftAndWorkDate($company, $membership, $nowUtc);

        return DB::transaction(function () use ($company, $membership, $shift, $workDate, $policy, $tz, $localNow, $nowUtc, $validated, $source) {
            $record = AttendanceRecord::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->whereDate('work_date', $workDate)
                ->lockForUpdate()
                ->first();

            if (!$record || !$record->first_clock_in_at) {
                return response()->json(['message' => 'No active clock-in found for today.'], 422);
            }

            if ($record->last_clock_out_at && $record->status === 'clocked_out') {
                return response()->json([
                    'message' => 'You have already clocked out for today.',
                    'attendance' => $record->load(['breaks', 'shift']),
                ], 409);
            }

            // Close any open break automatically
            $openBreak = AttendanceBreak::where('attendance_record_id', $record->id)
                ->whereNull('ended_at')
                ->first();
            if ($openBreak) {
                $breakDuration = (int) abs($nowUtc->diffInSeconds($openBreak->started_at));
                $openBreak->update([
                    'ended_at' => $nowUtc,
                    'duration_seconds' => $breakDuration,
                ]);

                AttendanceEvent::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'attendance_record_id' => $record->id,
                    'event_type' => 'break_end',
                    'occurred_at' => $nowUtc,
                    'received_at' => Carbon::now('UTC'),
                    'source' => $source,
                    'metadata' => ['auto_closed_on_clock_out' => true],
                ]);
            }

            // Calculate worked duration and unpaid breaks
            $totalSpanSeconds = (int) abs($nowUtc->diffInSeconds($record->first_clock_in_at));
            $unpaidBreakSeconds = (int) AttendanceBreak::where('attendance_record_id', $record->id)
                ->where('is_paid', false)
                ->sum('duration_seconds');

            $workedSeconds = max(0, $totalSpanSeconds - $unpaidBreakSeconds);

            // Calculate early departure
            $shiftEndTime = Carbon::parse($workDate . ' ' . $shift->end_time, $tz);
            $earlyDepartureSeconds = 0;
            if ($localNow->lt($shiftEndTime)) {
                $earlyDepartureSeconds = (int) abs($shiftEndTime->diffInSeconds($localNow));
            }

            // Final status calculation
            $status = 'clocked_out';
            if ($earlyDepartureSeconds > 0) {
                $status = 'early_departure';
            }
            if ($record->late_seconds > 0 && $earlyDepartureSeconds > 0) {
                $status = 'partial_attendance';
            }

            $record->update([
                'last_clock_out_at' => $nowUtc,
                'worked_seconds' => $workedSeconds,
                'early_departure_seconds' => $earlyDepartureSeconds,
                'status' => $status,
                'version' => $record->version + 1,
            ]);

            AttendanceEvent::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'attendance_record_id' => $record->id,
                'event_type' => 'clock_out',
                'occurred_at' => $nowUtc,
                'received_at' => Carbon::now('UTC'),
                'source' => $source,
                'device_id' => $validated['device_id'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'idempotency_key' => $validated['idempotency_key'] ?? null,
                'metadata' => [
                    'worked_seconds' => $workedSeconds,
                    'early_departure_seconds' => $earlyDepartureSeconds,
                ],
            ]);

            SecurityAuditEvent::record(
                'attendance.clock_out',
                $membership->user_id,
                $company->id,
                AttendanceRecord::class,
                $record->id,
                [
                    'work_date' => $workDate,
                    'worked_seconds' => $workedSeconds,
                    'early_departure_seconds' => $earlyDepartureSeconds,
                    'status' => $status,
                ]
            );

            return response()->json([
                'message' => 'Clock-out recorded successfully.',
                'attendance' => $record->fresh()->load(['breaks', 'shift']),
            ]);
        });
    }

    // ==========================================
    // 4. BREAK MANAGEMENT (FR-04)
    // ==========================================

    public function startBreak(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'break_type' => 'nullable|string|in:meal,tea,rest,personal,other',
            'is_paid' => 'nullable|boolean',
            'notes' => 'nullable|string|max:255',
            'source' => 'nullable|string|in:web,mobile,desktop',
        ]);

        $nowUtc = Carbon::now('UTC');
        [$shift, $workDate] = $this->resolveShiftAndWorkDate($company, $membership, $nowUtc);

        $record = AttendanceRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->whereDate('work_date', $workDate)
            ->first();

        if (!$record || !$record->first_clock_in_at || $record->last_clock_out_at) {
            return response()->json(['message' => 'You must be clocked in to start a break.'], 422);
        }

        $activeBreak = AttendanceBreak::where('attendance_record_id', $record->id)
            ->whereNull('ended_at')
            ->first();

        if ($activeBreak) {
            return response()->json(['message' => 'You already have an active break in progress.'], 409);
        }

        $break = AttendanceBreak::create([
            'company_id' => $company->id,
            'attendance_record_id' => $record->id,
            'break_type' => $validated['break_type'] ?? 'meal',
            'is_paid' => $validated['is_paid'] ?? false,
            'started_at' => $nowUtc,
        ]);

        AttendanceEvent::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'attendance_record_id' => $record->id,
            'event_type' => 'break_start',
            'occurred_at' => $nowUtc,
            'received_at' => Carbon::now('UTC'),
            'source' => $validated['source'] ?? 'web',
            'metadata' => ['break_id' => $break->id, 'break_type' => $break->break_type],
        ]);

        return response()->json([
            'message' => 'Break started.',
            'break' => $break,
        ], 201);
    }

    public function endBreak(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $nowUtc = Carbon::now('UTC');
        [$shift, $workDate] = $this->resolveShiftAndWorkDate($company, $membership, $nowUtc);

        $record = AttendanceRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->whereDate('work_date', $workDate)
            ->first();

        if (!$record) {
            return response()->json(['message' => 'No attendance record found.'], 404);
        }

        $activeBreak = AttendanceBreak::where('attendance_record_id', $record->id)
            ->whereNull('ended_at')
            ->latest('started_at')
            ->first();

        if (!$activeBreak) {
            return response()->json(['message' => 'No active break found to end.'], 422);
        }

        $duration = (int) abs($nowUtc->diffInSeconds($activeBreak->started_at));
        $activeBreak->update([
            'ended_at' => $nowUtc,
            'duration_seconds' => $duration,
        ]);

        AttendanceEvent::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'attendance_record_id' => $record->id,
            'event_type' => 'break_end',
            'occurred_at' => $nowUtc,
            'received_at' => Carbon::now('UTC'),
            'source' => $request->get('source', 'web'),
            'metadata' => ['break_id' => $activeBreak->id, 'duration_seconds' => $duration],
        ]);

        return response()->json([
            'message' => 'Break ended.',
            'break' => $activeBreak,
        ]);
    }

    // ==========================================
    // 5. SHIFTS & ASSIGNMENTS (FR-02)
    // ==========================================

    public function shifts(Request $request, Company $company): JsonResponse
    {
        $shifts = Shift::where('company_id', $company->id)->get();
        return response()->json(['shifts' => $shifts]);
    }

    public function createShift(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50',
            'start_time' => 'required|date_format:H:i:s',
            'end_time' => 'required|date_format:H:i:s',
            'grace_period_minutes' => 'nullable|integer|min:0',
            'is_overnight' => 'nullable|boolean',
        ]);

        $shift = Shift::create([
            'company_id' => $company->id,
            'name' => $validated['name'],
            'code' => $validated['code'],
            'timezone' => $company->timezone ?: 'UTC',
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
            'grace_period_minutes' => $validated['grace_period_minutes'] ?? 15,
            'is_overnight' => $validated['is_overnight'] ?? false,
            'is_active' => true,
        ]);

        return response()->json(['message' => 'Shift created.', 'shift' => $shift], 201);
    }

    public function assignShift(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'membership_id' => 'required|exists:company_memberships,id',
            'shift_id' => 'required|exists:shifts,id',
            'effective_from' => 'required|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
        ]);

        $assignment = ShiftAssignment::create([
            'company_id' => $company->id,
            'membership_id' => $validated['membership_id'],
            'shift_id' => $validated['shift_id'],
            'effective_from' => $validated['effective_from'],
            'effective_to' => $validated['effective_to'] ?? null,
            'assigned_by_membership_id' => $request->attributes->get('currentMembership')?->id,
        ]);

        return response()->json(['message' => 'Shift assigned.', 'assignment' => $assignment], 201);
    }

    // ==========================================
    // 6. TEAM ATTENDANCE (FR-11)
    // ==========================================

    public function teamAttendance(Request $request, Company $company): JsonResponse
    {
        $date = $request->get('date', Carbon::today()->toDateString());

        $records = AttendanceRecord::where('company_id', $company->id)
            ->where('work_date', $date)
            ->with(['membership.user', 'shift', 'breaks'])
            ->get();

        return response()->json([
            'date' => $date,
            'records' => $records,
        ]);
    }

    // ==========================================
    // 7. ATTENDANCE CORRECTIONS (FR-09)
    // ==========================================

    public function requestCorrection(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'attendance_record_id' => 'required|exists:attendance_records,id',
            'proposed_clock_in_at' => 'nullable|date',
            'proposed_clock_out_at' => 'nullable|date',
            'reason' => 'required|string|max:1000',
        ]);

        $record = AttendanceRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('id', $validated['attendance_record_id'])
            ->firstOrFail();

        $correction = AttendanceCorrectionRequest::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'attendance_record_id' => $record->id,
            'requested_work_date' => $record->work_date,
            'proposed_clock_in_at' => $validated['proposed_clock_in_at'] ?? null,
            'proposed_clock_out_at' => $validated['proposed_clock_out_at'] ?? null,
            'reason' => $validated['reason'],
            'status' => 'pending',
            'version' => 1,
        ]);

        SecurityAuditEvent::record(
            'attendance.correction.requested',
            $membership->user_id,
            $company->id,
            AttendanceCorrectionRequest::class,
            $correction->id,
            ['attendance_record_id' => $record->id, 'reason' => $validated['reason']]
        );

        return response()->json([
            'message' => 'Attendance correction request submitted.',
            'correction' => $correction,
        ], 201);
    }

    public function reviewCorrection(Request $request, Company $company, int $id): JsonResponse
    {
        $reviewerMembership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'action' => 'required|string|in:approve,reject',
            'decision_reason' => 'nullable|string|max:500',
        ]);

        $correction = AttendanceCorrectionRequest::where('company_id', $company->id)
            ->whereKey($id)
            ->where('status', 'pending')
            ->firstOrFail();

        // Separation of Duties: Approver cannot approve their own correction
        if ($correction->membership_id === $reviewerMembership->id) {
            return response()->json(['message' => 'Separation of Duties violation: You cannot review your own attendance correction request.'], 403);
        }

        return DB::transaction(function () use ($company, $reviewerMembership, $correction, $validated) {
            $record = AttendanceRecord::where('company_id', $company->id)
                ->whereKey($correction->attendance_record_id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($validated['action'] === 'reject') {
                $correction->update([
                    'status' => 'rejected',
                    'reviewer_membership_id' => $reviewerMembership->id,
                    'decision_reason' => $validated['decision_reason'] ?? null,
                    'reviewed_at' => Carbon::now('UTC'),
                ]);

                return response()->json(['message' => 'Correction request rejected.', 'correction' => $correction]);
            }

            // Apply correction
            $newClockIn = $correction->proposed_clock_in_at ?: $record->first_clock_in_at;
            $newClockOut = $correction->proposed_clock_out_at ?: $record->last_clock_out_at;

            $workedSeconds = $record->worked_seconds;
            if ($newClockIn && $newClockOut) {
                $cin = Carbon::parse($newClockIn);
                $cout = Carbon::parse($newClockOut);
                $workedSeconds = (int) abs($cout->diffInSeconds($cin));
            }

            $record->update([
                'first_clock_in_at' => $newClockIn,
                'last_clock_out_at' => $newClockOut,
                'status' => 'present',
                'worked_seconds' => $workedSeconds,
                'version' => $record->version + 1,
            ]);

            // Append audit event
            AttendanceEvent::create([
                'company_id' => $company->id,
                'membership_id' => $record->membership_id,
                'attendance_record_id' => $record->id,
                'event_type' => 'correction_applied',
                'occurred_at' => Carbon::now('UTC'),
                'received_at' => Carbon::now('UTC'),
                'source' => 'manager_correction',
                'metadata' => [
                    'correction_request_id' => $correction->id,
                    'reviewer_membership_id' => $reviewerMembership->id,
                    'worked_seconds' => $workedSeconds,
                ],
            ]);

            $correction->update([
                'status' => 'approved',
                'reviewer_membership_id' => $reviewerMembership->id,
                'decision_reason' => $validated['decision_reason'] ?? null,
                'reviewed_at' => Carbon::now('UTC'),
            ]);

            SecurityAuditEvent::record(
                'attendance.correction.approved',
                $reviewerMembership->user_id,
                $company->id,
                AttendanceCorrectionRequest::class,
                $correction->id,
                ['record_id' => $record->id, 'worked_seconds' => $workedSeconds]
            );

            return response()->json([
                'message' => 'Attendance correction applied successfully.',
                'correction' => $correction,
                'record' => $record->fresh(),
            ]);
        });
    }

    // ==========================================
    // 8. REPORTS & EXPORTS (FR-10)
    // ==========================================

    public function dailyReport(Request $request, Company $company): JsonResponse
    {
        $date = $request->get('date', Carbon::today()->toDateString());

        $records = AttendanceRecord::where('company_id', $company->id)
            ->where('work_date', $date)
            ->get();

        $summary = [
            'total_scheduled' => $records->count(),
            'present' => $records->whereIn('status', ['present', 'clocked_out'])->count(),
            'late' => $records->where('status', 'late')->count(),
            'early_departure' => $records->where('status', 'early_departure')->count(),
            'partial_attendance' => $records->where('status', 'partial_attendance')->count(),
            'on_leave' => $records->where('status', 'on_leave')->count(),
            'absent' => $records->where('status', 'absent')->count(),
            'total_worked_seconds' => $records->sum('worked_seconds'),
        ];

        return response()->json([
            'date' => $date,
            'summary' => $summary,
            'records' => $records->load(['membership.user', 'shift']),
        ]);
    }

    public function summaryReport(Request $request, Company $company): JsonResponse
    {
        $startDate = $request->get('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', Carbon::now()->toDateString());

        $query = AttendanceRecord::where('company_id', $company->id)
            ->whereBetween('work_date', [$startDate, $endDate]);

        if ($request->filled('membership_id')) {
            $query->where('membership_id', $request->membership_id);
        }

        $records = $query->with(['membership.user', 'shift'])->get();

        $stats = [
            'total_records' => $records->count(),
            'present_count' => $records->whereIn('status', ['present', 'clocked_out'])->count(),
            'late_count' => $records->where('status', 'late')->count(),
            'on_leave_count' => $records->where('status', 'on_leave')->count(),
            'total_worked_hours' => round($records->sum('worked_seconds') / 3600, 2),
            'total_late_hours' => round($records->sum('late_seconds') / 3600, 2),
        ];

        return response()->json([
            'start_date' => $startDate,
            'end_date' => $endDate,
            'stats' => $stats,
            'records' => $records,
        ]);
    }

    public function exportAttendance(Request $request, Company $company): StreamedResponse
    {
        $startDate = $request->get('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', Carbon::now()->toDateString());

        $records = AttendanceRecord::where('company_id', $company->id)
            ->whereBetween('work_date', [$startDate, $endDate])
            ->with(['membership.user', 'shift'])
            ->orderBy('work_date', 'asc')
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"attendance_{$company->slug}_{$startDate}_to_{$endDate}.csv\"",
        ];

        return response()->stream(function () use ($records) {
            $file = fopen('php://output', 'w');
            fputcsv($file, [
                'Work Date', 'Employee Name', 'Shift', 'Clock In', 'Clock Out',
                'Worked Hours', 'Late Minutes', 'Early Departure Minutes', 'Status',
            ]);

            foreach ($records as $r) {
                fputcsv($file, [
                    $r->work_date,
                    $r->membership?->user?->name ?? 'Unknown',
                    $r->shift?->name ?? 'Default',
                    $r->first_clock_in_at ? $r->first_clock_in_at->toDateTimeString() : '',
                    $r->last_clock_out_at ? $r->last_clock_out_at->toDateTimeString() : '',
                    round($r->worked_seconds / 3600, 2),
                    round($r->late_seconds / 60, 1),
                    round($r->early_departure_seconds / 60, 1),
                    $r->status,
                ]);
            }

            fclose($file);
        }, 200, $headers);
    }

    // ==========================================
    // 9. OFFLINE SYNC BATCHES (FR-11)
    // ==========================================

    public function syncBatch(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'batch_uid' => 'required|string|max:100',
            'events' => 'required|array|min:1',
            'events.*.event_id' => 'required|string',
            'events.*.event_type' => 'required|string|in:clock_in,clock_out,break_start,break_end',
            'events.*.occurred_at' => 'required|date',
            'events.*.device_id' => 'nullable|string|max:100',
        ]);

        $policy = $this->getOrCreatePolicy($company);
        if (!$policy->enable_offline_sync) {
            return response()->json(['message' => 'Offline attendance synchronization is disabled by company policy.'], 403);
        }

        // Idempotency check on batch
        $existingBatch = AttendanceEvent::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('idempotency_key', $validated['batch_uid'])
            ->first();

        if ($existingBatch) {
            return response()->json([
                'message' => 'Batch already processed (idempotent response).',
                'batch_uid' => $validated['batch_uid'],
                'status' => 'acknowledged',
            ], 200);
        }

        $processedCount = 0;
        $conflicts = [];
        $nowUtc = Carbon::now('UTC');

        DB::transaction(function () use ($company, $membership, $validated, $nowUtc, &$processedCount, &$conflicts) {
            foreach ($validated['events'] as $evt) {
                $occurredAt = Carbon::parse($evt['occurred_at']);
                [$shift, $workDate] = $this->resolveShiftAndWorkDate($company, $membership, $occurredAt);

                $record = AttendanceRecord::firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'membership_id' => $membership->id,
                        'work_date' => $workDate,
                    ],
                    [
                        'shift_id' => $shift->id,
                        'status' => 'present',
                        'first_clock_in_at' => $occurredAt,
                        'version' => 1,
                    ]
                );

                if ($evt['event_type'] === 'clock_out') {
                    $worked = (int) abs($occurredAt->diffInSeconds($record->first_clock_in_at ?: $occurredAt));
                    $record->update([
                        'last_clock_out_at' => $occurredAt,
                        'worked_seconds' => $worked,
                        'status' => 'clocked_out',
                        'version' => $record->version + 1,
                    ]);
                }

                AttendanceEvent::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'attendance_record_id' => $record->id,
                    'event_type' => $evt['event_type'],
                    'occurred_at' => $occurredAt,
                    'received_at' => $nowUtc,
                    'source' => 'offline_sync',
                    'device_id' => $evt['device_id'] ?? null,
                    'idempotency_key' => $evt['event_id'],
                    'metadata' => [
                        'batch_uid' => $validated['batch_uid'],
                        'client_event_id' => $evt['event_id'],
                    ],
                ]);

                $processedCount++;
            }
        });

        return response()->json([
            'message' => 'Offline attendance batch processed successfully.',
            'batch_uid' => $validated['batch_uid'],
            'processed_count' => $processedCount,
            'conflicts' => $conflicts,
        ], 201);
    }

    public function syncBatchStatus(Request $request, Company $company, string $batchUid): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $events = AttendanceEvent::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('metadata->batch_uid', $batchUid)
            ->get();

        return response()->json([
            'batch_uid' => $batchUid,
            'status' => $events->isNotEmpty() ? 'processed' : 'not_found',
            'events_count' => $events->count(),
            'events' => $events,
        ]);
    }
}

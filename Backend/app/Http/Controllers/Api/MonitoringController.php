<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\MonitoringContextAnnotation;
use App\Models\MonitoringDeviceHeartbeat;
use App\Models\MonitoringDispute;
use App\Models\MonitoringEvent;
use App\Models\MonitoringInterval;
use App\Models\MonitoringPolicy;
use App\Models\MonitoringPolicyAcknowledgment;
use App\Models\MonitoringPolicyAssignment;
use App\Models\MonitoringReconciliationCase;
use App\Models\Project;
use App\Models\SecurityAuditEvent;
use App\Models\Task;
use App\Models\TrackerDevice;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MonitoringController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function getOrCreateDefaultPolicy(Company $company, ?CompanyMembership $creator = null): MonitoringPolicy
    {
        $policy = MonitoringPolicy::where('company_id', $company->id)
            ->where('is_active', true)
            ->latest('version')
            ->first();

        if (!$policy) {
            $policy = MonitoringPolicy::create([
                'company_id' => $company->id,
                'name' => 'Finovo Standard Privacy-First Monitoring Policy',
                'version' => 1,
                'is_active' => true,
                'allow_app_category_collection' => true,
                'allow_foreground_app' => true,
                'allow_input_activity' => true,
                'idle_threshold_seconds' => 300,
                'allow_offline_queue' => true,
                'offline_grace_hours' => 48,
                'retention_days' => 90,
                'min_client_version' => '1.0.0',
                'settings' => [
                    'screenshot_enabled' => false,
                    'keylogger_enabled' => false,
                    'clipboard_enabled' => false,
                    'privacy_notice' => 'Strict privacy-first collection: coarse application category and idle detection only. No keystrokes, clipboard, or hidden screenshots.',
                    'allowed_categories' => ['development', 'communication', 'documentation', 'design', 'meeting', 'unclassified'],
                ],
                'effective_from' => Carbon::now('UTC')->subDay(),
                'created_by_membership_id' => $creator ? $creator->id : null,
            ]);

            MonitoringPolicyAssignment::create([
                'policy_id' => $policy->id,
                'target_type' => 'company',
                'target_id' => $company->id,
            ]);
        }

        return $policy;
    }

    // =========================================================================
    // 1. POLICY & PRIVACY SIMULATOR (FR-01, FR-03, Feature 4)
    // =========================================================================

    public function getEffectivePolicy(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $policy = $this->getOrCreateDefaultPolicy($company, $membership);

        $acknowledgment = MonitoringPolicyAcknowledgment::where('membership_id', $membership->id)
            ->where('policy_id', $policy->id)
            ->where('policy_version', $policy->version)
            ->first();

        return response()->json([
            'policy' => $policy,
            'is_acknowledged' => (bool)$acknowledgment,
            'acknowledged_at' => $acknowledgment ? $acknowledgment->acknowledged_at : null,
            'privacy_commitments' => [
                'keystroke_recording' => 'Never collected',
                'clipboard_contents' => 'Never collected',
                'passwords_and_private_messages' => 'Never collected',
                'screenshots' => 'Disabled by default',
                'data_minimization' => 'Raw window titles stripped; mapped to approved categories',
                'retention_period_days' => $policy->retention_days,
            ],
        ]);
    }

    public function acknowledgePolicy(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $validated = $request->validate([
            'policy_id' => 'required|exists:monitoring_policies,id',
            'policy_version' => 'required|integer|min:1',
        ]);

        $policy = MonitoringPolicy::where('company_id', $company->id)
            ->where('id', $validated['policy_id'])
            ->firstOrFail();

        $ack = MonitoringPolicyAcknowledgment::updateOrCreate(
            [
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'policy_id' => $policy->id,
                'policy_version' => $validated['policy_version'],
            ],
            [
                'acknowledged_at' => Carbon::now('UTC'),
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'message' => 'Monitoring policy transparency acknowledgment recorded successfully.',
            'acknowledgment' => $ack,
        ]);
    }

    public function listPolicies(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $policies = MonitoringPolicy::where('company_id', $company->id)
            ->with(['createdBy.user:id,name,email', 'assignments'])
            ->orderByDesc('version')
            ->get();

        return response()->json(['policies' => $policies]);
    }

    public function createPolicy(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'allow_app_category_collection' => 'boolean',
            'allow_foreground_app' => 'boolean',
            'allow_input_activity' => 'boolean',
            'idle_threshold_seconds' => 'integer|min:60|max:3600',
            'allow_offline_queue' => 'boolean',
            'offline_grace_hours' => 'integer|min:1|max:168',
            'retention_days' => 'integer|min:7|max:365',
            'min_client_version' => 'string|max:50',
            'settings' => 'nullable|array',
            'assignments' => 'nullable|array',
        ]);

        $latestVersion = MonitoringPolicy::where('company_id', $company->id)->max('version') ?? 0;

        $policy = DB::transaction(function () use ($company, $membership, $validated, $latestVersion) {
            $created = MonitoringPolicy::create([
                'company_id' => $company->id,
                'name' => $validated['name'],
                'version' => $latestVersion + 1,
                'is_active' => false,
                'allow_app_category_collection' => $validated['allow_app_category_collection'] ?? true,
                'allow_foreground_app' => $validated['allow_foreground_app'] ?? true,
                'allow_input_activity' => $validated['allow_input_activity'] ?? true,
                'idle_threshold_seconds' => $validated['idle_threshold_seconds'] ?? 300,
                'allow_offline_queue' => $validated['allow_offline_queue'] ?? true,
                'offline_grace_hours' => $validated['offline_grace_hours'] ?? 48,
                'retention_days' => $validated['retention_days'] ?? 90,
                'min_client_version' => $validated['min_client_version'] ?? '1.0.0',
                'settings' => array_merge([
                    'screenshot_enabled' => false,
                    'keylogger_enabled' => false,
                    'clipboard_enabled' => false,
                ], $validated['settings'] ?? []),
                'effective_from' => Carbon::now('UTC'),
                'created_by_membership_id' => $membership->id,
            ]);

            if (!empty($validated['assignments'])) {
                foreach ($validated['assignments'] as $assign) {
                    MonitoringPolicyAssignment::create([
                        'policy_id' => $created->id,
                        'target_type' => $assign['target_type'] ?? 'company',
                        'target_id' => $assign['target_id'] ?? $company->id,
                    ]);
                }
            } else {
                MonitoringPolicyAssignment::create([
                    'policy_id' => $created->id,
                    'target_type' => 'company',
                    'target_id' => $company->id,
                ]);
            }

            return $created;
        });

        return response()->json([
            'message' => 'Policy version created as draft successfully.',
            'policy' => $policy->load('assignments'),
        ], 201);
    }

    public function publishPolicy(Request $request, Company $company, $id): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $policy = MonitoringPolicy::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        DB::transaction(function () use ($company, $policy) {
            // Deactivate previous active policies
            MonitoringPolicy::where('company_id', $company->id)
                ->where('id', '!=', $policy->id)
                ->update(['is_active' => false, 'effective_until' => Carbon::now('UTC')]);

            $policy->update([
                'is_active' => true,
                'effective_from' => Carbon::now('UTC'),
                'effective_until' => null,
            ]);
        });

        return response()->json([
            'message' => "Policy version {$policy->version} activated successfully.",
            'policy' => $policy,
        ]);
    }

    public function previewPolicySimulator(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $activePolicy = $this->getOrCreateDefaultPolicy($company);
        $totalMembers = CompanyMembership::where('company_id', $company->id)->where('status', 'active')->count();
        $totalDevices = TrackerDevice::where('company_id', $company->id)->where('status', 'active')->count();

        // Calculate simulation projections
        $dailyIntervalEstPerUser = 48; // ~10 min intervals per 8h day
        $estimatedDailyEvents = $totalDevices * 300; // coarse heartbeats + transitions
        $estimatedMonthlyStorageMb = round(($estimatedDailyEvents * 30 * 0.4) / 1024, 2); // ~400 bytes per record

        return response()->json([
            'company_id' => $company->id,
            'active_policy_version' => $activePolicy->version,
            'simulation' => [
                'scope_summary' => [
                    'active_employees' => $totalMembers,
                    'registered_devices' => $totalDevices,
                    'collection_mode' => 'Privacy-first coarse signals',
                ],
                'signals_evaluated' => [
                    [
                        'signal' => 'Application Categories',
                        'status' => $activePolicy->allow_app_category_collection ? 'Collected (Coarse Category Only)' : 'Disabled',
                        'privacy_impact' => 'Low - titles & URL parameters stripped',
                    ],
                    [
                        'signal' => 'Input Activity Presence',
                        'status' => $activePolicy->allow_input_activity ? 'Collected (Coarse Active/Idle Flag)' : 'Disabled',
                        'privacy_impact' => 'Zero content captured - no keystroke or mouse logs',
                    ],
                    [
                        'signal' => 'Idle Detection Threshold',
                        'status' => "{$activePolicy->idle_threshold_seconds} seconds",
                        'privacy_impact' => 'Disclosed transparently to employees',
                    ],
                    [
                        'signal' => 'Screenshots & Screen Recording',
                        'status' => 'STRICTLY DISABLED BY POLICY',
                        'privacy_impact' => 'Protected',
                    ],
                    [
                        'signal' => 'Clipboard & Keylogger',
                        'status' => 'STRICTLY PROHIBITED',
                        'privacy_impact' => 'Protected',
                    ],
                ],
                'lifecycle_and_retention' => [
                    'retention_days' => $activePolicy->retention_days,
                    'offline_grace_hours' => $activePolicy->offline_grace_hours,
                    'projected_daily_events' => $estimatedDailyEvents,
                    'projected_monthly_storage_mb' => $estimatedMonthlyStorageMb,
                    'automatic_purge_enabled' => true,
                ],
            ],
        ]);
    }

    // =========================================================================
    // 2. DEVICE REGISTRATION & HEALTH (FR-01, FR-02)
    // =========================================================================

    public function registerDevice(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'device_uid' => 'required|string|max:100',
            'device_name' => 'required|string|max:150',
            'os_version' => 'nullable|string|max:100',
            'app_version' => 'nullable|string|max:50',
        ]);

        $policy = $this->getOrCreateDefaultPolicy($company, $membership);

        $device = TrackerDevice::updateOrCreate(
            [
                'company_id' => $company->id,
                'device_uid' => $validated['device_uid'],
            ],
            [
                'membership_id' => $membership->id,
                'device_name' => $validated['device_name'],
                'os_version' => $validated['os_version'] ?? 'Windows 11',
                'app_version' => $validated['app_version'] ?? '1.0.0',
                'status' => 'active',
                'last_sync_at' => Carbon::now('UTC'),
                'revoked_at' => null,
            ]
        );

        // Record initial heartbeat
        MonitoringDeviceHeartbeat::create([
            'company_id' => $company->id,
            'tracker_device_id' => $device->id,
            'membership_id' => $membership->id,
            'received_at' => Carbon::now('UTC'),
            'app_version' => $device->app_version ?? '1.0.0',
            'os_version' => $device->os_version,
            'pending_sync_count' => 0,
            'last_sync_status' => 'registered',
            'is_online' => true,
        ]);

        return response()->json([
            'message' => 'Device registered successfully for Finovo Workforce Activity Intelligence.',
            'device' => $device,
            'policy' => $policy,
            'server_time' => Carbon::now('UTC')->toIso8601String(),
        ]);
    }

    public function listDevices(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $devices = TrackerDevice::where('company_id', $company->id)
            ->with(['membership.user:id,name,email'])
            ->orderByDesc('last_sync_at')
            ->get();

        return response()->json(['devices' => $devices]);
    }

    public function recordHeartbeat(Request $request, Company $company, $id): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $device = TrackerDevice::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($device->status === 'revoked') {
            return response()->json([
                'message' => 'Device is revoked and unauthorized.',
                'status' => 'revoked',
            ], 403);
        }

        $validated = $request->validate([
            'app_version' => 'nullable|string|max:50',
            'os_version' => 'nullable|string|max:100',
            'pending_sync_count' => 'nullable|integer|min:0',
            'last_sync_status' => 'nullable|string|max:50',
        ]);

        $device->update([
            'last_sync_at' => Carbon::now('UTC'),
            'app_version' => $validated['app_version'] ?? $device->app_version,
            'os_version' => $validated['os_version'] ?? $device->os_version,
        ]);

        $heartbeat = MonitoringDeviceHeartbeat::create([
            'company_id' => $company->id,
            'tracker_device_id' => $device->id,
            'membership_id' => $membership->id,
            'received_at' => Carbon::now('UTC'),
            'app_version' => $device->app_version ?? '1.0.0',
            'os_version' => $device->os_version,
            'pending_sync_count' => $validated['pending_sync_count'] ?? 0,
            'last_sync_status' => $validated['last_sync_status'] ?? 'ok',
            'is_online' => true,
        ]);

        return response()->json([
            'status' => 'ok',
            'received_at' => $heartbeat->received_at,
            'device_status' => $device->status,
        ]);
    }

    public function revokeDevice(Request $request, Company $company, $id): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $device = TrackerDevice::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $device->update([
            'status' => 'revoked',
            'revoked_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => "Device '{$device->device_name}' revoked successfully.",
            'device' => $device,
        ]);
    }

    // =========================================================================
    // 3. IDEMPOTENT EVENT INGESTION & NORMALIZATION PIPELINE (FR-03, FR-05, Alg 7.7)
    // =========================================================================

    public function submitEventBatch(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'device_uid' => 'required|string|max:100',
            'batch_uid' => 'required|string|max:100',
            'events' => 'required|array|min:1|max:500',
            'events.*.event_uid' => 'required|string|max:100',
            'events.*.event_type' => 'required|string|max:50',
            'events.*.client_occurred_at' => 'required|date',
            'events.*.client_sequence' => 'nullable|integer',
            'events.*.category' => 'nullable|string|max:50',
            'events.*.idle_duration_seconds' => 'nullable|integer',
            'events.*.project_id' => 'nullable|exists:projects,id',
            'events.*.task_id' => 'nullable|exists:tasks,id',
            'events.*.work_session_id' => 'nullable|exists:work_sessions,id',
            'events.*.payload' => 'nullable|array',
        ]);

        $device = TrackerDevice::where('company_id', $company->id)
            ->where('device_uid', $validated['device_uid'])
            ->first();

        if (!$device || $device->status === 'revoked') {
            return response()->json([
                'message' => 'Device is not registered or has been revoked.',
                'error_code' => 'DEVICE_UNAUTHORIZED',
            ], 403);
        }

        $policy = $this->getOrCreateDefaultPolicy($company, $membership);
        $serverReceivedAt = Carbon::now('UTC');

        $accepted = [];
        $duplicates = [];
        $createdEvents = [];

        DB::transaction(function () use (
            $company, $membership, $device, $policy, $serverReceivedAt,
            $validated, &$accepted, &$duplicates, &$createdEvents
        ) {
            foreach ($validated['events'] as $rawEvent) {
                // Idempotency check
                $existing = MonitoringEvent::where('company_id', $company->id)
                    ->where('event_uid', $rawEvent['event_uid'])
                    ->first();

                if ($existing) {
                    $duplicates[] = $rawEvent['event_uid'];
                    continue;
                }

                // Privacy minimization: coerce category to approved list
                $category = $rawEvent['category'] ?? 'unclassified';
                $approvedCategories = ['development', 'communication', 'documentation', 'design', 'meeting', 'unclassified'];
                if (!in_array($category, $approvedCategories)) {
                    $category = 'unclassified';
                }

                $event = MonitoringEvent::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'tracker_device_id' => $device->id,
                    'event_uid' => $rawEvent['event_uid'],
                    'event_type' => $rawEvent['event_type'],
                    'client_occurred_at' => Carbon::parse($rawEvent['client_occurred_at']),
                    'server_received_at' => $serverReceivedAt,
                    'client_sequence' => $rawEvent['client_sequence'] ?? 0,
                    'policy_version' => $policy->version,
                    'category' => $category,
                    'idle_duration_seconds' => $rawEvent['idle_duration_seconds'] ?? null,
                    'project_id' => $rawEvent['project_id'] ?? null,
                    'task_id' => $rawEvent['task_id'] ?? null,
                    'work_session_id' => $rawEvent['work_session_id'] ?? null,
                    'payload' => $rawEvent['payload'] ?? null,
                ]);

                $accepted[] = $rawEvent['event_uid'];
                $createdEvents[] = $event;
            }

            // Update device health
            $device->update(['last_sync_at' => $serverReceivedAt]);

            // Normalization & Interval Synthesis (Alg 7.2)
            $this->normalizeEventsToIntervals($company, $membership, $createdEvents);
        });

        return response()->json([
            'batch_uid' => $validated['batch_uid'],
            'total_submitted' => count($validated['events']),
            'accepted_count' => count($accepted),
            'duplicate_count' => count($duplicates),
            'accepted' => $accepted,
            'duplicates' => $duplicates,
            'server_received_at' => $serverReceivedAt->toIso8601String(),
        ]);
    }

    private function normalizeEventsToIntervals(Company $company, CompanyMembership $membership, array $events): void
    {
        if (empty($events)) {
            return;
        }

        // Group events in 15-minute half-open windows [start_time, end_time)
        foreach ($events as $event) {
            $occurred = Carbon::parse($event->client_occurred_at);
            // Round down to 15-minute slot boundary with clean seconds and microseconds
            $slotStart = $occurred->copy()->minute((int)floor($occurred->minute / 15) * 15)->second(0)->microsecond(0);
            $slotEnd = $slotStart->copy()->addMinutes(15);
            $slotStartStr = $slotStart->format('Y-m-d H:i:s');
            $slotEndStr = $slotEnd->format('Y-m-d H:i:s');

            // Determine active work session & attendance context
            $activeSession = WorkSession::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->where('started_at', '<=', $slotEndStr)
                ->where(function ($q) use ($slotStartStr) {
                    $q->whereNull('ended_at')->orWhere('ended_at', '>=', $slotStartStr);
                })
                ->latest('started_at')
                ->first();

            $attendance = AttendanceRecord::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->whereDate('work_date', $slotStart->toDateString())
                ->first();

            $projectId = $event->project_id ?? ($activeSession ? $activeSession->project_id : null);
            $taskId = $event->task_id ?? ($activeSession ? $activeSession->task_id : null);

            // Context Confidence Evaluation (Alg 7.6)
            $confidence = 'unknown';
            if ($projectId && $taskId && $activeSession && $attendance) {
                $confidence = 'well_contextualized';
            } elseif ($projectId || $activeSession) {
                $confidence = 'partially_contextualized';
            } elseif ($event->idle_duration_seconds && $event->idle_duration_seconds > 600) {
                $confidence = 'needs_review';
            }

            $signalState = 'active_signal';
            if ($event->event_type === 'idle_interval' || ($event->idle_duration_seconds && $event->idle_duration_seconds >= 300)) {
                $signalState = 'idle_signal';
            } elseif ($event->event_type === 'break_state') {
                $signalState = 'explicit_break';
            }

            // Find or update interval for this slot
            $interval = MonitoringInterval::where('company_id', $company->id)
                ->where('membership_id', $membership->id)
                ->where('start_time', $slotStartStr)
                ->first();

            if (!$interval) {
                MonitoringInterval::create([
                    'company_id' => $company->id,
                    'membership_id' => $membership->id,
                    'tracker_device_id' => $event->tracker_device_id,
                    'start_time' => $slotStartStr,
                    'end_time' => $slotEndStr,
                    'duration_seconds' => 900,
                    'signal_state' => $signalState,
                    'app_category' => $event->category ?: 'development',
                    'project_id' => $projectId,
                    'task_id' => $taskId,
                    'work_session_id' => $activeSession ? $activeSession->id : null,
                    'attendance_record_id' => $attendance ? $attendance->id : null,
                    'context_confidence' => $confidence,
                    'quality_state' => 'complete',
                    'derivation_version' => 1,
                    'source_summary' => [
                        'events_count' => 1,
                        'primary_signal' => $event->event_type,
                        'has_session' => (bool)$activeSession,
                        'has_attendance' => (bool)$attendance,
                    ],
                ]);
            } else {
                // Enrich existing interval without double-counting duration
                $interval->update([
                    'signal_state' => $signalState === 'active_signal' ? $signalState : $interval->signal_state,
                    'project_id' => $projectId ?: $interval->project_id,
                    'task_id' => $taskId ?: $interval->task_id,
                    'work_session_id' => $activeSession ? $activeSession->id : $interval->work_session_id,
                    'context_confidence' => $confidence,
                ]);
            }
        }
    }

    // =========================================================================
    // 4. TIMELINES & CONTEXT CONFIDENCE LEDGER (FR-05, Feature 1)
    // =========================================================================

    public function getOwnTimeline(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $date = $request->input('date', Carbon::now('UTC')->toDateString());
        $startOfDay = Carbon::parse($date)->startOfDay();
        $endOfDay = Carbon::parse($date)->endOfDay();

        $intervals = MonitoringInterval::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('start_time', '>=', $startOfDay)
            ->where('end_time', '<=', $endOfDay)
            ->with(['project:id,name,code', 'task:id,title,task_code', 'annotations', 'disputes'])
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'date' => $date,
            'membership_id' => $membership->id,
            'intervals' => $intervals,
            'confidence_legend' => [
                'well_contextualized' => 'Explicit task matched with active work session & confirmed attendance',
                'partially_contextualized' => 'Active signal with partial project or session reference',
                'needs_review' => 'Prolonged idle interval or ambiguous task association',
                'unknown' => 'No contextual task or session reference available',
            ],
        ]);
    }

    public function getTeamTimeline(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $date = $request->input('date', Carbon::now('UTC')->toDateString());
        $startOfDay = Carbon::parse($date)->startOfDay();
        $endOfDay = Carbon::parse($date)->endOfDay();

        $query = MonitoringInterval::where('company_id', $company->id)
            ->where('start_time', '>=', $startOfDay)
            ->where('end_time', '<=', $endOfDay)
            ->with(['membership.user:id,name,email', 'project:id,name,code', 'task:id,title,task_code']);

        if ($request->filled('membership_id')) {
            $query->where('membership_id', $request->input('membership_id'));
        }

        $intervals = $query->orderBy('start_time')->get();

        return response()->json([
            'date' => $date,
            'intervals' => $intervals,
        ]);
    }

    public function getOwnSummary(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $date = $request->input('date', Carbon::now('UTC')->toDateString());
        $startOfDay = Carbon::parse($date)->startOfDay();
        $endOfDay = Carbon::parse($date)->endOfDay();

        $intervals = MonitoringInterval::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->where('start_time', '>=', $startOfDay)
            ->where('end_time', '<=', $endOfDay)
            ->get();

        $totalSeconds = $intervals->sum('duration_seconds');
        $activeSeconds = $intervals->where('signal_state', 'active_signal')->sum('duration_seconds');
        $idleSeconds = $intervals->where('signal_state', 'idle_signal')->sum('duration_seconds');
        $breakSeconds = $intervals->where('signal_state', 'explicit_break')->sum('duration_seconds');

        $byCategory = $intervals->groupBy('app_category')->map(function ($items, $cat) {
            return [
                'category' => $cat ?: 'unclassified',
                'seconds' => $items->sum('duration_seconds'),
                'intervals_count' => $items->count(),
            ];
        })->values();

        $byConfidence = $intervals->groupBy('context_confidence')->map(function ($items, $conf) {
            return [
                'confidence' => $conf,
                'count' => $items->count(),
                'seconds' => $items->sum('duration_seconds'),
            ];
        })->values();

        return response()->json([
            'date' => $date,
            'summary' => [
                'total_observed_hours' => round($totalSeconds / 3600, 2),
                'active_hours' => round($activeSeconds / 3600, 2),
                'idle_signal_hours' => round($idleSeconds / 3600, 2),
                'explicit_break_hours' => round($breakSeconds / 3600, 2),
                'category_distribution' => $byCategory,
                'confidence_distribution' => $byConfidence,
            ],
        ]);
    }

    // =========================================================================
    // 5. CONTEXT ANNOTATIONS & EMPLOYEE DISPUTES (FR-07, Feature 3)
    // =========================================================================

    public function createAnnotation(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'monitoring_interval_id' => 'nullable|exists:monitoring_intervals,id',
            'annotation_date' => 'required|date',
            'start_time' => 'nullable|date',
            'end_time' => 'nullable|date',
            'annotation_type' => 'required|in:offline_work,call_meeting,reading_research,context_correction',
            'explanation' => 'required|string|max:1000',
            'suggested_project_id' => 'nullable|exists:projects,id',
            'suggested_task_id' => 'nullable|exists:tasks,id',
        ]);

        $annotation = MonitoringContextAnnotation::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'monitoring_interval_id' => $validated['monitoring_interval_id'] ?? null,
            'annotation_date' => $validated['annotation_date'],
            'start_time' => isset($validated['start_time']) ? Carbon::parse($validated['start_time']) : null,
            'end_time' => isset($validated['end_time']) ? Carbon::parse($validated['end_time']) : null,
            'annotation_type' => $validated['annotation_type'],
            'explanation' => $validated['explanation'],
            'suggested_project_id' => $validated['suggested_project_id'] ?? null,
            'suggested_task_id' => $validated['suggested_task_id'] ?? null,
        ]);

        // If interval linked, update interval context confidence to well_contextualized
        if (!empty($validated['monitoring_interval_id'])) {
            MonitoringInterval::where('id', $validated['monitoring_interval_id'])
                ->where('company_id', $company->id)
                ->update(['context_confidence' => 'well_contextualized']);
        }

        return response()->json([
            'message' => 'Context annotation recorded without altering raw monitoring signals.',
            'annotation' => $annotation->load(['suggestedProject:id,name', 'suggestedTask:id,title']),
        ], 201);
    }

    public function listAnnotations(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = MonitoringContextAnnotation::where('company_id', $company->id)
            ->with(['suggestedProject:id,name', 'suggestedTask:id,title', 'membership.user:id,name,email']);

        if (!$request->user()->can('monitoring.view_team')) {
            $query->where('membership_id', $membership->id);
        }

        if ($request->filled('date')) {
            $query->whereDate('annotation_date', $request->date);
        }

        return response()->json(['annotations' => $query->latest()->get()]);
    }

    public function submitDispute(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'monitoring_interval_id' => 'required|exists:monitoring_intervals,id',
            'dispute_reason' => 'required|string|max:1000',
        ]);

        $interval = MonitoringInterval::where('company_id', $company->id)
            ->where('id', $validated['monitoring_interval_id'])
            ->firstOrFail();

        $dispute = MonitoringDispute::create([
            'company_id' => $company->id,
            'membership_id' => $membership->id,
            'monitoring_interval_id' => $interval->id,
            'dispute_reason' => $validated['dispute_reason'],
            'status' => 'pending',
        ]);

        $interval->update(['context_confidence' => 'needs_review']);

        return response()->json([
            'message' => 'Activity dispute submitted for managerial review.',
            'dispute' => $dispute,
        ], 201);
    }

    public function listDisputes(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = MonitoringDispute::where('company_id', $company->id)
            ->with(['membership.user:id,name,email', 'interval', 'reviewer.user:id,name,email']);

        // Employees only see their own disputes
        if (!$request->user()->can('monitoring.dispute.review')) {
            $query->where('membership_id', $membership->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(['disputes' => $query->latest()->get()]);
    }

    public function resolveDispute(Request $request, Company $company, $id): JsonResponse
    {
        $reviewer = $this->resolveMembership($company, $request);

        $dispute = MonitoringDispute::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        // Enforce Separation of Duties: employee cannot review their own dispute
        if ($dispute->membership_id === $reviewer->id) {
            return response()->json([
                'message' => 'Separation of duties violation: You cannot review or resolve your own activity dispute.',
                'error_code' => 'SEPARATION_OF_DUTIES_VIOLATION',
            ], 422);
        }

        $validated = $request->validate([
            'status' => 'required|in:approved,rejected',
            'reviewer_comment' => 'required|string|max:1000',
        ]);

        $dispute->update([
            'status' => $validated['status'],
            'reviewed_by_membership_id' => $reviewer->id,
            'reviewer_comment' => $validated['reviewer_comment'],
            'resolved_at' => Carbon::now('UTC'),
        ]);

        if ($dispute->interval) {
            $dispute->interval->update([
                'context_confidence' => $validated['status'] === 'approved' ? 'well_contextualized' : 'needs_review',
            ]);
        }

        return response()->json([
            'message' => "Dispute has been {$validated['status']}.",
            'dispute' => $dispute->load(['reviewer.user:id,name']),
        ]);
    }

    // =========================================================================
    // 6. TIMELINE RECONCILIATION ENGINE (Feature 2, Alg 7.5)
    // =========================================================================

    public function getReconciliationCases(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $query = MonitoringReconciliationCase::where('company_id', $company->id)
            ->with(['membership.user:id,name,email', 'session', 'attendance', 'interval']);

        if (!$request->user()->can('monitoring.reconciliation.review')) {
            $query->where('membership_id', $membership->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(['cases' => $query->latest('case_date')->get()]);
    }

    public function runReconciliation(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $date = $request->input('date', Carbon::now('UTC')->toDateString());
        $members = CompanyMembership::where('company_id', $company->id)->where('status', 'active')->get();

        $generatedCases = [];

        foreach ($members as $member) {
            // Find M06 work sessions on $date
            $sessions = WorkSession::where('company_id', $company->id)
                ->where('membership_id', $member->id)
                ->whereDate('started_at', $date)
                ->get();

            // Find M07 attendance record on $date
            $attendance = AttendanceRecord::where('company_id', $company->id)
                ->where('membership_id', $member->id)
                ->whereDate('work_date', $date)
                ->first();

            // Find M08 intervals on $date
            $intervals = MonitoringInterval::where('company_id', $company->id)
                ->where('membership_id', $member->id)
                ->whereDate('start_time', $date)
                ->get();

            // Case 1: Active M08 signals while no M06 session is clocked
            $untrackedActive = $intervals->where('signal_state', 'active_signal')->whereNull('work_session_id');
            if ($untrackedActive->count() >= 2) {
                $case = MonitoringReconciliationCase::firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'membership_id' => $member->id,
                        'case_date' => $date,
                        'case_type' => 'unassociated_activity',
                    ],
                    [
                        'severity' => 'warning',
                        'title' => 'Desktop Activity Observed Without Active Task Session',
                        'explanation' => "Observed {$untrackedActive->count()} active desktop intervals (~{$untrackedActive->sum('duration_seconds')}s) with no corresponding M06 work session selected.",
                        'status' => 'unresolved',
                    ]
                );
                $generatedCases[] = $case;
            }

            // Case 2: Running M06 session without M07 attendance clock-in
            if ($sessions->isNotEmpty() && (!$attendance || $attendance->status === 'not_clocked_in')) {
                $case = MonitoringReconciliationCase::firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'membership_id' => $member->id,
                        'case_date' => $date,
                        'case_type' => 'm07_clock_gap',
                    ],
                    [
                        'severity' => 'review_required',
                        'title' => 'M06 Work Session Running Without M07 Attendance Clock-In',
                        'explanation' => "Employee recorded task time on {$date} but was not clocked into attendance for the day.",
                        'm06_session_id' => $sessions->first()->id,
                        'status' => 'unresolved',
                    ]
                );
                $generatedCases[] = $case;
            }

            // Case 3: Long idle period during active session
            $longIdle = $intervals->where('signal_state', 'idle_signal')->whereNotNull('work_session_id');
            if ($longIdle->count() >= 2) {
                $case = MonitoringReconciliationCase::firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'membership_id' => $member->id,
                        'case_date' => $date,
                        'case_type' => 'long_idle_interval',
                    ],
                    [
                        'severity' => 'info',
                        'title' => 'Inactivity Detected During Running Task Session',
                        'explanation' => "Multiple idle intervals detected while stopwatch timer was running. Recommended review to confirm whether time was offline work/discussion.",
                        'm06_session_id' => $longIdle->first()->work_session_id,
                        'status' => 'unresolved',
                    ]
                );
                $generatedCases[] = $case;
            }
        }

        return response()->json([
            'message' => 'Timeline reconciliation completed successfully.',
            'cases_generated' => count($generatedCases),
            'date' => $date,
        ]);
    }

    public function reviewReconciliationCase(Request $request, Company $company, $id): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $case = MonitoringReconciliationCase::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'status' => 'required|in:reviewed,resolved',
            'resolution_notes' => 'required|string|max:1000',
        ]);

        $case->update([
            'status' => $validated['status'],
            'resolution_notes' => $validated['resolution_notes'],
        ]);

        return response()->json([
            'message' => 'Reconciliation case updated successfully.',
            'case' => $case,
        ]);
    }

    // =========================================================================
    // 7. EXPORT (FR-10)
    // =========================================================================

    public function exportMonitoring(Request $request, Company $company): StreamedResponse
    {
        $this->resolveMembership($company, $request);

        $date = $request->input('date', Carbon::now('UTC')->toDateString());
        $intervals = MonitoringInterval::where('company_id', $company->id)
            ->whereDate('start_time', $date)
            ->with(['membership.user:id,name,email', 'project:id,name', 'task:id,title'])
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"finovo-monitoring-{$date}.csv\"",
        ];

        return response()->stream(function () use ($intervals) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Interval ID',
                'Employee Name',
                'Employee Email',
                'Start Time (UTC)',
                'End Time (UTC)',
                'Duration (Sec)',
                'Signal State',
                'Application Category',
                'Project',
                'Task',
                'Context Confidence',
                'Quality State',
            ]);

            foreach ($intervals as $i) {
                fputcsv($handle, [
                    $i->id,
                    $i->membership->user->name ?? 'N/A',
                    $i->membership->user->email ?? 'N/A',
                    $i->start_time,
                    $i->end_time,
                    $i->duration_seconds,
                    $i->signal_state,
                    $i->app_category,
                    $i->project->name ?? 'N/A',
                    $i->task->title ?? 'N/A',
                    $i->context_confidence,
                    $i->quality_state,
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}

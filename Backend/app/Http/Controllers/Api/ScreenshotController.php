<?php

namespace App\Http\Controllers\Api;

use App\Helpers\StorageHelper;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\CompanyMembership;
use App\Models\Screenshot;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

/**
 * Admin-triggered employee screen capture.
 *
 * Flow (same model as the task-management desktop agent):
 *  1. Admin clicks "Take Screenshot" -> requestScreenshot() queues a capture job for the employee.
 *  2. The Finovo Desktop Tracker running on the employee's computer polls
 *     employeeCheckRequest() every few seconds (identified by the X-Finovo-Client header).
 *  3. The tracker captures the real screen natively (no browser share-screen prompt)
 *     and uploads it to employeeSubmitScreenshot().
 *  4. Admin polls checkScreenshotStatus() and receives the stored screenshot.
 */
class ScreenshotController extends Controller
{
    private const DESKTOP_CLIENT_HEADER = 'X-Finovo-Client';
    private const DESKTOP_CLIENT_VALUE = 'desktop-tracker';

    private const AGENT_HEARTBEAT_TTL_SECONDS = 15;
    private const PENDING_REQUEST_TTL_SECONDS = 60;
    private const JOB_TTL_SECONDS = 120;
    private const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

    private const ACTIVE_STATUSES = ['present', 'late', 'clocked_in'];

    /**
     * POST /attendance/{record}/screenshot
     * Direct upload of an already captured image by an authorized manager.
     */
    public function store(Request $request, $param1 = null, $param2 = null): JsonResponse
    {
        $record = $this->resolveRecord($request, $param1, $param2);
        if (!$record) {
            return response()->json(['message' => 'Attendance record not found.'], 404);
        }

        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$this->canManageScreenshots($request, $record, $user)) {
            return response()->json([
                'message' => 'Access Denied: Only administrators and authorized managers can capture employee screenshots.',
            ], 403);
        }

        if (!$this->isActivelyClockedIn($record)) {
            return response()->json([
                'message' => 'Employee is not currently clocked in. Screenshots can only be captured during an active clock-in session.',
            ], 403);
        }

        $image = $this->decodeImage((string) $request->input('image', ''));
        if ($image === null) {
            return response()->json(['message' => 'A valid PNG or JPEG image is required.'], 422);
        }

        $screenshot = $this->persistScreenshot($record, $image['binary'], $image['extension'], $user->id);

        return response()->json([
            'message'    => 'Screenshot captured and stored successfully.',
            'url'        => $screenshot->url,
            'screenshot' => $screenshot,
            'record_id'  => $record->id,
            'stored_at'  => $screenshot->stored_at->toIso8601String(),
        ], 201);
    }

    /**
     * POST /attendance/{record}/request-screenshot
     * Admin queues a remote capture job for the employee's desktop tracker.
     */
    public function requestScreenshot(Request $request, $param1 = null, $param2 = null): JsonResponse
    {
        $record = $this->resolveRecord($request, $param1, $param2);
        if (!$record) {
            return response()->json(['message' => 'Attendance record not found.'], 404);
        }

        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$this->canManageScreenshots($request, $record, $user)) {
            return response()->json([
                'message' => 'Access Denied: Only administrators have permission to capture employee screens.',
            ], 403);
        }

        if (!$this->isActivelyClockedIn($record)) {
            return response()->json([
                'message' => 'Employee is not currently clocked in. Screenshots can only be captured during an active clock-in session.',
            ], 403);
        }

        $record->loadMissing('membership.user');
        $employeeUserId = $record->membership?->user_id;
        $employeeName = $record->membership?->user?->name ?? 'Employee';

        if (!$employeeUserId) {
            return response()->json(['message' => 'Employee account for this attendance record could not be resolved.'], 422);
        }

        if (!$this->isDesktopAgentOnline($employeeUserId)) {
            return response()->json([
                'status'  => 'agent_offline',
                'message' => "Finovo Desktop Tracker is not running on {$employeeName}'s computer. Ask the employee to open the tracker and sign in, then try again.",
            ], 409);
        }

        $requestId = 'req_' . bin2hex(random_bytes(12));

        Cache::put($this->pendingRequestKey($employeeUserId), [
            'request_id'   => $requestId,
            'record_id'    => $record->id,
            'admin_id'     => $user->id,
            'requested_at' => now()->timestamp,
        ], self::PENDING_REQUEST_TTL_SECONDS);

        Cache::put($this->jobKey($requestId), [
            'status'           => 'pending',
            'record_id'        => $record->id,
            'admin_id'         => $user->id,
            'employee_user_id' => $employeeUserId,
            'created_at'       => now()->timestamp,
        ], self::JOB_TTL_SECONDS);

        return response()->json([
            'mode'          => 'remote_dispatch',
            'status'        => 'pending',
            'request_id'    => $requestId,
            'record_id'     => $record->id,
            'employee_name' => $employeeName,
            'message'       => 'Capture request sent to the employee\'s desktop tracker.',
        ]);
    }

    /**
     * GET /attendance/screenshot-status/{requestId}
     * Admin polls until the employee's desktop tracker has uploaded the capture.
     */
    public function checkScreenshotStatus(Request $request, $param1 = null, $param2 = null): JsonResponse
    {
        $requestId = $param2 ?? $param1 ?? $request->route('requestId') ?? $request->input('request_id');
        if (!is_string($requestId) || $requestId === '') {
            return response()->json(['message' => 'Request ID is required.'], 400);
        }

        $job = Cache::get($this->jobKey($requestId));
        if (!$job) {
            return response()->json([
                'status'  => 'expired',
                'message' => 'Screenshot request expired or the employee\'s desktop tracker went offline.',
            ], 404);
        }

        if ((int) ($job['admin_id'] ?? 0) !== (int) Auth::id()) {
            return response()->json(['message' => 'This screenshot request belongs to another administrator.'], 403);
        }

        if ($job['status'] === 'fulfilled') {
            return response()->json([
                'status'     => 'fulfilled',
                'screenshot' => $job['screenshot'],
                'url'        => $job['url'],
                'record_id'  => $job['record_id'],
            ]);
        }

        if ($job['status'] === 'failed') {
            return response()->json([
                'status'  => 'failed',
                'message' => $job['message'] ?? 'The desktop tracker could not capture the screen.',
            ]);
        }

        return response()->json([
            'status'     => 'pending',
            'request_id' => $requestId,
        ]);
    }

    /**
     * GET /attendance/employee/check-screenshot-request
     *
     * Desktop tracker (X-Finovo-Client: desktop-tracker): records a heartbeat and receives pending capture jobs.
     * Web portal: only receives connection status so the employee can be reminded to open the tracker.
     */
    public function employeeCheckRequest(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $isDesktopAgent = $request->header(self::DESKTOP_CLIENT_HEADER) === self::DESKTOP_CLIENT_VALUE;
        if ($isDesktopAgent) {
            Cache::put($this->agentHeartbeatKey($user->id), now()->timestamp, self::AGENT_HEARTBEAT_TTL_SECONDS);
        }

        $isClockedIn = AttendanceRecord::whereHas('membership', function ($query) use ($user) {
            $query->where('user_id', $user->id);
        })
            ->whereNotNull('first_clock_in_at')
            ->whereNull('last_clock_out_at')
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->exists();

        $response = [
            'has_request'     => false,
            'is_clocked_in'   => $isClockedIn,
            'agent_connected' => $isDesktopAgent || $this->isDesktopAgentOnline($user->id),
        ];

        if (!$isDesktopAgent) {
            return response()->json($response);
        }

        $pending = Cache::get($this->pendingRequestKey($user->id));
        if ($pending && $isClockedIn) {
            $response['has_request'] = true;
            $response['request_id'] = $pending['request_id'];
            $response['record_id'] = $pending['record_id'];
        }

        return response()->json($response);
    }

    /**
     * POST /attendance/employee/submit-screenshot
     * Desktop tracker uploads the natively captured screen for a pending admin request.
     */
    public function employeeSubmitScreenshot(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $requestId = (string) $request->input('request_id', '');
        $recordId = (int) $request->input('record_id', 0);

        if ($requestId === '' || $recordId <= 0) {
            return response()->json(['message' => 'Request ID and record ID are required.'], 422);
        }

        $job = Cache::get($this->jobKey($requestId));
        if (!$job || $job['status'] !== 'pending') {
            return response()->json(['message' => 'Screenshot request expired or was already fulfilled.'], 410);
        }

        if ((int) $job['employee_user_id'] !== (int) $user->id || (int) $job['record_id'] !== $recordId) {
            return response()->json(['message' => 'This screenshot request does not belong to your session.'], 403);
        }

        $record = AttendanceRecord::with('membership')->find($recordId);
        if (!$record || (int) $record->membership?->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Attendance record not found.'], 404);
        }

        $image = $this->decodeImage((string) $request->input('image', ''));
        if ($image === null) {
            Cache::put($this->jobKey($requestId), array_merge($job, [
                'status'  => 'failed',
                'message' => 'The desktop tracker sent an invalid image.',
            ]), self::JOB_TTL_SECONDS);
            Cache::forget($this->pendingRequestKey($user->id));

            return response()->json(['message' => 'A valid PNG or JPEG image is required.'], 422);
        }

        $adminId = (int) $job['admin_id'];
        $screenshot = $this->persistScreenshot($record, $image['binary'], $image['extension'], $adminId);

        Cache::put($this->jobKey($requestId), [
            'status'           => 'fulfilled',
            'screenshot'       => $screenshot->toArray(),
            'url'              => $screenshot->url,
            'record_id'        => $record->id,
            'admin_id'         => $adminId,
            'employee_user_id' => $user->id,
        ], self::JOB_TTL_SECONDS);

        Cache::forget($this->pendingRequestKey($user->id));

        return response()->json([
            'success' => true,
            'message' => 'Screen submitted successfully.',
            'url'     => $screenshot->url,
        ]);
    }

    private function resolveRecord(Request $request, $param1, $param2): ?AttendanceRecord
    {
        $target = $param2 ?? $param1 ?? $request->route('record');

        if ($target instanceof AttendanceRecord) {
            return $target;
        }

        if (is_numeric($target)) {
            return AttendanceRecord::find((int) $target);
        }

        return null;
    }

    private function canManageScreenshots(Request $request, AttendanceRecord $record, User $user): bool
    {
        $membership = $request->attributes->get('currentMembership');

        if (!$membership || (int) $membership->company_id !== (int) $record->company_id) {
            $membership = CompanyMembership::where('company_id', $record->company_id)
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->first();
        }

        return $membership !== null && $membership->canViewMonitoringScreenshots();
    }

    private function isActivelyClockedIn(AttendanceRecord $record): bool
    {
        return !empty($record->first_clock_in_at)
            && is_null($record->last_clock_out_at)
            && in_array($record->status, self::ACTIVE_STATUSES, true);
    }

    private function isDesktopAgentOnline(int $userId): bool
    {
        return Cache::has($this->agentHeartbeatKey($userId));
    }

    /**
     * Decodes a base64 / data-URL image and verifies it is a real PNG or JPEG.
     *
     * @return array{binary: string, extension: string}|null
     */
    private function decodeImage(string $raw): ?array
    {
        if ($raw === '') {
            return null;
        }

        if (str_starts_with($raw, 'data:image')) {
            $commaPosition = strpos($raw, ',');
            $raw = $commaPosition === false ? '' : substr($raw, $commaPosition + 1);
        }

        $binary = base64_decode($raw, true);
        if ($binary === false || $binary === '' || strlen($binary) > self::MAX_IMAGE_BYTES) {
            return null;
        }

        $info = @getimagesizefromstring($binary);
        if ($info === false) {
            return null;
        }

        $extension = match ($info['mime'] ?? '') {
            'image/png'  => 'png',
            'image/jpeg' => 'jpg',
            default      => null,
        };

        return $extension === null ? null : ['binary' => $binary, 'extension' => $extension];
    }

    private function persistScreenshot(AttendanceRecord $record, string $binary, string $extension, int $adminId): Screenshot
    {
        $filename = sprintf('screenshot_%d_%s_%s.%s', $record->id, now()->format('YmdHis'), bin2hex(random_bytes(4)), $extension);
        $url = StorageHelper::storeScreenshot($filename, $binary, $record, $adminId);

        $screenshot = Screenshot::create([
            'attendance_record_id' => $record->id,
            'admin_id'             => $adminId,
            'url'                  => $url,
            'stored_at'            => now(),
        ]);

        return $screenshot->load('admin');
    }

    private function pendingRequestKey(int $userId): string
    {
        return "pending_screen_req_user_{$userId}";
    }

    private function jobKey(string $requestId): string
    {
        return "screen_job_{$requestId}";
    }

    private function agentHeartbeatKey(int $userId): string
    {
        return "screen_agent_heartbeat_user_{$userId}";
    }
}

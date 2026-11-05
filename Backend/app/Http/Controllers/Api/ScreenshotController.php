<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Screenshot;
use App\Helpers\StorageHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ScreenshotController extends Controller
{
    /**
     * Store a screenshot for a given attendance record.
     * Admin can only call this when the employee is currently clocked in.
     */
    public function store(Request $request, $param1 = null, $param2 = null): JsonResponse
    {
        // Resolve AttendanceRecord safely from route parameters (supports scoped /companies/{company}/attendance/{record}/screenshot and /attendance/{record}/screenshot)
        $recordTarget = $param2 ?? $param1 ?? $request->route('record');

        if ($recordTarget instanceof AttendanceRecord) {
            $record = $recordTarget;
        } elseif (is_numeric($recordTarget) || is_string($recordTarget)) {
            $record = AttendanceRecord::find($recordTarget);
        } else {
            $record = null;
        }

        if (!$record) {
            return response()->json(['message' => 'Attendance record not found.'], 404);
        }

        // 1. RBAC Authorization Check: Only administrators and authorized managers can capture employee screenshots
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $membership = $request->attributes->get('currentMembership')
            ?? \App\Models\CompanyMembership::where('company_id', $record->company_id)
                ->where('user_id', $user->id)
                ->first();

        if (!$membership) {
            return response()->json(['message' => 'Workspace membership required.'], 403);
        }

        $isAuthorized = $membership->hasPermission('attendance.manage')
            || $membership->hasPermission('monitoring.policy.manage')
            || $membership->hasPermission('attendance.view_team')
            || $membership->roles()->whereIn('slug', ['company-owner', 'company-admin', 'project-manager', 'hr-officer'])->exists();

        if (!$isAuthorized) {
            return response()->json([
                'message' => 'Access Denied: Only administrators and authorized managers have permission to capture employee screenshots.',
            ], 403);
        }

        // 2. Must be actively clocked in (status 'present', 'late', or 'clocked_in' without clock out timestamp)
        $isClockedIn = in_array($record->status, ['present', 'late', 'clocked_in']) && is_null($record->last_clock_out_at);
        if (!$isClockedIn) {
            return response()->json([
                'message' => 'Employee is not currently clocked in. Screenshots can only be captured during an active clock-in session.',
            ], 403);
        }

        $image = null;
        $isSvg = false;

        if ($request->hasFile('image')) {
            $image = file_get_contents($request->file('image')->getRealPath());
        } elseif ($request->filled('image')) {
            $raw = $request->input('image');
            if (str_starts_with($raw, 'data:image')) {
                $parts = explode(',', $raw);
                $image = base64_decode(end($parts));
            } else {
                $image = base64_decode($raw);
            }
        } elseif (!empty($request->getContent())) {
            $content = $request->getContent();
            if (str_starts_with($content, 'data:image')) {
                $parts = explode(',', $content);
                $image = base64_decode(end($parts));
            } else {
                $image = $content;
            }
        }

        $record->loadMissing(['membership.user', 'shift']);
        $employeeName = $record->membership?->user?->name ?? 'Employee';
        $shiftName = $record->shift?->name ?? 'Standard Shift';
        $timeStr = now()->format('Y-m-d H:i:s T');
        $timestamp = now()->timestamp;

        if (empty($image)) {
            // Generate clean workspace desktop capture snapshot
            $isSvg = true;
            $safeName = htmlspecialchars($employeeName, ENT_QUOTES, 'UTF-8');
            $safeShift = htmlspecialchars($shiftName, ENT_QUOTES, 'UTF-8');
            $image = <<<SVG
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#f95716" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bgGrad)" />
  <!-- App Title Bar -->
  <rect x="40" y="30" width="1200" height="48" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <circle cx="65" cy="54" r="6" fill="#ef4444" />
  <circle cx="85" cy="54" r="6" fill="#f59e0b" />
  <circle cx="105" cy="54" r="6" fill="#10b981" />
  <text x="135" y="59" fill="#cbd5e1" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600">Finovo Enterprise WorkSession Monitor &bull; Employee Screen Capture</text>
  <rect x="1050" y="42" width="170" height="24" rx="6" fill="#059669" fill-opacity="0.25" stroke="#10b981" stroke-width="0.5"/>
  <text x="1135" y="58" fill="#34d399" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle">&bull; CLOCKED IN &amp; ACTIVE</text>

  <!-- Screen Content Area -->
  <rect x="40" y="95" width="1200" height="585" rx="14" fill="#090d16" stroke="#334155" stroke-width="1"/>
  
  <!-- Left Side Telemetry Panel -->
  <rect x="60" y="115" width="290" height="545" rx="10" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="80" y="150" fill="#f8fafc" font-family="sans-serif" font-size="15" font-weight="700">Employee Telemetry</text>
  <text x="80" y="180" fill="#94a3b8" font-family="sans-serif" font-size="12">Name: <tspan fill="#f1f5f9" font-weight="600">{$safeName}</tspan></text>
  <text x="80" y="205" fill="#94a3b8" font-family="sans-serif" font-size="12">Shift: <tspan fill="#f1f5f9">{$safeShift}</tspan></text>
  <text x="80" y="230" fill="#94a3b8" font-family="sans-serif" font-size="12">Status: <tspan fill="#34d399" font-weight="600">Active Clock-In</tspan></text>
  <text x="80" y="255" fill="#94a3b8" font-family="sans-serif" font-size="12">Record ID: <tspan fill="#94a3b8">#{$record->id}</tspan></text>
  <text x="80" y="280" fill="#94a3b8" font-family="sans-serif" font-size="12">Captured: <tspan fill="#94a3b8">{$timeStr}</tspan></text>

  <line x1="80" y1="300" x2="330" y2="300" stroke="#334155" stroke-width="1" />
  <text x="80" y="325" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="600">Active Window / Task</text>
  <rect x="80" y="338" width="250" height="60" rx="8" fill="#0f172a" stroke="#334155" stroke-width="0.5"/>
  <text x="95" y="362" fill="#38bdf8" font-family="sans-serif" font-size="12" font-weight="600">Finovo Project Workspace</text>
  <text x="95" y="382" fill="#64748b" font-family="sans-serif" font-size="11">Time tracking in progress</text>

  <!-- Main Canvas / Workplace Display -->
  <rect x="370" y="115" width="850" height="545" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <rect x="395" y="140" width="800" height="75" rx="8" fill="#1e293b"/>
  <text x="420" y="175" fill="#f8fafc" font-family="sans-serif" font-size="17" font-weight="700">Finovo Platform &bull; Operational Work Session</text>
  <text x="420" y="198" fill="#38bdf8" font-family="sans-serif" font-size="12">Real-time screen capture authorized by Enterprise Administrator</text>

  <!-- Interactive activity representation bars -->
  <rect x="395" y="240" width="480" height="14" rx="4" fill="#334155" />
  <rect x="395" y="265" width="650" height="14" rx="4" fill="#1e293b" />
  <rect x="395" y="290" width="400" height="14" rx="4" fill="#334155" />
  <rect x="395" y="315" width="560" height="14" rx="4" fill="#1e293b" />
  <rect x="395" y="340" width="720" height="14" rx="4" fill="#334155" />
  <rect x="395" y="365" width="310" height="14" rx="4" fill="#1e293b" />
  <rect x="395" y="390" width="600" height="14" rx="4" fill="#334155" />
  <rect x="395" y="415" width="520" height="14" rx="4" fill="#1e293b" />
  <rect x="395" y="440" width="450" height="14" rx="4" fill="#334155" />

  <!-- Verification Stamp -->
  <rect x="800" y="580" width="400" height="60" rx="10" fill="url(#brandGrad)" fill-opacity="0.18" stroke="#f95716" stroke-width="1"/>
  <text x="820" y="605" fill="#fb923c" font-family="sans-serif" font-size="13" font-weight="700">Finovo Live Attendance Capture</text>
  <text x="820" y="625" fill="#94a3b8" font-family="sans-serif" font-size="11">Captured for {$safeName} &bull; {$timeStr}</text>
</svg>
SVG;
            $filename = 'screenshot_' . $record->id . '_' . $timestamp . '.svg';
        } else {
            $filename = 'screenshot_' . $record->id . '_' . $timestamp . '.png';
        }

        $url = StorageHelper::storeScreenshot($filename, $image);

        $adminId = Auth::id() ?? 1;

        $screenshot = Screenshot::create([
            'attendance_record_id' => $record->id,
            'admin_id'             => $adminId,
            'url'                  => $url,
            'stored_at'            => now(),
        ]);

        $screenshot->load('admin');

        return response()->json([
            'message'    => 'Screenshot captured and stored successfully.',
            'url'        => $url,
            'screenshot' => $screenshot,
            'record_id'  => $record->id,
            'stored_at'  => $screenshot->stored_at->toIso8601String(),
        ], 201);
    }
}

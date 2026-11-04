<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AnnouncementAcknowledgment;
use App\Models\CollaborationAuditEvent;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    // =========================================================================
    // 1. UNIFIED NOTIFICATION INBOX (FR-07, Alg 7.6)
    // =========================================================================

    public function index(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $limit = min((int)$request->input('limit', 20), 50);

        $query = Notification::where('company_id', $company->id)
            ->where('user_id', $user->id);

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->has('unread_only') && filter_var($request->unread_only, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('is_read', false);
        }

        $notifications = $query->latest()->paginate($limit);

        return response()->json($notifications);
    }

    public function unreadCount(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $count = Notification::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('is_read', false)
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    public function markAsRead(Request $request, Company $company, $notificationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $notification = Notification::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('id', $notificationId)
            ->firstOrFail();

        $notification->update([
            'is_read' => true,
            'read_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => 'Notification marked as read.',
            'notification' => $notification,
        ]);
    }

    public function markAllAsRead(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        Notification::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now('UTC'),
            ]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    // =========================================================================
    // 2. NOTIFICATION PREFERENCES & QUIET HOURS (FR-08, Alg 7.7)
    // =========================================================================

    public function getPreferences(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $prefs = NotificationPreference::firstOrCreate(
            ['company_id' => $company->id, 'user_id' => $user->id],
            [
                'in_app_enabled' => true,
                'email_enabled' => true,
                'quiet_hours_enabled' => false,
                'quiet_hours_start' => '22:00:00',
                'quiet_hours_end' => '08:00:00',
                'timezone' => 'UTC',
                'focus_mode' => false,
            ]
        );

        return response()->json(['preferences' => $prefs]);
    }

    public function updatePreferences(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $validated = $request->validate([
            'in_app_enabled' => 'nullable|boolean',
            'email_enabled' => 'nullable|boolean',
            'quiet_hours_enabled' => 'nullable|boolean',
            'quiet_hours_start' => 'nullable|date_format:H:i:s,H:i',
            'quiet_hours_end' => 'nullable|date_format:H:i:s,H:i',
            'timezone' => 'nullable|string|max:50',
            'focus_mode' => 'nullable|boolean',
            'category_settings' => 'nullable|array',
        ]);

        $prefs = NotificationPreference::updateOrCreate(
            ['company_id' => $company->id, 'user_id' => $user->id],
            $validated
        );

        return response()->json([
            'message' => 'Preferences updated successfully.',
            'preferences' => $prefs,
        ]);
    }

    // =========================================================================
    // 3. TARGETED ANNOUNCEMENTS (FR-09)
    // =========================================================================

    public function listAnnouncements(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $announcements = Announcement::where('company_id', $company->id)
            ->where('status', 'published')
            ->with(['creator:id,name,email'])
            ->withCount([
                'acknowledgments as user_acknowledged_count' => fn ($q) => $q->where('user_id', $user->id),
                'acknowledgments',
            ])
            ->latest('published_at')
            ->get();

        $formatted = $announcements->map(function ($a) {
            return array_merge($a->toArray(), [
                'has_acknowledged' => $a->user_acknowledged_count > 0,
            ]);
        });

        return response()->json(['announcements' => $formatted]);
    }

    public function createAnnouncement(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $user = $request->user();

        $validated = $request->validate([
            'title' => 'required|string|max:200',
            'content' => 'required|string',
            'audience_type' => 'required|in:company,department,project,client',
            'audience_target_id' => 'nullable|integer',
            'requires_acknowledgment' => 'nullable|boolean',
            'is_pinned' => 'nullable|boolean',
            'publish_now' => 'nullable|boolean',
        ]);

        $isPublished = !empty($validated['publish_now']);

        $announcement = Announcement::create([
            'company_id' => $company->id,
            'creator_user_id' => $user->id,
            'title' => $validated['title'],
            'content' => $validated['content'],
            'audience_type' => $validated['audience_type'],
            'audience_target_id' => $validated['audience_target_id'] ?? null,
            'status' => $isPublished ? 'published' : 'draft',
            'requires_acknowledgment' => $validated['requires_acknowledgment'] ?? false,
            'is_pinned' => $validated['is_pinned'] ?? false,
            'published_at' => $isPublished ? Carbon::now('UTC') : null,
        ]);

        // Fan out notifications if published
        if ($isPublished) {
            $companyUsers = CompanyMembership::where('company_id', $company->id)
                ->where('status', 'active')
                ->where('user_id', '!=', $user->id)
                ->pluck('user_id');

            foreach ($companyUsers as $uId) {
                Notification::create([
                    'company_id' => $company->id,
                    'user_id' => $uId,
                    'event_type' => 'announcement',
                    'title' => "Announcement: {$announcement->title}",
                    'summary' => Str::limit($announcement->content, 120),
                    'action_route' => "/app/{$company->slug}/collaboration",
                    'source_resource_type' => 'announcement',
                    'source_resource_id' => $announcement->id,
                    'category' => 'announcements',
                    'priority' => 'high',
                    'deduplication_key' => "announcement_{$announcement->id}_{$uId}",
                ]);
            }
        }

        CollaborationAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $user->id,
            'action' => 'announcement_created',
            'details' => ['announcement_id' => $announcement->id, 'published' => $isPublished],
        ]);

        return response()->json([
            'message' => $isPublished ? 'Announcement published successfully.' : 'Announcement saved as draft.',
            'announcement' => $announcement->load('creator:id,name'),
        ], 201);
    }

    public function acknowledgeAnnouncement(Request $request, Company $company, $announcementId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $announcement = Announcement::where('company_id', $company->id)
            ->where('id', $announcementId)
            ->firstOrFail();

        $ack = AnnouncementAcknowledgment::firstOrCreate(
            ['announcement_id' => $announcement->id, 'user_id' => $user->id],
            ['acknowledged_at' => Carbon::now('UTC')]
        );

        return response()->json([
            'message' => 'Announcement acknowledged successfully.',
            'acknowledgment' => $ack,
        ]);
    }
}

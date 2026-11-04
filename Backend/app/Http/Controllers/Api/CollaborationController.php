<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollaborationAuditEvent;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\ConversationReadCursor;
use App\Models\Message;
use App\Models\MessageActionLink;
use App\Models\MessageMention;
use App\Models\MessageReaction;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CollaborationController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function verifyConversationAccess(Conversation $conversation, User $user): ConversationMember
    {
        return ConversationMember::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function resolveUserPresence(int $companyId, int $userId, int $now): array
    {
        $cached = Cache::get("user_presence_{$companyId}_{$userId}")
            ?? Cache::get("user_presence_{$userId}");

        if (!$cached) {
            return [
                'status' => 'offline',
                'is_online' => false,
                'last_seen_at' => null,
                'last_seen_human' => 'Offline',
            ];
        }

        $lastSeenAt = $cached['last_active_at'] ?? null;
        $diff = $now - ($cached['last_active_timestamp'] ?? 0);
        $status = 'offline';

        if (($cached['status'] ?? 'online') === 'offline') {
            $status = 'offline';
        } elseif ($diff <= 65) {
            $status = ($cached['status'] ?? 'online') === 'away' ? 'away' : 'online';
        } elseif ($diff <= 300) {
            $status = 'away';
        } else {
            $status = 'offline';
        }

        $lastSeenHuman = 'Offline';
        if ($lastSeenAt) {
            try {
                $lastSeenHuman = Carbon::parse($lastSeenAt)->diffForHumans();
            } catch (\Throwable $e) {
                $lastSeenHuman = 'Recently';
            }
        }

        return [
            'status' => $status,
            'is_online' => $status === 'online',
            'last_seen_at' => $lastSeenAt,
            'last_seen_human' => $status === 'online' ? 'Active Now' : ($status === 'away' ? 'Away' : "Last seen {$lastSeenHuman}"),
        ];
    }

    // =========================================================================
    // 1. CONVERSATION MANAGEMENT (FR-01, FR-02, FR-03, FR-04)
    // =========================================================================

    public function index(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        // Auto-provision direct conversations between active colleagues so messaging & calling are seamless
        $activeCoworkerIds = CompanyMembership::where('company_id', $company->id)
            ->where('status', 'active')
            ->whereNull('revoked_at')
            ->where('user_id', '!=', $user->id)
            ->pluck('user_id');

        foreach ($activeCoworkerIds as $otherUserId) {
            $existing = Conversation::where('company_id', $company->id)
                ->where('type', 'direct')
                ->whereHas('members', fn ($q) => $q->where('user_id', $user->id))
                ->whereHas('members', fn ($q) => $q->where('user_id', $otherUserId))
                ->exists();

            if (! $existing) {
                DB::transaction(function () use ($company, $user, $otherUserId) {
                    $otherUser = User::find($otherUserId);
                    $conv = Conversation::create([
                        'company_id' => $company->id,
                        'type' => 'direct',
                        'title' => $otherUser ? $otherUser->name : 'Direct Message',
                        'created_by_user_id' => $user->id,
                        'status' => 'active',
                        'last_message_at' => Carbon::now('UTC'),
                        'last_sequence_number' => 0,
                    ]);
                    ConversationMember::create([
                        'conversation_id' => $conv->id,
                        'user_id' => $user->id,
                        'role' => 'creator',
                        'status' => 'active',
                        'joined_at' => Carbon::now('UTC'),
                    ]);
                    ConversationMember::create([
                        'conversation_id' => $conv->id,
                        'user_id' => $otherUserId,
                        'role' => 'member',
                        'status' => 'active',
                        'joined_at' => Carbon::now('UTC'),
                    ]);
                    ConversationReadCursor::firstOrCreate(
                        ['conversation_id' => $conv->id, 'user_id' => $user->id],
                        ['last_read_sequence' => 0, 'last_read_at' => Carbon::now('UTC')]
                    );
                    ConversationReadCursor::firstOrCreate(
                        ['conversation_id' => $conv->id, 'user_id' => $otherUserId],
                        ['last_read_sequence' => 0, 'last_read_at' => Carbon::now('UTC')]
                    );
                });
            }
        }

        $isCompanyAdmin = $user->is_platform_admin 
            || CompanyMembership::where('company_id', $company->id)
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->whereHas('roles', fn ($q) => $q->whereIn('slug', ['company-owner', 'company-admin']))
                ->exists();

        $conversations = Conversation::where('company_id', $company->id)
            ->where(function ($q) use ($user, $isCompanyAdmin) {
                // All users can see conversations where they are an active member
                $q->whereHas('members', function ($mq) use ($user) {
                    $mq->where('user_id', $user->id)->where('status', 'active');
                });

                // Authorized Company Admins can oversee all non-direct workspace channels (projects, groups, tasks, client rooms)
                if ($isCompanyAdmin) {
                    $q->orWhere(function ($adminQ) {
                        $adminQ->where('type', '!=', 'direct')
                               ->where('status', 'active');
                    });
                }
            })
            ->with([
                'createdBy:id,name,email',
                'project:id,name,project_code',
                'task:id,name,task_code',
                'clientOrganization:id,name,reference_code',
                'members.user:id,name,email',
                'readCursors' => fn ($q) => $q->where('user_id', $user->id),
                'latestMessage.sender:id,name',
            ])
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->type))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status), fn ($q) => $q->where('status', 'active'))
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->get();

        $now = Carbon::now()->timestamp;

        // Compute unread counts and accurate real-time presence for each conversation
        $formatted = $conversations->map(function ($c) use ($user, $company, $now) {
            $cursor = $c->readCursors->first();
            $lastReadSeq = $cursor ? $cursor->last_read_sequence : 0;
            $unreadCount = max(0, $c->last_sequence_number - $lastReadSeq);

            $onlineCount = 0;
            $partnerPresence = null;
            $otherMemberUser = null;

            $membersWithPresence = $c->members->map(function ($m) use ($company, $now, $user, $c, &$onlineCount, &$partnerPresence, &$otherMemberUser) {
                $presence = $this->resolveUserPresence($company->id, $m->user_id, $now);
                if ($presence['is_online']) {
                    $onlineCount++;
                }
                if ($c->type === 'direct' && $m->user_id !== $user->id) {
                    $partnerPresence = $presence;
                    $otherMemberUser = $m->user;
                }

                $mArr = $m->toArray();
                $mArr['presence'] = $presence;
                $mArr['status'] = $presence['status'];
                return $mArr;
            });

            // For direct conversations, dynamic title is the other person's verified name
            $convTitle = ($c->type === 'direct' && $otherMemberUser)
                ? $otherMemberUser->name
                : ($c->title ?: 'Conversation');

            // For direct conversations, conversation status is the other person's verified presence
            // For channels/groups, status is 'online' if >= 1 member is online
            $convStatus = $c->type === 'direct'
                ? ($partnerPresence['status'] ?? 'offline')
                : ($onlineCount > 0 ? 'online' : 'offline');

            $cData = $c->toArray();
            $cData['title'] = $convTitle;
            $cData['members'] = $membersWithPresence;

            return array_merge($cData, [
                'unread_count' => $unreadCount,
                'last_read_sequence' => $lastReadSeq,
                'status' => $convStatus,
                'online_members_count' => $onlineCount,
                'total_members_count' => $c->members->count(),
                'last_seen_at' => $partnerPresence['last_seen_at'] ?? null,
                'last_seen_human' => $partnerPresence['last_seen_human'] ?? null,
            ]);
        });

        return response()->json(['conversations' => $formatted]);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $validated = $request->validate([
            'type' => 'required|in:direct,group,project,task,client',
            'title' => 'nullable|string|max:180',
            'recipient_user_id' => 'required_if:type,direct|nullable|exists:users,id',
            'member_user_ids' => 'nullable|array',
            'member_user_ids.*' => 'exists:users,id',
            'project_id' => 'nullable|exists:projects,id',
            'task_id' => 'nullable|exists:tasks,id',
            'client_organization_id' => 'nullable|exists:client_organizations,id',
        ]);

        return DB::transaction(function () use ($company, $user, $validated) {
            // Direct conversation reuse logic
            if ($validated['type'] === 'direct') {
                $recipientId = (int)$validated['recipient_user_id'];
                if ($recipientId === (int)$user->id) {
                    abort(422, 'Cannot initiate direct conversation with yourself.');
                }

                $existing = Conversation::where('company_id', $company->id)
                    ->where('type', 'direct')
                    ->whereHas('members', fn ($q) => $q->where('user_id', $user->id))
                    ->whereHas('members', fn ($q) => $q->where('user_id', $recipientId))
                    ->first();

                if ($existing) {
                    return response()->json([
                        'message' => 'Existing direct conversation retrieved.',
                        'conversation' => $existing->load(['members.user:id,name,email']),
                    ]);
                }
            } else {
                // Group / project / task channels must include at least one other active colleague
                $otherMemberIds = array_filter(array_diff($validated['member_user_ids'] ?? [], [$user->id]));
                if (empty($otherMemberIds)) {
                    abort(422, 'Group conversation must include at least one other participant.');
                }
            }

            // Create conversation
            $conversation = Conversation::create([
                'company_id' => $company->id,
                'type' => $validated['type'],
                'title' => $validated['title'] ?? null,
                'project_id' => $validated['project_id'] ?? null,
                'task_id' => $validated['task_id'] ?? null,
                'client_organization_id' => $validated['client_organization_id'] ?? null,
                'created_by_user_id' => $user->id,
                'status' => 'active',
                'last_message_at' => Carbon::now('UTC'),
                'last_sequence_number' => 0,
            ]);

            // Add creator as member
            ConversationMember::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'role' => 'creator',
                'status' => 'active',
                'joined_at' => Carbon::now('UTC'),
            ]);

            // Add members
            $memberIds = [];
            if ($validated['type'] === 'direct') {
                $memberIds[] = (int)$validated['recipient_user_id'];
            } elseif (!empty($validated['member_user_ids'])) {
                $memberIds = array_diff($validated['member_user_ids'], [$user->id]);
            }

            foreach ($memberIds as $mId) {
                ConversationMember::firstOrCreate(
                    ['conversation_id' => $conversation->id, 'user_id' => $mId],
                    ['role' => 'member', 'status' => 'active', 'joined_at' => Carbon::now('UTC')]
                );
            }

            // Provision read cursor for creator
            ConversationReadCursor::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'last_read_sequence' => 0,
                'last_read_at' => Carbon::now('UTC'),
            ]);

            CollaborationAuditEvent::create([
                'company_id' => $company->id,
                'conversation_id' => $conversation->id,
                'actor_user_id' => $user->id,
                'action' => 'conversation_created',
                'details' => ['type' => $conversation->type, 'title' => $conversation->title],
            ]);

            return response()->json([
                'message' => 'Conversation initialized successfully.',
                'conversation' => $conversation->load(['members.user:id,name,email', 'createdBy:id,name']),
            ], 201);
        });
    }

    public function show(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->with([
                'createdBy:id,name,email',
                'project:id,name,project_code',
                'task:id,name,task_code',
                'clientOrganization:id,name,reference_code',
                'members.user:id,name,email',
            ])
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $cursor = ConversationReadCursor::firstOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $user->id],
            ['last_read_sequence' => 0, 'last_read_at' => Carbon::now('UTC')]
        );

        return response()->json([
            'conversation' => $conversation,
            'read_cursor' => $cursor,
        ]);
    }

    public function update(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $validated = $request->validate([
            'title' => 'nullable|string|max:180',
        ]);

        $conversation->update($validated);

        return response()->json([
            'message' => 'Conversation updated successfully.',
            'conversation' => $conversation->load(['members.user:id,name,email']),
        ]);
    }

    public function archive(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $conversation->update(['status' => 'archived']);

        CollaborationAuditEvent::create([
            'company_id' => $company->id,
            'conversation_id' => $conversation->id,
            'actor_user_id' => $user->id,
            'action' => 'conversation_archived',
        ]);

        return response()->json(['message' => 'Conversation archived successfully.']);
    }

    public function addMember(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'role' => 'nullable|in:member,moderator',
        ]);

        $member = ConversationMember::updateOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $validated['user_id']],
            ['status' => 'active', 'role' => $validated['role'] ?? 'member', 'joined_at' => Carbon::now('UTC')]
        );

        return response()->json([
            'message' => 'Member added to conversation.',
            'member' => $member->load('user:id,name,email'),
        ]);
    }

    public function removeMember(Request $request, Company $company, $conversationId, $userId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        ConversationMember::where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->update(['status' => 'removed', 'left_at' => Carbon::now('UTC')]);

        return response()->json(['message' => 'Member removed from conversation.']);
    }

    // =========================================================================
    // 2. MESSAGES & REALTIME ORDERING (FR-05, Alg 7.2, 7.3)
    // =========================================================================

    public function listMessages(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $limit = min((int)$request->input('limit', 50), 100);

        $messages = Message::where('conversation_id', $conversation->id)
            ->with([
                'sender:id,name,email',
                'replyTo:id,body,sender_id',
                'reactions.user:id,name',
                'mentions.user:id,name',
                'actionLinks.targetTask:id,task_code,name,status',
            ])
            ->orderBy('sequence_number', 'asc')
            ->paginate($limit);

        $peerReadSeq = ConversationReadCursor::where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $user->id)
            ->max('last_read_sequence') ?? 0;

        $responseArray = $messages->toArray();
        $responseArray['peer_read_sequence'] = (int)$peerReadSeq;

        return response()->json($responseArray);
    }

    public function sendMessage(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
            'message_type' => 'nullable|in:text,action,decision,announcement,system,call_log,meeting',
            'reply_to_message_id' => 'nullable|exists:messages,id',
            'idempotency_key' => 'nullable|string|max:120',
            'visibility_scope' => 'nullable|in:internal,client_visible,public',
            'mentioned_user_ids' => 'nullable|array',
            'mentioned_user_ids.*' => 'exists:users,id',
            'metadata' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($company, $conversation, $user, $validated) {
            // Idempotency check: if key matches existing message in conversation, return it
            if (!empty($validated['idempotency_key'])) {
                $existing = Message::where('conversation_id', $conversation->id)
                    ->where('idempotency_key', $validated['idempotency_key'])
                    ->first();

                if ($existing) {
                    return response()->json([
                        'message' => 'Idempotent message returned.',
                        'data' => $existing->load(['sender:id,name', 'reactions', 'mentions.user:id,name']),
                    ]);
                }
            }

            // Lock conversation for sequence number allocation
            $lockedConv = Conversation::where('id', $conversation->id)->lockForUpdate()->first();
            $nextSequence = $lockedConv->last_sequence_number + 1;

            $message = Message::create([
                'company_id' => $company->id,
                'conversation_id' => $conversation->id,
                'sender_id' => $user->id,
                'sequence_number' => $nextSequence,
                'message_type' => $validated['message_type'] ?? 'text',
                'body' => $validated['body'],
                'reply_to_message_id' => $validated['reply_to_message_id'] ?? null,
                'idempotency_key' => $validated['idempotency_key'] ?? null,
                'visibility_scope' => $validated['visibility_scope'] ?? 'internal',
                'metadata' => $validated['metadata'] ?? null,
            ]);

            // Update conversation sequence and timestamp
            $lockedConv->update([
                'last_sequence_number' => $nextSequence,
                'last_message_at' => Carbon::now('UTC'),
            ]);

            // Advance sender's read cursor
            ConversationReadCursor::updateOrCreate(
                ['conversation_id' => $conversation->id, 'user_id' => $user->id],
                ['last_read_sequence' => $nextSequence, 'last_read_message_id' => $message->id, 'last_read_at' => Carbon::now('UTC')]
            );

            // Mentions handling
            if (!empty($validated['mentioned_user_ids'])) {
                foreach ($validated['mentioned_user_ids'] as $mId) {
                    if ((int)$mId !== $user->id) {
                        MessageMention::create([
                            'message_id' => $message->id,
                            'user_id' => $mId,
                            'mention_type' => 'user',
                        ]);

                        // Generate notification for mentioned user
                        Notification::create([
                            'company_id' => $company->id,
                            'user_id' => $mId,
                            'event_type' => 'message_mention',
                            'title' => "Mentioned by {$user->name}",
                            'summary' => Str::limit($message->body, 120),
                            'action_route' => "/app/{$company->slug}/collaboration?conv={$conversation->id}",
                            'source_resource_type' => 'conversation',
                            'source_resource_id' => $conversation->id,
                            'category' => 'collaboration',
                            'priority' => 'high',
                            'deduplication_key' => "mention_{$message->id}_{$mId}",
                        ]);
                    }
                }
            }

            // If direct conversation, notify recipient
            if ($conversation->type === 'direct') {
                $otherMember = ConversationMember::where('conversation_id', $conversation->id)
                    ->where('user_id', '!=', $user->id)
                    ->first();

                if ($otherMember) {
                    Notification::create([
                        'company_id' => $company->id,
                        'user_id' => $otherMember->user_id,
                        'event_type' => 'direct_message',
                        'title' => "New message from {$user->name}",
                        'summary' => Str::limit($message->body, 120),
                        'action_route' => "/app/{$company->slug}/collaboration?conv={$conversation->id}",
                        'source_resource_type' => 'conversation',
                        'source_resource_id' => $conversation->id,
                        'category' => 'collaboration',
                        'priority' => 'normal',
                        'deduplication_key' => "dm_{$conversation->id}_{$message->id}",
                    ]);
                }
            }

            return response()->json([
                'message' => 'Message sent successfully.',
                'data' => $message->load(['sender:id,name,email', 'replyTo:id,body', 'reactions', 'mentions.user:id,name']),
            ], 201);
        });
    }

    public function editMessage(Request $request, Company $company, $conversationId, $messageId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $message = Message::where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->firstOrFail();

        if ($message->sender_id !== $user->id) {
            abort(403, 'You are not authorized to edit this message.');
        }

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
        ]);

        $message->update([
            'body' => $validated['body'],
            'is_edited' => true,
            'edited_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => 'Message updated successfully.',
            'data' => $message->load('sender:id,name'),
        ]);
    }

    public function deleteMessage(Request $request, Company $company, $conversationId, $messageId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $message = Message::where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->firstOrFail();

        if ($message->sender_id !== $user->id) {
            // Check if moderator
            $member = ConversationMember::where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->first();

            if (!$member || !in_array($member->role, ['creator', 'moderator'])) {
                abort(403, 'You are not authorized to delete this message.');
            }
        }

        $message->delete();

        return response()->json(['message' => 'Message deleted successfully.']);
    }

    public function bulkDeleteMessages(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $validated = $request->validate([
            'message_ids' => 'required|array',
            'message_ids.*' => 'integer',
        ]);

        $member = ConversationMember::where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->first();
        $isModOrCreator = $member && in_array($member->role, ['creator', 'moderator']);

        $query = Message::where('conversation_id', $conversationId)
            ->whereIn('id', $validated['message_ids']);

        if (!$isModOrCreator) {
            $query->where('sender_id', $user->id);
        }

        $deletedCount = $query->delete();

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} messages.",
            'deleted_count' => $deletedCount,
            'message_ids' => $validated['message_ids'],
        ]);
    }

    public function addReaction(Request $request, Company $company, $conversationId, $messageId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $message = Message::where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->firstOrFail();

        $validated = $request->validate([
            'reaction' => 'required|string|max:50',
        ]);

        $existing = MessageReaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('reaction', $validated['reaction'])
            ->first();

        if ($existing) {
            $existing->delete();
            $action = 'removed';
        } else {
            MessageReaction::create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'reaction' => $validated['reaction'],
                'created_at' => Carbon::now('UTC'),
            ]);
            $action = 'added';
        }

        return response()->json([
            'message' => "Reaction {$action}.",
            'reactions' => MessageReaction::where('message_id', $message->id)->with('user:id,name')->get(),
        ]);
    }

    public function updateReadCursor(Request $request, Company $company, $conversationId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $conversation = Conversation::where('company_id', $company->id)
            ->where('id', $conversationId)
            ->firstOrFail();

        $this->verifyConversationAccess($conversation, $user);

        $validated = $request->validate([
            'sequence_number' => 'required|integer|min:0',
        ]);

        $cursor = ConversationReadCursor::firstOrNew([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
        ]);

        // Monotonically advance cursor
        if ($validated['sequence_number'] > $cursor->last_read_sequence) {
            $cursor->last_read_sequence = $validated['sequence_number'];
            $cursor->last_read_at = Carbon::now('UTC');
            $cursor->save();
        }

        return response()->json([
            'message' => 'Read state updated.',
            'last_read_sequence' => $cursor->last_read_sequence,
        ]);
    }

    // =========================================================================
    // 3. CONVERSATION-TO-ACTION & DECISION LEDGER (Feature 1, Feature 2)
    // =========================================================================

    public function convertToAction(Request $request, Company $company, $conversationId, $messageId): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $user = $request->user();

        $message = Message::where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->firstOrFail();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'assigned_employee_id' => 'nullable|exists:employment_records,id',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'due_date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($company, $membership, $message, $user, $validated) {
            $count = Task::where('company_id', $company->id)->count() + 1;
            $taskCode = 'TSK-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);

            // Create authoritative M05 task
            $task = Task::create([
                'company_id' => $company->id,
                'project_id' => $validated['project_id'],
                'creator_membership_id' => $membership->id,
                'task_code' => $taskCode,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? $message->body,
                'status' => 'todo',
                'priority' => $validated['priority'] ?? 'medium',
                'due_at' => $validated['due_date'] ?? null,
            ]);

            // Link message to task
            $actionLink = MessageActionLink::create([
                'company_id' => $company->id,
                'conversation_id' => $message->conversation_id,
                'message_id' => $message->id,
                'action_type' => 'task_created',
                'target_task_id' => $task->id,
                'target_project_id' => $validated['project_id'],
                'title' => $validated['title'],
                'status' => 'confirmed',
                'confirmed_by_user_id' => $user->id,
                'confirmed_at' => Carbon::now('UTC'),
            ]);

            return response()->json([
                'message' => "Message successfully converted to Task {$task->task_code}.",
                'task' => $task->load('project:id,name'),
                'action_link' => $actionLink,
            ], 201);
        });
    }

    public function recordDecision(Request $request, Company $company, $conversationId, $messageId): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $message = Message::where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->firstOrFail();

        $validated = $request->validate([
            'title' => 'required|string|max:200',
            'status' => 'required|in:proposed,confirmed,in_progress,completed,rejected',
            'responsible_user_id' => 'nullable|exists:users,id',
            'target_project_id' => 'nullable|exists:projects,id',
            'due_date' => 'nullable|date',
            'outcome_notes' => 'nullable|string',
        ]);

        $actionLink = MessageActionLink::create([
            'company_id' => $company->id,
            'conversation_id' => $message->conversation_id,
            'message_id' => $message->id,
            'action_type' => 'decision_recorded',
            'target_project_id' => $validated['target_project_id'] ?? null,
            'title' => $validated['title'],
            'status' => $validated['status'],
            'responsible_user_id' => $validated['responsible_user_id'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'outcome_notes' => $validated['outcome_notes'] ?? null,
            'confirmed_by_user_id' => $user->id,
            'confirmed_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => 'Decision logged to Decision & Commitment Ledger.',
            'action_link' => $actionLink->load(['responsibleUser:id,name', 'confirmedBy:id,name']),
        ], 201);
    }

    // =========================================================================
    // 4. PROJECT HANDOVER BRIEF (Feature 5)
    // =========================================================================

    public function generateHandoverBrief(Request $request, Company $company, $projectId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $project = Project::where('company_id', $company->id)
            ->where('id', $projectId)
            ->with(['milestones', 'deliverables'])
            ->firstOrFail();

        $activeTasks = Task::where('project_id', $projectId)->latest()->limit(10)->get();

        // 1. Confirmed Decisions
        $decisions = MessageActionLink::where('company_id', $company->id)
            ->where('target_project_id', $projectId)
            ->where('action_type', 'decision_recorded')
            ->with(['responsibleUser:id,name', 'confirmedBy:id,name', 'message:id,body,created_at'])
            ->get();

        // 2. Converted Action Tasks
        $actionTasks = MessageActionLink::where('company_id', $company->id)
            ->where('target_project_id', $projectId)
            ->where('action_type', 'task_created')
            ->with('targetTask:id,task_code,name,status')
            ->get();

        // 3. Project conversations
        $conversations = Conversation::where('company_id', $company->id)
            ->where('project_id', $projectId)
            ->withCount('messages')
            ->get();

        $brief = [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'project_code' => $project->project_code,
                'status' => $project->status,
                'progress_percent' => $project->progress_percent,
                'health_status' => $project->health_status,
            ],
            'executive_summary' => "Project {$project->name} ({$project->project_code}) is currently in '{$project->status}' status with {$project->progress_percent}% overall delivery completion.",
            'confirmed_decisions' => $decisions,
            'converted_actions_count' => $actionTasks->count(),
            'active_tasks' => $activeTasks,
            'milestones' => $project->milestones,
            'discussion_threads_count' => $conversations->count(),
            'generated_at' => Carbon::now('UTC')->toIso8601String(),
        ];

        return response()->json(['handover_brief' => $brief]);
    }

    // =========================================================================
    // 5. SEARCH & SCOPED CSV EXPORT (FR-11, FR-13)
    // =========================================================================

    public function search(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $query = $request->validate([
            'q' => 'required|string|min:2|max:100',
        ])['q'];

        $messages = Message::where('company_id', $company->id)
            ->where('body', 'like', "%{$query}%")
            ->whereHas('conversation.members', function ($q) use ($user) {
                $q->where('user_id', $user->id)->where('status', 'active');
            })
            ->with(['sender:id,name', 'conversation:id,type,title'])
            ->latest()
            ->limit(30)
            ->get();

        return response()->json(['results' => $messages]);
    }

    public function export(Request $request, Company $company): StreamedResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $messages = Message::where('company_id', $company->id)
            ->whereHas('conversation.members', function ($q) use ($user) {
                $q->where('user_id', $user->id)->where('status', 'active');
            })
            ->with(['conversation:id,type,title', 'sender:id,name,email'])
            ->latest()
            ->limit(1000)
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"collaboration-export-{$company->slug}-" . date('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($messages) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Message ID', 'Conversation ID', 'Conversation Type', 'Sender Name', 'Sender Email', 'Sequence', 'Body', 'Date']);

            foreach ($messages as $m) {
                fputcsv($handle, [
                    $m->id,
                    $m->conversation_id,
                    $m->conversation?->type,
                    $m->sender?->name,
                    $m->sender?->email,
                    $m->sequence_number,
                    $m->body,
                    $m->created_at->toIso8601String(),
                ]);
            }
            fclose($handle);
        }, 200, $headers);
    }

    // =========================================================================
    // REAL-TIME PRESENCE & HEARTBEAT TRACKING
    // =========================================================================

    public function pingPresence(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $validated = $request->validate([
            'status' => 'nullable|string|in:online,away,offline',
        ]);

        $status = $validated['status'] ?? 'online';
        $now = Carbon::now();

        $payload = [
            'user_id' => $user->id,
            'status' => $status,
            'last_active_at' => $now->toIso8601String(),
            'last_active_timestamp' => $now->timestamp,
        ];

        Cache::put("user_presence_{$company->id}_{$user->id}", $payload, now()->addDay());
        Cache::put("user_presence_{$user->id}", $payload, now()->addDay());

        return response()->json([
            'user_id' => $user->id,
            'status' => $status,
            'is_online' => $status === 'online',
            'last_active_at' => $payload['last_active_at'],
        ]);
    }

    public function getPresence(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $memberships = CompanyMembership::where('company_id', $company->id)
            ->where('status', 'active')
            ->get(['id', 'user_id']);

        $now = Carbon::now()->timestamp;
        $presenceMap = [];

        foreach ($memberships as $m) {
            $presenceMap[$m->user_id] = $this->resolveUserPresence($company->id, $m->user_id, $now);
        }

        return response()->json([
            'presence' => $presenceMap,
        ]);
    }

    public function handleCallSignal(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();

        $validated = $request->validate([
            'action' => 'required|in:initiate,answer,decline,end',
            'signal' => 'nullable|array',
            'call_id' => 'nullable|string',
        ]);

        $action = $validated['action'];
        $signal = $validated['signal'] ?? [];
        $callId = $validated['call_id'] ?? ($signal['callId'] ?? null);

        if ($action === 'initiate') {
            $receiverUserId = $signal['receiverUserId'] ?? null;
            if ($receiverUserId && (int)$receiverUserId === (int)$user->id) {
                abort(422, 'Cannot initiate call to yourself.');
            }

            if ($receiverUserId && $callId) {
                // Store pending incoming call for receiver (valid for 40 seconds)
                Cache::put("pending_call_{$company->id}_{$receiverUserId}", $signal, 40);
                Cache::put("call_state_{$callId}", [
                    'status' => 'ringing',
                    'callId' => $callId,
                    'callerId' => $user->id,
                    'receiverUserId' => $receiverUserId,
                    'updated_at' => Carbon::now()->timestamp,
                ], 40);
            }
        } elseif ($action === 'answer') {
            if ($callId) {
                Cache::put("call_state_{$callId}", [
                    'status' => 'answered',
                    'callId' => $callId,
                    'answeredBy' => $user->id,
                    'updated_at' => Carbon::now()->timestamp,
                ], 3600);
            }
            Cache::forget("pending_call_{$company->id}_{$user->id}");
        } elseif ($action === 'decline') {
            if ($callId) {
                Cache::put("call_state_{$callId}", [
                    'status' => 'declined',
                    'callId' => $callId,
                    'declinedBy' => $user->id,
                    'updated_at' => Carbon::now()->timestamp,
                ], 60);
            }
            Cache::forget("pending_call_{$company->id}_{$user->id}");
        } elseif ($action === 'end') {
            if ($callId) {
                Cache::put("call_state_{$callId}", [
                    'status' => 'ended',
                    'callId' => $callId,
                    'endedBy' => $user->id,
                    'updated_at' => Carbon::now()->timestamp,
                ], 60);
            }
            Cache::forget("pending_call_{$company->id}_{$user->id}");
        }

        return response()->json([
            'success' => true,
            'action' => $action,
            'call_id' => $callId,
        ]);
    }

    public function getActiveCallSignal(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);
        $user = $request->user();
        $callId = $request->query('call_id');

        $pendingCall = Cache::get("pending_call_{$company->id}_{$user->id}");
        $callState = $callId ? Cache::get("call_state_{$callId}") : null;

        return response()->json([
            'incoming_call' => $pendingCall,
            'call_state' => $callState,
        ]);
    }
}


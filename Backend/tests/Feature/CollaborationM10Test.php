<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\ConversationReadCursor;
use App\Models\Message;
use App\Models\MessageActionLink;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollaborationM10Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanySetup(): array
    {
        $uid = uniqid();
        $owner = User::factory()->create(['name' => 'Alice Admin', 'email' => "alice.{$uid}@finovo.com"]);
        $engineer = User::factory()->create(['name' => 'Bob Engineer', 'email' => "bob.{$uid}@finovo.com"]);
        $pm = User::factory()->create(['name' => 'Charlie PM', 'email' => "charlie.{$uid}@finovo.com"]);

        $company = Company::create([
            'name' => 'Finovo Global Tech Hub',
            'slug' => 'finovo-tech-' . uniqid(),
            'status' => 'active',
            'timezone' => 'UTC',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();
        $pmRole = Role::where('slug', 'project-manager')->first();

        $ownerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerMembership->roles()->sync([$ownerRole->id]);

        $engineerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $engineer->id,
            'status' => 'active',
        ]);
        $engineerMembership->roles()->sync([$ownerRole->id]); // Using full permissions for test simplicity

        $pmMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $pm->id,
            'status' => 'active',
        ]);
        $pmMembership->roles()->sync([$pmRole->id]);

        $project = Project::create([
            'company_id' => $company->id,
            'name' => 'Core Platform Modernization',
            'project_code' => 'PRJ-M10',
            'status' => 'active',
            'health_status' => 'good',
            'progress_percent' => 45,
            'created_by' => $owner->id,
        ]);

        return [
            'company' => $company,
            'owner' => $owner,
            'engineer' => $engineer,
            'pm' => $pm,
            'project' => $project,
        ];
    }

    /** @test */
    public function direct_conversation_lifecycle_and_reuse()
    {
        $setup = $this->createCompanySetup();

        // 1. Create direct conversation between Alice and Bob
        $res = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations", [
                'type' => 'direct',
                'recipient_user_id' => $setup['engineer']->id,
            ]);

        $res->assertStatus(201);
        $convId = $res->json('conversation.id');
        $this->assertDatabaseHas('conversations', [
            'id' => $convId,
            'type' => 'direct',
            'company_id' => $setup['company']->id,
        ]);
        $this->assertDatabaseHas('conversation_members', [
            'conversation_id' => $convId,
            'user_id' => $setup['owner']->id,
        ]);
        $this->assertDatabaseHas('conversation_members', [
            'conversation_id' => $convId,
            'user_id' => $setup['engineer']->id,
        ]);

        // 2. Re-attempting to create the same direct conversation reuses existing
        $reuseRes = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations", [
                'type' => 'direct',
                'recipient_user_id' => $setup['engineer']->id,
            ]);

        $reuseRes->assertStatus(200);
        $this->assertEquals($convId, $reuseRes->json('conversation.id'));
    }

    /** @test */
    public function message_sequence_ordering_and_idempotency()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'group',
            'title' => 'Sprint Architecture Coordination',
            'created_by_user_id' => $setup['owner']->id,
            'last_sequence_number' => 0,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'role' => 'creator', 'status' => 'active']);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['engineer']->id, 'role' => 'member', 'status' => 'active']);

        // 1. Send first message
        $msg1 = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages", [
                'body' => 'Let us align on API payload schema for M10.',
                'idempotency_key' => 'key-msg-001',
            ]);

        $msg1->assertStatus(201);
        $this->assertEquals(1, $msg1->json('data.sequence_number'));

        // 2. Resending with same idempotency key returns original message without duplicating
        $msg1Retry = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages", [
                'body' => 'Let us align on API payload schema for M10.',
                'idempotency_key' => 'key-msg-001',
            ]);

        $msg1Retry->assertStatus(200);
        $this->assertEquals(1, Message::where('conversation_id', $conv->id)->count());

        // 3. Send second message from Bob
        $msg2 = $this->actingAs($setup['engineer'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages", [
                'body' => 'Agreed. I will draft the sequence diagram.',
            ]);

        $msg2->assertStatus(201);
        $this->assertEquals(2, $msg2->json('data.sequence_number'));

        // 4. Verify conversation last sequence was updated
        $this->assertEquals(2, $conv->fresh()->last_sequence_number);
    }

    /** @test */
    public function message_edits_deletions_reactions_and_read_cursors()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'group',
            'created_by_user_id' => $setup['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'status' => 'active']);

        $message = Message::create([
            'company_id' => $setup['company']->id,
            'conversation_id' => $conv->id,
            'sender_id' => $setup['owner']->id,
            'sequence_number' => 1,
            'body' => 'Initial text with typo',
        ]);

        // 1. Edit message
        $editRes = $this->actingAs($setup['owner'])
            ->patchJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages/{$message->id}", [
                'body' => 'Corrected text after review',
            ]);
        $editRes->assertStatus(200);
        $this->assertTrue($message->fresh()->is_edited);
        $this->assertEquals('Corrected text after review', $message->fresh()->body);

        // 2. Add reaction
        $reactRes = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages/{$message->id}/reactions", [
                'reaction' => '👍',
            ]);
        $reactRes->assertStatus(200);
        $this->assertDatabaseHas('message_reactions', [
            'message_id' => $message->id,
            'user_id' => $setup['owner']->id,
            'reaction' => '👍',
        ]);

        // 3. Update read cursor
        $cursorRes = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/read-cursor", [
                'sequence_number' => 1,
            ]);
        $cursorRes->assertStatus(200);
        $this->assertEquals(1, $cursorRes->json('last_read_sequence'));

        // 4. Delete message
        $delRes = $this->actingAs($setup['owner'])
            ->deleteJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages/{$message->id}");
        $delRes->assertStatus(200);
        $this->assertSoftDeleted('messages', ['id' => $message->id]);
    }

    /** @test */
    public function mentions_trigger_notifications_for_eligible_users()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'group',
            'created_by_user_id' => $setup['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'status' => 'active']);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['engineer']->id, 'status' => 'active']);

        // Alice sends message mentioning Bob
        $res = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages", [
                'body' => 'Hey Bob, can you review the database migration PR?',
                'mentioned_user_ids' => [$setup['engineer']->id],
            ]);

        $res->assertStatus(201);
        $msgId = $res->json('data.id');

        $this->assertDatabaseHas('message_mentions', [
            'message_id' => $msgId,
            'user_id' => $setup['engineer']->id,
        ]);

        $this->assertDatabaseHas('notifications', [
            'company_id' => $setup['company']->id,
            'user_id' => $setup['engineer']->id,
            'event_type' => 'message_mention',
            'category' => 'collaboration',
        ]);
    }

    /** @test */
    public function conversation_to_action_engine_creates_m05_task()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'project',
            'project_id' => $setup['project']->id,
            'created_by_user_id' => $setup['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'status' => 'active']);

        $message = Message::create([
            'company_id' => $setup['company']->id,
            'conversation_id' => $conv->id,
            'sender_id' => $setup['owner']->id,
            'sequence_number' => 1,
            'body' => 'Please build the Redis cache fallback mechanism before release.',
        ]);

        // Convert message to task
        $res = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages/{$message->id}/actions", [
                'project_id' => $setup['project']->id,
                'title' => 'Implement Redis cache fallback',
                'description' => 'Discovered in architecture discussion.',
                'priority' => 'high',
                'due_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
            ]);

        $res->assertStatus(201);
        $taskId = $res->json('task.id');

        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'title' => 'Implement Redis cache fallback',
            'company_id' => $setup['company']->id,
            'project_id' => $setup['project']->id,
        ]);

        $this->assertDatabaseHas('message_action_links', [
            'message_id' => $message->id,
            'target_task_id' => $taskId,
            'action_type' => 'task_created',
            'status' => 'confirmed',
        ]);
    }

    /** @test */
    public function decision_and_commitment_ledger_logging()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'project',
            'project_id' => $setup['project']->id,
            'created_by_user_id' => $setup['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'status' => 'active']);

        $message = Message::create([
            'company_id' => $setup['company']->id,
            'conversation_id' => $conv->id,
            'sender_id' => $setup['owner']->id,
            'sequence_number' => 1,
            'body' => 'Decision: We will adopt JWT access tokens with 15-minute rotation for API security.',
        ]);

        $res = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations/{$conv->id}/messages/{$message->id}/decisions", [
                'title' => 'JWT 15-minute token rotation policy',
                'status' => 'confirmed',
                'responsible_user_id' => $setup['engineer']->id,
                'target_project_id' => $setup['project']->id,
                'outcome_notes' => 'Approved by engineering leadership in M10 review.',
            ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('message_action_links', [
            'message_id' => $message->id,
            'action_type' => 'decision_recorded',
            'title' => 'JWT 15-minute token rotation policy',
            'status' => 'confirmed',
        ]);
    }

    /** @test */
    public function project_handover_brief_generation()
    {
        $setup = $this->createCompanySetup();

        $conv = Conversation::create([
            'company_id' => $setup['company']->id,
            'type' => 'project',
            'project_id' => $setup['project']->id,
            'created_by_user_id' => $setup['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $conv->id, 'user_id' => $setup['owner']->id, 'status' => 'active']);

        $msg = Message::create([
            'company_id' => $setup['company']->id,
            'conversation_id' => $conv->id,
            'sender_id' => $setup['owner']->id,
            'sequence_number' => 1,
            'body' => 'Confirmed database engine migration to InnoDB.',
        ]);

        MessageActionLink::create([
            'company_id' => $setup['company']->id,
            'conversation_id' => $conv->id,
            'message_id' => $msg->id,
            'action_type' => 'decision_recorded',
            'target_project_id' => $setup['project']->id,
            'title' => 'MySQL InnoDB Migration Approval',
            'status' => 'confirmed',
            'confirmed_by_user_id' => $setup['owner']->id,
            'confirmed_at' => Carbon::now('UTC'),
        ]);

        $res = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/collaboration/projects/{$setup['project']->id}/handover-brief");

        $res->assertStatus(200);
        $res->assertJsonStructure([
            'handover_brief' => [
                'project',
                'executive_summary',
                'confirmed_decisions',
                'active_tasks',
                'milestones',
                'generated_at',
            ],
        ]);
        $this->assertCount(1, $res->json('handover_brief.confirmed_decisions'));
    }

    /** @test */
    public function announcements_publishing_and_acknowledgment()
    {
        $setup = $this->createCompanySetup();

        // 1. Create and publish announcement
        $res = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/announcements", [
                'title' => 'All-Hands Architecture Townhall',
                'content' => 'Mandatory briefing for all engineering squads at 3:00 PM UTC.',
                'audience_type' => 'company',
                'requires_acknowledgment' => true,
                'publish_now' => true,
            ]);

        $res->assertStatus(201);
        $announcementId = $res->json('announcement.id');

        $this->assertDatabaseHas('announcements', [
            'id' => $announcementId,
            'status' => 'published',
            'requires_acknowledgment' => true,
        ]);

        // Notifications fanned out to other users
        $this->assertDatabaseHas('notifications', [
            'company_id' => $setup['company']->id,
            'user_id' => $setup['engineer']->id,
            'event_type' => 'announcement',
        ]);

        // 2. Bob acknowledges announcement
        $ackRes = $this->actingAs($setup['engineer'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/announcements/{$announcementId}/acknowledge");

        $ackRes->assertStatus(200);
        $this->assertDatabaseHas('announcement_acknowledgments', [
            'announcement_id' => $announcementId,
            'user_id' => $setup['engineer']->id,
        ]);
    }

    /** @test */
    public function notification_preferences_and_quiet_hours()
    {
        $setup = $this->createCompanySetup();

        $res = $this->actingAs($setup['engineer'])
            ->patchJson("/api/v1/companies/{$setup['company']->id}/notifications/preferences", [
                'quiet_hours_enabled' => true,
                'quiet_hours_start' => '23:00:00',
                'quiet_hours_end' => '07:00:00',
                'focus_mode' => true,
                'timezone' => 'America/New_York',
            ]);

        $res->assertStatus(200);
        $this->assertDatabaseHas('notification_preferences', [
            'company_id' => $setup['company']->id,
            'user_id' => $setup['engineer']->id,
            'quiet_hours_enabled' => true,
            'focus_mode' => true,
            'timezone' => 'America/New_York',
        ]);
    }

    /** @test */
    public function cross_tenant_and_unauthorized_conversation_isolation()
    {
        $setupA = $this->createCompanySetup();
        $setupB = $this->createCompanySetup();

        $convA = Conversation::create([
            'company_id' => $setupA['company']->id,
            'type' => 'group',
            'title' => 'Secret Company A Discussions',
            'created_by_user_id' => $setupA['owner']->id,
        ]);
        ConversationMember::create(['conversation_id' => $convA->id, 'user_id' => $setupA['owner']->id, 'status' => 'active']);

        // User from Company B attempts to access Company A conversation
        $deniedRes = $this->actingAs($setupB['owner'])
            ->getJson("/api/v1/companies/{$setupA['company']->id}/collaboration/conversations/{$convA->id}");

        $deniedRes->assertStatus(403); // Fails company tenant authorization

        // Member of Company A who is NOT a member of conversation A
        $nonMemberRes = $this->actingAs($setupA['engineer'])
            ->getJson("/api/v1/companies/{$setupA['company']->id}/collaboration/conversations/{$convA->id}");

        $nonMemberRes->assertStatus(404); // Fails conversation membership verification
    }

    /** @test */
    public function real_time_presence_and_heartbeat_tracking()
    {
        $setup = $this->createCompanySetup();

        // 1. Initial state: Bob is offline
        $getRes = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/collaboration/presence");
        $getRes->assertStatus(200);
        $this->assertEquals('offline', $getRes->json("presence.{$setup['engineer']->id}.status"));

        // 2. Bob pings heartbeat with 'online'
        $pingRes = $this->actingAs($setup['engineer'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/presence/ping", [
                'status' => 'online',
            ]);
        $pingRes->assertStatus(200);
        $this->assertEquals('online', $pingRes->json('status'));
        $this->assertTrue($pingRes->json('is_online'));

        // 3. Now presence endpoint reports Bob is 'online'
        $getRes2 = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/collaboration/presence");
        $getRes2->assertStatus(200);
        $this->assertEquals('online', $getRes2->json("presence.{$setup['engineer']->id}.status"));
        $this->assertTrue($getRes2->json("presence.{$setup['engineer']->id}.is_online"));

        // 4. Create direct conversation between Alice and Bob: direct conversation status reflects Bob's online status
        $convRes = $this->actingAs($setup['owner'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations", [
                'type' => 'direct',
                'recipient_user_id' => $setup['engineer']->id,
            ]);
        $convRes->assertStatus(201);

        $listRes = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations");
        $listRes->assertStatus(200);
        $conv = collect($listRes->json('conversations'))->firstWhere('type', 'direct');
        $this->assertEquals('online', $conv['status']);

        // 5. Bob goes away or signs off
        $offlinePing = $this->actingAs($setup['engineer'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/collaboration/presence/ping", [
                'status' => 'offline',
            ]);
        $offlinePing->assertStatus(200);

        $listRes2 = $this->actingAs($setup['owner'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/collaboration/conversations");
        $conv2 = collect($listRes2->json('conversations'))->firstWhere('type', 'direct');
        $this->assertEquals('offline', $conv2['status']);
    }
}

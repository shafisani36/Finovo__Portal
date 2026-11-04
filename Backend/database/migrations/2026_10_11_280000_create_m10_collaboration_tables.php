<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Conversations
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('type', ['direct', 'group', 'project', 'task', 'client'])->default('direct');
            $table->string('title')->nullable();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('client_organization_id')->nullable()->constrained('client_organizations')->nullOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['active', 'archived'])->default('active');
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('last_sequence_number')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'type', 'status']);
            $table->index(['company_id', 'last_message_at']);
        });

        // 2. Conversation Members
        Schema::create('conversation_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['creator', 'moderator', 'member'])->default('member');
            $table->enum('status', ['active', 'muted', 'left', 'removed'])->default('active');
            $table->timestamp('muted_until')->nullable();
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        // 3. Conversation Read Cursors
        Schema::create('conversation_read_cursors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('last_read_sequence')->default(0);
            $table->unsignedBigInteger('last_read_message_id')->nullable();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });

        // 4. Messages
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->enum('message_type', ['text', 'action', 'decision', 'announcement', 'system'])->default('text');
            $table->text('body');
            $table->foreignId('reply_to_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->string('idempotency_key', 120)->nullable();
            $table->boolean('is_edited')->default(false);
            $table->timestamp('edited_at')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->enum('visibility_scope', ['internal', 'client_visible', 'public'])->default('internal');
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['conversation_id', 'sequence_number']);
            $table->index(['conversation_id', 'created_at']);
            $table->index(['company_id', 'sender_id']);
            $table->index(['conversation_id', 'idempotency_key']);
        });

        // 5. Message Reactions
        Schema::create('message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reaction', 50);
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['message_id', 'user_id', 'reaction']);
        });

        // 6. Message Mentions
        Schema::create('message_mentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('mention_type', ['user', 'all', 'here'])->default('user');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
        });

        // 7. Message Action Links (Conversation-to-Action Engine & Decision Ledger)
        Schema::create('message_action_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();
            $table->enum('action_type', ['task_created', 'decision_recorded', 'commitment'])->default('task_created');
            $table->foreignId('target_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('target_project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('title');
            $table->enum('status', ['proposed', 'confirmed', 'in_progress', 'completed', 'rejected'])->default('proposed');
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->text('outcome_notes')->nullable();
            $table->foreignId('confirmed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'action_type', 'status']);
        });

        // 8. Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('event_type', 80);
            $table->string('title');
            $table->text('summary');
            $table->string('action_route')->nullable();
            $table->string('source_resource_type', 80)->nullable();
            $table->unsignedBigInteger('source_resource_id')->nullable();
            $table->enum('category', ['collaboration', 'tasks', 'approvals', 'announcements', 'system'])->default('collaboration');
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->string('deduplication_key', 120)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read', 'created_at']);
            $table->index(['company_id', 'deduplication_key']);
        });

        // 9. Notification Preferences
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->boolean('in_app_enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('quiet_hours_enabled')->default(false);
            $table->time('quiet_hours_start')->default('22:00:00');
            $table->time('quiet_hours_end')->default('08:00:00');
            $table->string('timezone')->default('UTC');
            $table->boolean('focus_mode')->default(false);
            $table->json('category_settings')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'company_id']);
        });

        // 10. Announcements
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('creator_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('content');
            $table->enum('audience_type', ['company', 'department', 'project', 'client'])->default('company');
            $table->unsignedBigInteger('audience_target_id')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->boolean('requires_acknowledgment')->default(false);
            $table->boolean('is_pinned')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status', 'published_at']);
        });

        // 11. Announcement Acknowledgments
        Schema::create('announcement_acknowledgments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->constrained('announcements')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('acknowledged_at')->useCurrent();

            $table->unique(['announcement_id', 'user_id']);
        });

        // 12. Collaboration Audit Events
        Schema::create('collaboration_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->foreignId('actor_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('action', 80);
            $table->json('details')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'action', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collaboration_audit_events');
        Schema::dropIfExists('announcement_acknowledgments');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('message_action_links');
        Schema::dropIfExists('message_mentions');
        Schema::dropIfExists('message_reactions');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_read_cursors');
        Schema::dropIfExists('conversation_members');
        Schema::dropIfExists('conversations');
    }
};

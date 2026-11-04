<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Core Tasks Table
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained('project_milestones')->nullOnDelete();
            $table->foreignId('parent_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('task_code', 50);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('task_type')->default('feature'); // feature, bug, chore, spike, documentation
            $table->string('status')->default('open'); // open, ready, in_progress, blocked, in_review, completed, accepted, cancelled
            $table->string('priority')->default('medium'); // low, medium, high, urgent
            $table->string('visibility')->default('internal'); // internal, confidential, highly_restricted, client_visible
            $table->foreignId('creator_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('assignee_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamp('start_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('estimated_minutes')->nullable()->default(0);
            $table->integer('actual_minutes')->default(0);
            $table->decimal('progress_percent', 5, 2)->default(0.00);
            $table->decimal('weight', 5, 2)->default(1.00);
            $table->text('blocker_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('reopen_reason')->nullable();
            $table->integer('version')->default(1);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'task_code'], 'tasks_company_task_code_unique');
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'project_id', 'status']);
            $table->index(['company_id', 'assignee_membership_id', 'status']);
            $table->index(['company_id', 'due_at']);
        });

        // 2. Task Assignments History
        Schema::create('task_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('assigned_by_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('unassigned_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'task_id']);
            $table->index(['company_id', 'membership_id']);
        });

        // 3. Task Watchers
        Schema::create('task_watchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['task_id', 'membership_id'], 'task_watchers_unique');
        });

        // 4. Task Checklists
        Schema::create('task_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->string('title')->default('Acceptance Checklist');
            $table->boolean('is_mandatory')->default(true);
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'task_id']);
        });

        // 5. Task Checklist Items
        Schema::create('task_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_checklist_id')->constrained('task_checklists')->cascadeOnDelete();
            $table->string('item_text');
            $table->boolean('is_completed')->default(false);
            $table->foreignId('completed_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->index(['task_checklist_id', 'is_completed']);
        });

        // 6. Task Dependencies (DAG)
        Schema::create('task_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete(); // Dependent (Successor)
            $table->foreignId('prerequisite_task_id')->constrained('tasks')->cascadeOnDelete(); // Prerequisite (Predecessor)
            $table->string('dependency_type')->default('finish_to_start');
            $table->timestamps();

            $table->unique(['task_id', 'prerequisite_task_id'], 'task_dependency_unique');
            $table->index(['company_id', 'task_id']);
            $table->index(['company_id', 'prerequisite_task_id']);
        });

        // 7. Task Status History
        Schema::create('task_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->string('from_status');
            $table->string('to_status');
            $table->text('reason')->nullable();
            $table->foreignId('changed_by_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'task_id']);
        });

        // 8. Task Comments
        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('author_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('parent_comment_id')->nullable()->constrained('task_comments')->nullOnDelete();
            $table->text('content');
            $table->string('visibility')->default('internal'); // internal, client_visible
            $table->boolean('is_pinned')->default(false);
            $table->timestamp('edited_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'task_id']);
        });

        // 9. Task Attachments & Evidence
        Schema::create('task_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('uploaded_by_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type')->nullable();
            $table->boolean('is_evidence')->default(false);
            $table->string('visibility')->default('internal'); // internal, client_visible
            $table->timestamps();

            $table->index(['company_id', 'task_id']);
        });

        // 10. Task Templates
        Schema::create('task_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('task_type')->default('feature');
            $table->string('priority')->default('medium');
            $table->integer('default_estimated_minutes')->default(120);
            $table->json('checklist_preset')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'name']);
        });

        // 11. Task Approvals & Delivery Gates
        Schema::create('task_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('requested_by_membership_id')->constrained('company_memberships')->cascadeOnDelete();
            $table->foreignId('reviewed_by_membership_id')->nullable()->constrained('company_memberships')->nullOnDelete();
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->text('evidence_notes')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'task_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_approvals');
        Schema::dropIfExists('task_templates');
        Schema::dropIfExists('task_attachments');
        Schema::dropIfExists('task_comments');
        Schema::dropIfExists('task_status_history');
        Schema::dropIfExists('task_dependencies');
        Schema::dropIfExists('task_checklist_items');
        Schema::dropIfExists('task_checklists');
        Schema::dropIfExists('task_watchers');
        Schema::dropIfExists('task_assignments');
        Schema::dropIfExists('tasks');
    }
};

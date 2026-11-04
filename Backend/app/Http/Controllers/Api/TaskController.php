<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\SecurityAuditEvent;
use App\Models\Task;
use App\Models\TaskApproval;
use App\Models\TaskAssignment;
use App\Models\TaskAttachment;
use App\Models\TaskChecklist;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\TaskDependency;
use App\Models\TaskStatusHistory;
use App\Models\TaskTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    /**
     * FR-01 & FR-10: Task Directory with Search, Filtering, and Pagination
     */
    public function index(Request $request, Company $company): JsonResponse
    {
        $query = Task::where('company_id', $company->id)
            ->with([
                'project:id,name,project_code',
                'milestone:id,name',
                'assignee.user:id,name,email,avatar_url',
                'creator.user:id,name,email',
            ])
            ->withCount(['subtasks', 'comments', 'checklists']);

        // Search by title, task code, or description
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('task_code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Project filter
        if ($projectId = $request->query('project_id')) {
            $query->where('project_id', $projectId);
        }

        // Milestone filter
        if ($milestoneId = $request->query('milestone_id')) {
            $query->where('milestone_id', $milestoneId);
        }

        // Status filter
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Priority filter
        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }

        // Task Type filter
        if ($taskType = $request->query('task_type')) {
            $query->where('task_type', $taskType);
        }

        // Assignee filter
        if ($assigneeId = $request->query('assignee_membership_id')) {
            $query->where('assignee_membership_id', $assigneeId);
        }

        // My Tasks filter
        if ($request->boolean('my_tasks')) {
            $membership = CompanyMembership::where('company_id', $company->id)
                ->where('user_id', $request->user()->id)
                ->first();
            if ($membership) {
                $query->where('assignee_membership_id', $membership->id);
            }
        }

        // Overdue filter (Algorithm F: due_at in the past and non-terminal state)
        if ($request->boolean('overdue')) {
            $query->whereNotNull('due_at')
                ->where('due_at', '<', now())
                ->whereNotIn('status', ['completed', 'accepted', 'cancelled']);
        }

        // Blocked filter
        if ($request->boolean('blocked')) {
            $query->where('status', 'blocked');
        }

        // Awaiting review filter
        if ($request->boolean('in_review')) {
            $query->where('status', 'in_review');
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortDirection = $request->query('sort_direction', 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sortBy, ['title', 'task_code', 'status', 'priority', 'due_at', 'created_at', 'progress_percent'])) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->latest();
        }

        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $tasks = $query->paginate($perPage);

        return response()->json([
            'tasks' => $tasks,
            'data' => $tasks->items(),
            'total' => $tasks->total(),
            'current_page' => $tasks->currentPage(),
            'last_page' => $tasks->lastPage(),
        ]);
    }

    /**
     * FR-01: Create Task atomically with code generation, checklist, and assignment
     */
    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => [
                'required',
                'integer',
                Rule::exists('projects', 'id')->where('company_id', $company->id),
            ],
            'milestone_id' => [
                'nullable',
                'integer',
                Rule::exists('project_milestones', 'id')->where('company_id', $company->id),
            ],
            'parent_task_id' => [
                'nullable',
                'integer',
                Rule::exists('tasks', 'id')->where('company_id', $company->id),
            ],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'task_type' => ['nullable', 'string', Rule::in(['feature', 'bug', 'chore', 'spike', 'documentation'])],
            'status' => ['nullable', 'string', Rule::in(['open', 'ready', 'in_progress', 'blocked'])],
            'priority' => ['nullable', 'string', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'visibility' => ['nullable', 'string', Rule::in(['internal', 'confidential', 'highly_restricted', 'client_visible'])],
            'assignee_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')
                    ->where('company_id', $company->id)
                    ->where('status', 'active'),
            ],
            'start_at' => ['nullable', 'date'],
            'due_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'estimated_minutes' => ['nullable', 'integer', 'min:0'],
            'weight' => ['nullable', 'numeric', 'min:0.1', 'max:100.0'],
            'checklist_items' => ['nullable', 'array'],
            'checklist_items.*' => ['string', 'max:255'],
        ]);

        $project = Project::findOrFail($validated['project_id']);
        if (in_array($project->status, ['completed', 'closed', 'archived'], true)) {
            return response()->json([
                'message' => "Cannot create tasks in project with status '{$project->status}'",
            ], 422);
        }

        $creatorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $task = DB::transaction(function () use ($validated, $company, $project, $creatorMembership, $request) {
            // Generate company-scoped unique task code: PRJ-T001
            $count = Task::where('company_id', $company->id)->lockForUpdate()->count() + 1;
            $code = $project->project_code . '-T' . str_pad((string) $count, 3, '0', STR_PAD_LEFT);

            $taskRecord = Task::create([
                'company_id' => $company->id,
                'project_id' => $project->id,
                'milestone_id' => $validated['milestone_id'] ?? null,
                'parent_task_id' => $validated['parent_task_id'] ?? null,
                'task_code' => $code,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'task_type' => $validated['task_type'] ?? 'feature',
                'status' => $validated['status'] ?? 'open',
                'priority' => $validated['priority'] ?? 'medium',
                'visibility' => $validated['visibility'] ?? 'internal',
                'creator_membership_id' => $creatorMembership->id,
                'assignee_membership_id' => $validated['assignee_membership_id'] ?? null,
                'start_at' => $validated['start_at'] ?? null,
                'due_at' => $validated['due_at'] ?? null,
                'estimated_minutes' => $validated['estimated_minutes'] ?? 0,
                'weight' => $validated['weight'] ?? 1.00,
                'version' => 1,
            ]);

            // Create initial assignment record if assignee assigned
            if (!empty($validated['assignee_membership_id'])) {
                TaskAssignment::create([
                    'company_id' => $company->id,
                    'task_id' => $taskRecord->id,
                    'membership_id' => $validated['assignee_membership_id'],
                    'assigned_by_membership_id' => $creatorMembership->id,
                    'assigned_at' => now(),
                    'notes' => 'Initial assignment at task creation',
                ]);
            }

            // Create default acceptance checklist
            $checklist = TaskChecklist::create([
                'company_id' => $company->id,
                'task_id' => $taskRecord->id,
                'title' => 'Acceptance Criteria & Gates',
                'is_mandatory' => true,
                'order' => 0,
            ]);

            if (!empty($validated['checklist_items'])) {
                foreach ($validated['checklist_items'] as $idx => $itemText) {
                    TaskChecklistItem::create([
                        'company_id' => $company->id,
                        'task_checklist_id' => $checklist->id,
                        'item_text' => $itemText,
                        'is_completed' => false,
                        'order' => $idx,
                    ]);
                }
            } else {
                // Default checklist gate
                TaskChecklistItem::create([
                    'company_id' => $company->id,
                    'task_checklist_id' => $checklist->id,
                    'item_text' => 'Implementation satisfies requirements and code reviewed',
                    'is_completed' => false,
                    'order' => 0,
                ]);
            }

            // Initial status history
            TaskStatusHistory::create([
                'company_id' => $company->id,
                'task_id' => $taskRecord->id,
                'from_status' => 'none',
                'to_status' => $taskRecord->status,
                'reason' => 'Task initialized',
                'changed_by_membership_id' => $creatorMembership->id,
                'created_at' => now(),
            ]);

            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'task.created',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'task_id' => $taskRecord->id,
                    'task_code' => $taskRecord->task_code,
                    'title' => $taskRecord->title,
                    'project_id' => $project->id,
                ]
            );

            return $taskRecord;
        });

        return response()->json([
            'message' => 'Task created successfully',
            'task' => $task->load([
                'project:id,name,project_code',
                'assignee.user:id,name,email',
                'checklists.items',
            ]),
        ], 201);
    }

    /**
     * Retrieve full task workspace telemetry
     */
    public function show(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $task->load([
            'project:id,name,project_code,status',
            'milestone:id,name,status',
            'parentTask:id,task_code,title',
            'subtasks.assignee.user:id,name',
            'creator.user:id,name,email',
            'assignee.user:id,name,email,avatar_url',
            'assignments.member.user:id,name',
            'assignments.assignedBy.user:id,name',
            'watchers.member.user:id,name',
            'checklists.items.completedBy.user:id,name',
            'dependencies.prerequisiteTask:id,task_code,title,status',
            'comments.author.user:id,name',
            'comments.replies.author.user:id,name',
            'attachments.uploader.user:id,name',
            'approvals.requestedBy.user:id,name',
            'approvals.reviewedBy.user:id,name',
            'statusHistory.changedBy.user:id,name',
        ]);

        return response()->json([
            'task' => $task,
        ]);
    }

    /**
     * Update permitted task fields with optimistic concurrency version check
     */
    public function update(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        // Optimistic concurrency control (NFR / Algorithm I)
        if ($request->has('version') && (int) $request->input('version') !== $task->version) {
            return response()->json([
                'message' => 'Task has been modified by another team member. Please refresh and review latest changes before saving.',
            ], 409);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', 'string', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'task_type' => ['nullable', 'string', Rule::in(['feature', 'bug', 'chore', 'spike', 'documentation'])],
            'visibility' => ['nullable', 'string', Rule::in(['internal', 'confidential', 'highly_restricted', 'client_visible'])],
            'start_at' => ['nullable', 'date'],
            'due_at' => ['nullable', 'date'],
            'estimated_minutes' => ['nullable', 'integer', 'min:0'],
            'actual_minutes' => ['nullable', 'integer', 'min:0'],
            'weight' => ['nullable', 'numeric', 'min:0.1', 'max:100.0'],
        ]);

        $validated['version'] = $task->version + 1;
        $task->update($validated);

        return response()->json([
            'message' => 'Task updated successfully',
            'task' => $task->fresh(['project:id,name', 'assignee.user:id,name']),
        ]);
    }

    /**
     * FR-02: Task Assignment and Reassignment with Audit History
     */
    public function assign(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $validated = $request->validate([
            'assignee_membership_id' => [
                'required',
                'integer',
                Rule::exists('company_memberships', 'id')
                    ->where('company_id', $company->id)
                    ->where('status', 'active'),
            ],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        DB::transaction(function () use ($task, $validated, $actorMembership, $company) {
            // Close active assignment if exists
            TaskAssignment::where('task_id', $task->id)
                ->whereNull('unassigned_at')
                ->update(['unassigned_at' => now()]);

            // Create new assignment record
            TaskAssignment::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'membership_id' => $validated['assignee_membership_id'],
                'assigned_by_membership_id' => $actorMembership->id,
                'assigned_at' => now(),
                'notes' => $validated['notes'] ?? 'Task reassigned',
            ]);

            $task->update([
                'assignee_membership_id' => $validated['assignee_membership_id'],
                'version' => $task->version + 1,
            ]);
        });

        return response()->json([
            'message' => 'Task assigned successfully',
            'task' => $task->fresh(['assignee.user:id,name,email']),
        ]);
    }

    /**
     * FR-03 & Algorithm C: Controlled Task Workflow State Transitions & Completion Gates
     */
    public function transitionStatus(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $targetStatus = $request->input('target_status', $request->input('status'));
        $reason = $request->input('reason') ?: 'Status transitioned by team member';

        $v = \Illuminate\Support\Facades\Validator::make([
            'target_status' => $targetStatus,
            'reason' => $reason,
        ], [
            'target_status' => [
                'required',
                'string',
                Rule::in(['open', 'ready', 'in_progress', 'blocked', 'in_review', 'completed', 'accepted', 'cancelled']),
            ],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($v->fails()) {
            return response()->json(['message' => $v->errors()->first()], 422);
        }

        $currentStatus = $task->status;

        if ($currentStatus === $targetStatus) {
            return response()->json(['message' => 'Task is already in this status'], 422);
        }

        // State Machine Allowed Map
        $allowed = [
            'open' => ['ready', 'in_progress', 'cancelled'],
            'ready' => ['in_progress', 'blocked', 'cancelled'],
            'in_progress' => ['blocked', 'in_review', 'completed', 'cancelled'],
            'blocked' => ['in_progress', 'ready', 'cancelled'],
            'in_review' => ['in_progress', 'completed', 'accepted', 'cancelled'],
            'completed' => ['in_progress', 'accepted', 'cancelled'], // Reopening supported
            'accepted' => ['in_progress'],
            'cancelled' => ['open', 'ready'],
        ];

        if (!in_array($targetStatus, $allowed[$currentStatus] ?? [], true)) {
            return response()->json([
                'message' => "Transition from {$currentStatus} to {$targetStatus} is prohibited by task workflow policy.",
            ], 422);
        }

        // Blocked requires blocker reason
        if ($targetStatus === 'blocked' && empty($request->input('reason'))) {
            return response()->json(['message' => 'A blocker reason is mandatory when marking a task as blocked.'], 422);
        }

        // Completion Gates: When transitioning to completed or accepted:
        if (in_array($targetStatus, ['completed', 'accepted'], true)) {
            // Check 1: Mandatory checklist items must be 100% completed
            $incompleteChecklistItems = TaskChecklistItem::whereHas('checklist', function ($q) use ($task) {
                $q->where('task_id', $task->id)->where('is_mandatory', true);
            })->where('is_completed', false)->count();

            if ($incompleteChecklistItems > 0) {
                return response()->json([
                    'message' => "Completion gate failed: {$incompleteChecklistItems} mandatory checklist item(s) are incomplete.",
                ], 422);
            }

            // Check 2: All prerequisite dependencies must be completed
            $incompletePrereqs = TaskDependency::where('task_id', $task->id)
                ->whereHas('prerequisiteTask', function ($q) {
                    $q->whereNotIn('status', ['completed', 'accepted']);
                })->count();

            if ($incompletePrereqs > 0) {
                return response()->json([
                    'message' => "Completion gate failed: {$incompletePrereqs} prerequisite dependency task(s) are not yet finished.",
                ], 422);
            }
        }

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        DB::transaction(function () use ($task, $currentStatus, $targetStatus, $reason, $actorMembership, $company) {
            $task->update([
                'status' => $targetStatus,
                'blocker_reason' => $targetStatus === 'blocked' ? $reason : ($currentStatus === 'blocked' ? null : $task->blocker_reason),
                'cancellation_reason' => $targetStatus === 'cancelled' ? $reason : $task->cancellation_reason,
                'reopen_reason' => in_array($currentStatus, ['completed', 'accepted']) && $targetStatus === 'in_progress' ? $reason : $task->reopen_reason,
                'completed_at' => in_array($targetStatus, ['completed', 'accepted']) ? now() : ($targetStatus === 'in_progress' ? null : $task->completed_at),
                'version' => $task->version + 1,
            ]);

            TaskStatusHistory::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'from_status' => $currentStatus,
                'to_status' => $targetStatus,
                'reason' => $reason,
                'changed_by_membership_id' => $actorMembership->id,
                'created_at' => now(),
            ]);

            // If task is child of parent task, recalculate parent progress (Algorithm E)
            if ($task->parent_task_id) {
                $task->parentTask?->calculateProgress();
            }
        });

        return response()->json([
            'message' => "Task status transitioned to {$targetStatus}",
            'task' => $task->fresh(),
        ]);
    }

    /**
     * Submit task for review (FR-03 & Completion Gate)
     */
    public function submitReview(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        // Validate checklist gate
        $incomplete = TaskChecklistItem::whereHas('checklist', function ($q) use ($task) {
            $q->where('task_id', $task->id)->where('is_mandatory', true);
        })->where('is_completed', false)->count();

        if ($incomplete > 0) {
            return response()->json([
                'message' => "Cannot submit for review: {$incomplete} mandatory checklist item(s) remain uncompleted.",
            ], 422);
        }

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $approval = DB::transaction(function () use ($task, $actorMembership, $request, $company) {
            $task->update([
                'status' => 'in_review',
                'version' => $task->version + 1,
            ]);

            return TaskApproval::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'requested_by_membership_id' => $actorMembership->id,
                'status' => 'pending',
                'evidence_notes' => $request->input('evidence_notes', 'Task submitted with acceptance checklist completed'),
                'submitted_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Task submitted for review successfully',
            'approval' => $approval,
            'task' => $task->fresh(),
        ]);
    }

    /**
     * Reviewer Approve (Algorithm I)
     */
    public function approve(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $latestApproval = TaskApproval::where('task_id', $task->id)
            ->where('status', 'pending')
            ->latest('submitted_at')
            ->first();

        DB::transaction(function () use ($task, $latestApproval, $actorMembership, $request, $company) {
            if ($latestApproval) {
                $latestApproval->update([
                    'status' => 'approved',
                    'reviewed_by_membership_id' => $actorMembership->id,
                    'review_notes' => $request->input('review_notes', 'Accepted deliverables and verified gates'),
                    'reviewed_at' => now(),
                ]);
            }

            $task->update([
                'status' => 'completed',
                'completed_at' => now(),
                'version' => $task->version + 1,
            ]);

            TaskStatusHistory::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'from_status' => 'in_review',
                'to_status' => 'completed',
                'reason' => 'Reviewer approved deliverables',
                'changed_by_membership_id' => $actorMembership->id,
                'created_at' => now(),
            ]);

            if ($task->parent_task_id) {
                $task->parentTask?->calculateProgress();
            }
        });

        return response()->json([
            'message' => 'Task deliverables approved and marked complete',
            'task' => $task->fresh(),
        ]);
    }

    /**
     * Reviewer Reject
     */
    public function reject(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $reason = $request->input('reason', 'Deliverables did not satisfy acceptance requirements');

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $latestApproval = TaskApproval::where('task_id', $task->id)
            ->where('status', 'pending')
            ->latest('submitted_at')
            ->first();

        DB::transaction(function () use ($task, $latestApproval, $actorMembership, $reason, $company) {
            if ($latestApproval) {
                $latestApproval->update([
                    'status' => 'rejected',
                    'reviewed_by_membership_id' => $actorMembership->id,
                    'review_notes' => $reason,
                    'reviewed_at' => now(),
                ]);
            }

            $task->update([
                'status' => 'in_progress',
                'version' => $task->version + 1,
            ]);

            TaskStatusHistory::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'from_status' => 'in_review',
                'to_status' => 'in_progress',
                'reason' => $reason,
                'changed_by_membership_id' => $actorMembership->id,
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Task review rejected and returned to in progress',
            'task' => $task->fresh(),
        ]);
    }

    /**
     * FR-04 & Algorithm D: Add Dependency with DAG Cycle Prevention
     */
    public function addDependency(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $validated = $request->validate([
            'prerequisite_task_id' => [
                'required',
                'integer',
                Rule::exists('tasks', 'id')->where('company_id', $company->id),
            ],
            'dependency_type' => ['nullable', 'string', Rule::in(['finish_to_start', 'start_to_start'])],
        ]);

        $prereqId = (int) $validated['prerequisite_task_id'];

        // Self-dependency rejection
        if ($prereqId === $task->id) {
            return response()->json(['message' => 'A task cannot depend on itself.'], 422);
        }

        // DAG cycle prevention
        if ($task->createsCircularDependency($prereqId)) {
            return response()->json([
                'message' => 'Cannot add dependency: circular task dependency cycle detected.',
            ], 422);
        }

        TaskDependency::firstOrCreate([
            'company_id' => $company->id,
            'task_id' => $task->id,
            'prerequisite_task_id' => $prereqId,
            'dependency_type' => $validated['dependency_type'] ?? 'finish_to_start',
        ]);

        return response()->json(['message' => 'Task dependency linked successfully']);
    }

    /**
     * Checklist Item Toggle
     */
    public function toggleChecklistItem(Request $request, Company $company, Task $task, TaskChecklistItem $item): JsonResponse
    {
        if ($task->company_id !== $company->id || $item->checklist->task_id !== $task->id) {
            return response()->json(['message' => 'Checklist item not found in this task'], 404);
        }

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $newCompleted = !$item->is_completed;
        $item->update([
            'is_completed' => $newCompleted,
            'completed_by_membership_id' => $newCompleted ? $actorMembership->id : null,
            'completed_at' => $newCompleted ? now() : null,
        ]);

        return response()->json([
            'message' => $newCompleted ? 'Checklist item checked' : 'Checklist item unchecked',
            'item' => $item,
        ]);
    }

    /**
     * Add Checklist Item
     */
    public function addChecklistItem(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $validated = $request->validate([
            'item_text' => ['required', 'string', 'max:255'],
        ]);

        $checklist = $task->checklists()->first();
        if (!$checklist) {
            $checklist = TaskChecklist::create([
                'company_id' => $company->id,
                'task_id' => $task->id,
                'title' => 'Acceptance Checklist',
                'is_mandatory' => true,
            ]);
        }

        $item = TaskChecklistItem::create([
            'company_id' => $company->id,
            'task_checklist_id' => $checklist->id,
            'item_text' => $validated['item_text'],
            'is_completed' => false,
            'order' => $checklist->items()->count(),
        ]);

        return response()->json([
            'message' => 'Checklist item added',
            'item' => $item,
        ], 201);
    }

    /**
     * FR-06: Add Task Comment with Internal vs Client-Visible Privacy
     */
    public function addComment(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $validated = $request->validate([
            'content' => ['required', 'string'],
            'visibility' => ['nullable', 'string', Rule::in(['internal', 'client_visible'])],
            'parent_comment_id' => [
                'nullable',
                'integer',
                Rule::exists('task_comments', 'id')->where('task_id', $task->id),
            ],
        ]);

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $comment = TaskComment::create([
            'company_id' => $company->id,
            'task_id' => $task->id,
            'author_membership_id' => $actorMembership->id,
            'parent_comment_id' => $validated['parent_comment_id'] ?? null,
            'content' => strip_tags($validated['content']), // output sanitation
            'visibility' => $validated['visibility'] ?? 'internal',
        ]);

        return response()->json([
            'message' => 'Comment added',
            'comment' => $comment->load('author.user:id,name'),
        ], 201);
    }

    /**
     * FR-08: Add Task Attachment / Evidence
     */
    public function addAttachment(Request $request, Company $company, Task $task): JsonResponse
    {
        if ($task->company_id !== $company->id) {
            return response()->json(['message' => 'Task not found in this company'], 404);
        }

        $validated = $request->validate([
            'file_name' => ['required', 'string', 'max:255'],
            'file_path' => ['required', 'string'],
            'file_size' => ['nullable', 'integer'],
            'is_evidence' => ['nullable', 'boolean'],
            'visibility' => ['nullable', 'string', Rule::in(['internal', 'client_visible'])],
        ]);

        $actorMembership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $attachment = TaskAttachment::create([
            'company_id' => $company->id,
            'task_id' => $task->id,
            'uploaded_by_membership_id' => $actorMembership->id,
            'file_name' => $validated['file_name'],
            'file_path' => $validated['file_path'],
            'file_size' => $validated['file_size'] ?? 0,
            'is_evidence' => $validated['is_evidence'] ?? false,
            'visibility' => $validated['visibility'] ?? 'internal',
        ]);

        return response()->json([
            'message' => 'Attachment registered successfully',
            'attachment' => $attachment->load('uploader.user:id,name'),
        ], 201);
    }

    /**
     * Task Reports Summary (FR-10)
     */
    public function reports(Request $request, Company $company): JsonResponse
    {
        $base = Task::where('company_id', $company->id);

        $total = (clone $base)->count();
        $open = (clone $base)->whereIn('status', ['open', 'ready'])->count();
        $inProgress = (clone $base)->where('status', 'in_progress')->count();
        $blocked = (clone $base)->where('status', 'blocked')->count();
        $inReview = (clone $base)->where('status', 'in_review')->count();
        $completed = (clone $base)->whereIn('status', ['completed', 'accepted'])->count();
        $overdue = (clone $base)->whereNotNull('due_at')
            ->where('due_at', '<', now())
            ->whereNotIn('status', ['completed', 'accepted', 'cancelled'])
            ->count();

        $totalEstMinutes = (clone $base)->sum('estimated_minutes');
        $totalActMinutes = (clone $base)->sum('actual_minutes');

        return response()->json([
            'summary' => [
                'total_tasks' => $total,
                'open' => $open,
                'in_progress' => $inProgress,
                'blocked' => $blocked,
                'in_review' => $inReview,
                'completed' => $completed,
                'overdue' => $overdue,
                'estimated_hours' => round($totalEstMinutes / 60, 1),
                'actual_hours' => round($totalActMinutes / 60, 1),
            ],
        ]);
    }

    /**
     * CSV Export of Tasks
     */
    public function export(Request $request, Company $company)
    {
        $tasks = Task::where('company_id', $company->id)
            ->with(['project', 'assignee.user'])
            ->latest()
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="tasks_' . now()->format('Y-m-d') . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($tasks) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Task Code',
                'Title',
                'Project',
                'Status',
                'Priority',
                'Assignee',
                'Due Date',
                'Estimated Hours',
                'Progress %',
            ]);

            foreach ($tasks as $t) {
                fputcsv($handle, [
                    $t->task_code,
                    $t->title,
                    $t->project?->name ?? 'N/A',
                    $t->status,
                    $t->priority,
                    $t->assignee?->user?->name ?? 'Unassigned',
                    $t->due_at ? $t->due_at->toDateString() : 'N/A',
                    round($t->estimated_minutes / 60, 1),
                    $t->progress_percent,
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }
}

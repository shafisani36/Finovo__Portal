<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'milestone_id',
        'parent_task_id',
        'task_code',
        'title',
        'description',
        'task_type',
        'status',
        'priority',
        'visibility',
        'creator_membership_id',
        'assignee_membership_id',
        'start_at',
        'due_at',
        'completed_at',
        'estimated_minutes',
        'actual_minutes',
        'progress_percent',
        'weight',
        'blocker_reason',
        'cancellation_reason',
        'reopen_reason',
        'version',
        'archived_at',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'due_at' => 'datetime',
        'completed_at' => 'datetime',
        'archived_at' => 'datetime',
        'estimated_minutes' => 'integer',
        'actual_minutes' => 'integer',
        'progress_percent' => 'float',
        'weight' => 'float',
        'version' => 'integer',
    ];

    protected $appends = [
        'is_overdue',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class, 'milestone_id');
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(Task::class, 'parent_task_id')->orderBy('id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'creator_membership_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'assignee_membership_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(TaskAssignment::class)->latest('assigned_at');
    }

    public function watchers(): HasMany
    {
        return $this->hasMany(TaskWatcher::class);
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(TaskChecklist::class)->orderBy('order');
    }

    public function dependencies(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'task_id');
    }

    public function prerequisites(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'task_id');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(TaskStatusHistory::class)->latest('created_at');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class)->whereNull('parent_comment_id')->latest('created_at');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class)->latest('created_at');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(TaskApproval::class)->latest('submitted_at');
    }

    /**
     * Algorithm F — Derived Overdue Detection
     */
    public function getIsOverdueAttribute(): bool
    {
        if (!$this->due_at) {
            return false;
        }

        $terminal = ['completed', 'accepted', 'cancelled'];
        if (in_array($this->status, $terminal, true)) {
            return false;
        }

        return now()->isAfter($this->due_at);
    }

    /**
     * Algorithm E — Weighted Parent Task Progress
     * Formula: P = (sum w_i * c_i) / (sum w_i) * 100
     */
    public function calculateProgress(): float
    {
        $children = $this->subtasks()->get();
        if ($children->isEmpty()) {
            return $this->progress_percent;
        }

        $totalWeight = 0.0;
        $weightedCompletion = 0.0;

        foreach ($children as $child) {
            $w = $child->weight > 0 ? (float) $child->weight : 1.0;
            $c = in_array($child->status, ['completed', 'accepted'], true)
                ? 1.0
                : ($child->progress_percent > 0 ? (float) $child->progress_percent / 100.0 : 0.0);

            $totalWeight += $w;
            $weightedCompletion += ($w * $c);
        }

        $percent = $totalWeight > 0 ? round(($weightedCompletion / $totalWeight) * 100.0, 2) : 0.0;
        $this->update(['progress_percent' => $percent]);

        return $percent;
    }

    /**
     * Algorithm D — Directed Acyclic Graph (DAG) Cycle Prevention
     * Traverses the prerequisite chain starting from $prerequisiteTaskId.
     * If the traversal can reach this task ($this->id), adding the dependency would create a cycle.
     */
    public function createsCircularDependency(int $prerequisiteTaskId): bool
    {
        if ($this->id === $prerequisiteTaskId) {
            return true;
        }

        $queue = [$prerequisiteTaskId];
        $visited = [];

        while (!empty($queue)) {
            $currentId = array_shift($queue);
            if ($currentId === $this->id) {
                return true;
            }

            if (isset($visited[$currentId])) {
                continue;
            }
            $visited[$currentId] = true;

            $nextPrereqs = TaskDependency::where('task_id', $currentId)
                ->pluck('prerequisite_task_id')
                ->toArray();

            foreach ($nextPrereqs as $id) {
                if (!isset($visited[$id])) {
                    $queue[] = $id;
                }
            }
        }

        return false;
    }

    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LifecycleTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'lifecycle_instance_id',
        'company_id',
        'task_key',
        'title',
        'description',
        'assigned_role_slug',
        'assigned_membership_id',
        'status',
        'prerequisite_task_keys',
        'completed_by_user_id',
        'completed_at',
        'due_date',
        'execution_notes',
    ];

    protected $casts = [
        'prerequisite_task_keys' => 'array',
        'completed_at' => 'datetime',
        'due_date' => 'date',
    ];

    public function instance(): BelongsTo
    {
        return $this->belongsTo(LifecycleInstance::class, 'lifecycle_instance_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function assignedMembership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'assigned_membership_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by_user_id');
    }

    /**
     * Evaluates if all prerequisite DAG nodes have been successfully completed or skipped.
     */
    public function arePrerequisitesSatisfied(): bool
    {
        if (empty($this->prerequisite_task_keys)) {
            return true;
        }

        $pendingPrereqs = static::where('lifecycle_instance_id', $this->lifecycle_instance_id)
            ->whereIn('task_key', $this->prerequisite_task_keys)
            ->whereNotIn('status', ['completed', 'skipped'])
            ->count();

        return $pendingPrereqs === 0;
    }
}

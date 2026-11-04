<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'name',
        'description',
        'owner_membership_id',
        'status',
        'weight',
        'baseline_due_date',
        'forecast_due_date',
        'actual_completed_at',
        'acceptance_criteria',
        'order',
    ];

    protected $casts = [
        'weight' => 'decimal:2',
        'baseline_due_date' => 'date',
        'forecast_due_date' => 'date',
        'actual_completed_at' => 'datetime',
        'order' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'owner_membership_id');
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(ProjectDeliverable::class, 'milestone_id');
    }

    public function predecessors(): BelongsToMany
    {
        return $this->belongsToMany(
            ProjectMilestone::class,
            'project_milestone_dependencies',
            'successor_milestone_id',
            'predecessor_milestone_id'
        )->withPivot('dependency_type')->withTimestamps();
    }

    public function successors(): BelongsToMany
    {
        return $this->belongsToMany(
            ProjectMilestone::class,
            'project_milestone_dependencies',
            'predecessor_milestone_id',
            'successor_milestone_id'
        )->withPivot('dependency_type')->withTimestamps();
    }

    /**
     * Algorithm D: Prevent circular milestone dependencies (DAG check)
     */
    public function createsCircularDependency(int $candidateSuccessorId): bool
    {
        if ($this->id === $candidateSuccessorId) {
            return true;
        }

        // Check if candidateSuccessorId can already reach this milestone (or is a predecessor)
        $visited = [];
        $queue = [$candidateSuccessorId];

        while (!empty($queue)) {
            $currentId = array_shift($queue);
            if ($currentId === $this->id) {
                return true;
            }

            if (!in_array($currentId, $visited, true)) {
                $visited[] = $currentId;
                $successorDeps = ProjectMilestoneDependency::where('predecessor_milestone_id', $currentId)
                    ->pluck('successor_milestone_id')
                    ->all();
                foreach ($successorDeps as $sId) {
                    $queue[] = $sId;
                }
            }
        }

        return false;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectMilestoneDependency extends Model
{
    use HasFactory;

    protected $table = 'project_milestone_dependencies';

    protected $fillable = [
        'company_id',
        'project_id',
        'predecessor_milestone_id',
        'successor_milestone_id',
        'dependency_type',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function predecessor(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class, 'predecessor_milestone_id');
    }

    public function successor(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class, 'successor_milestone_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectDeliverable extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'milestone_id',
        'name',
        'description',
        'acceptance_status',
        'accepted_at',
        'accepted_by_membership_id',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class);
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'accepted_by_membership_id');
    }
}

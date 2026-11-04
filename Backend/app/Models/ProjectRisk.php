<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectRisk extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'type',
        'title',
        'description',
        'severity',
        'probability',
        'status',
        'owner_membership_id',
        'mitigation_plan',
        'target_resolution_date',
        'resolved_at',
    ];

    protected $casts = [
        'target_resolution_date' => 'date',
        'resolved_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'owner_membership_id');
    }
}

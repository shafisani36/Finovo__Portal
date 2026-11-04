<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectDecision extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'title',
        'decision',
        'rationale',
        'decided_by_membership_id',
        'decided_at',
    ];

    protected $casts = [
        'decided_at' => 'date',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'decided_by_membership_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectScopeRevision extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_id',
        'revision_number',
        'business_objective',
        'in_scope',
        'out_of_scope',
        'assumptions',
        'constraints',
        'status',
        'approved_by_membership_id',
        'approved_at',
        'change_summary',
    ];

    protected $casts = [
        'revision_number' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'approved_by_membership_id');
    }
}

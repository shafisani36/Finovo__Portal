<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'task_id',
        'requested_by_membership_id',
        'reviewed_by_membership_id',
        'status',
        'evidence_notes',
        'review_notes',
        'submitted_at',
        'reviewed_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'requested_by_membership_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewed_by_membership_id');
    }
}

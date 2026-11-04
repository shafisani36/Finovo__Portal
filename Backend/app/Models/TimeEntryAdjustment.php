<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeEntryAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'time_entry_id',
        'requester_membership_id',
        'reviewer_membership_id',
        'original_duration_seconds',
        'proposed_duration_seconds',
        'original_started_at',
        'proposed_started_at',
        'original_ended_at',
        'proposed_ended_at',
        'reason',
        'status',
        'decision_reason',
        'reviewed_at',
    ];

    protected $casts = [
        'original_started_at' => 'datetime',
        'proposed_started_at' => 'datetime',
        'original_ended_at' => 'datetime',
        'proposed_ended_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'original_duration_seconds' => 'integer',
        'proposed_duration_seconds' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function timeEntry(): BelongsTo
    {
        return $this->belongsTo(TimeEntry::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'requester_membership_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewer_membership_id');
    }
}

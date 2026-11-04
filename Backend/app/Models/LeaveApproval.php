<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'leave_request_id',
        'reviewer_membership_id',
        'action', // approved, rejected, cancelled
        'reason',
        'step_order',
        'status',
        'decision_reason',
        'decided_at',
    ];

    protected $casts = [
        'step_order' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function reviewerMembership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewer_membership_id');
    }
}

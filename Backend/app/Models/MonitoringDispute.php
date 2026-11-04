<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringDispute extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'monitoring_interval_id',
        'dispute_reason',
        'status',
        'reviewed_by_membership_id',
        'reviewer_comment',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function interval(): BelongsTo
    {
        return $this->belongsTo(MonitoringInterval::class, 'monitoring_interval_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewed_by_membership_id');
    }
}

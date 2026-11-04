<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringPolicyAcknowledgment extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'policy_id',
        'policy_version',
        'acknowledged_at',
        'ip_address',
    ];

    protected $casts = [
        'policy_version' => 'integer',
        'acknowledged_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(MonitoringPolicy::class, 'policy_id');
    }
}

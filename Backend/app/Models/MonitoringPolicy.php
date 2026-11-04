<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MonitoringPolicy extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'version',
        'is_active',
        'allow_app_category_collection',
        'allow_foreground_app',
        'allow_input_activity',
        'idle_threshold_seconds',
        'allow_offline_queue',
        'offline_grace_hours',
        'retention_days',
        'min_client_version',
        'settings',
        'effective_from',
        'effective_until',
        'created_by_membership_id',
    ];

    protected $casts = [
        'version' => 'integer',
        'is_active' => 'boolean',
        'allow_app_category_collection' => 'boolean',
        'allow_foreground_app' => 'boolean',
        'allow_input_activity' => 'boolean',
        'idle_threshold_seconds' => 'integer',
        'allow_offline_queue' => 'boolean',
        'offline_grace_hours' => 'integer',
        'retention_days' => 'integer',
        'settings' => 'array',
        'effective_from' => 'datetime',
        'effective_until' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'created_by_membership_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(MonitoringPolicyAssignment::class, 'policy_id');
    }

    public function acknowledgments(): HasMany
    {
        return $this->hasMany(MonitoringPolicyAcknowledgment::class, 'policy_id');
    }
}

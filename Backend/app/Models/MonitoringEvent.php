<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'tracker_device_id',
        'event_uid',
        'event_type',
        'client_occurred_at',
        'server_received_at',
        'client_sequence',
        'policy_version',
        'category',
        'idle_duration_seconds',
        'context_type',
        'project_id',
        'task_id',
        'work_session_id',
        'payload',
    ];

    protected $casts = [
        'client_occurred_at' => 'datetime',
        'server_received_at' => 'datetime',
        'client_sequence' => 'integer',
        'policy_version' => 'integer',
        'idle_duration_seconds' => 'integer',
        'payload' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function trackerDevice(): BelongsTo
    {
        return $this->belongsTo(TrackerDevice::class, 'tracker_device_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function workSession(): BelongsTo
    {
        return $this->belongsTo(WorkSession::class);
    }
}

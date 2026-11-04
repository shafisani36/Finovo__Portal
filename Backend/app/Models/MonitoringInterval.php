<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MonitoringInterval extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'tracker_device_id',
        'start_time',
        'end_time',
        'duration_seconds',
        'signal_state',
        'app_category',
        'project_id',
        'task_id',
        'work_session_id',
        'attendance_record_id',
        'context_confidence',
        'quality_state',
        'derivation_version',
        'source_summary',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'duration_seconds' => 'integer',
        'derivation_version' => 'integer',
        'source_summary' => 'array',
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

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class);
    }

    public function annotations(): HasMany
    {
        return $this->hasMany(MonitoringContextAnnotation::class, 'monitoring_interval_id');
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(MonitoringDispute::class, 'monitoring_interval_id');
    }
}

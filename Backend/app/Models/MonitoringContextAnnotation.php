<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringContextAnnotation extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'monitoring_interval_id',
        'annotation_date',
        'start_time',
        'end_time',
        'annotation_type',
        'explanation',
        'suggested_project_id',
        'suggested_task_id',
    ];

    protected $casts = [
        'annotation_date' => 'date:Y-m-d',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
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

    public function suggestedProject(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'suggested_project_id');
    }

    public function suggestedTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'suggested_task_id');
    }
}

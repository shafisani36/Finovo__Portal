<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringReconciliationCase extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'case_date',
        'case_type',
        'severity',
        'm06_session_id',
        'm07_attendance_id',
        'interval_id',
        'title',
        'explanation',
        'status',
        'resolution_notes',
    ];

    protected $casts = [
        'case_date' => 'date:Y-m-d',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(WorkSession::class, 'm06_session_id');
    }

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class, 'm07_attendance_id');
    }

    public function interval(): BelongsTo
    {
        return $this->belongsTo(MonitoringInterval::class, 'interval_id');
    }
}

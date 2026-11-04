<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceCorrectionRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'attendance_record_id',
        'requested_work_date',
        'proposed_clock_in_at',
        'proposed_clock_out_at',
        'reason',
        'status',
        'reviewer_membership_id',
        'decision_reason',
        'reviewed_at',
        'version',
    ];

    protected $casts = [
        'requested_work_date' => 'date',
        'proposed_clock_in_at' => 'datetime',
        'proposed_clock_out_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'version' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewer_membership_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'employment_record_id',
        'work_date',
        'shift_id',
        'status',
        'first_clock_in_at',
        'last_clock_out_at',
        'worked_seconds',
        'break_seconds',
        'late_seconds',
        'early_departure_seconds',
        'is_overtime',
        'version',
    ];

    protected $casts = [
        'work_date' => 'date:Y-m-d',
        'first_clock_in_at' => 'datetime',
        'last_clock_out_at' => 'datetime',
        'worked_seconds' => 'integer',
        'break_seconds' => 'integer',
        'late_seconds' => 'integer',
        'early_departure_seconds' => 'integer',
        'is_overtime' => 'boolean',
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

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(AttendanceEvent::class);
    }

    public function breaks(): HasMany
    {
        return $this->hasMany(AttendanceBreak::class);
    }

    public function correctionRequests(): HasMany
    {
        return $this->hasMany(AttendanceCorrectionRequest::class);
    }
}

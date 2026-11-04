<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Timesheet extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'employment_record_id',
        'period_start',
        'period_end',
        'status',
        'total_tracked_seconds',
        'total_submitted_seconds',
        'total_approved_seconds',
        'total_billable_seconds',
        'version',
        'submitted_at',
        'approved_at',
        'approved_by_membership_id',
        'rejection_reason',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'total_tracked_seconds' => 'integer',
        'total_submitted_seconds' => 'integer',
        'total_approved_seconds' => 'integer',
        'total_billable_seconds' => 'integer',
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'approved_by_membership_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function approvalLogs(): HasMany
    {
        return $this->hasMany(TimesheetApproval::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(TimesheetApproval::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobAssignment extends Model
{
    use HasFactory;

    protected $table = 'job_assignments';

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'job_position_id',
        'department_id',
        'location_id',
        'cost_center_id',
        'manager_membership_id',
        'is_primary',
        'fte_ratio',
        'effective_from',
        'effective_to',
        'status',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'fte_ratio' => 'decimal:2',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(JobPosition::class, 'job_position_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(OrganizationLocation::class, 'location_id');
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class, 'cost_center_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'manager_membership_id');
    }

    /**
     * Determine if assignment is currently active under half-open interval [effective_from, effective_to)
     */
    public function isCurrentlyActive(): bool
    {
        $now = now();
        return $this->status === 'active'
            && $this->effective_from <= $now
            && ($this->effective_to === null || $this->effective_to > $now);
    }
}

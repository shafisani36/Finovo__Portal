<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobRequisition extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'department_id',
        'job_position_id',
        'requisition_number',
        'title',
        'headcount',
        'employment_type',
        'min_salary',
        'max_salary',
        'currency',
        'status',
        'requested_by_user_id',
        'approved_by_user_id',
        'approved_at',
        'rejection_reason',
        'job_description',
        'requirements',
    ];

    protected $casts = [
        'headcount' => 'integer',
        'min_salary' => 'decimal:2',
        'max_salary' => 'decimal:2',
        'approved_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(JobPosition::class, 'job_position_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(CandidateApplication::class, 'job_requisition_id');
    }
}

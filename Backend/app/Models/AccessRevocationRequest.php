<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessRevocationRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'lifecycle_instance_id',
        'employment_record_id',
        'system_identifier',
        'revocation_type',
        'status',
        'requested_by_user_id',
        'executed_by_user_id',
        'executed_at',
        'audit_log',
    ];

    protected $casts = [
        'executed_at' => 'datetime',
        'audit_log' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function instance(): BelongsTo
    {
        return $this->belongsTo(LifecycleInstance::class, 'lifecycle_instance_id');
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function executedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'executed_by_user_id');
    }
}

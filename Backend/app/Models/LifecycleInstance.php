<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LifecycleInstance extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'type',
        'status',
        'target_date',
        'completed_at',
        'initiated_by_user_id',
        'notes',
    ];

    protected $casts = [
        'target_date' => 'date',
        'completed_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by_user_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(LifecycleTask::class, 'lifecycle_instance_id');
    }

    public function revocationRequests(): HasMany
    {
        return $this->hasMany(AccessRevocationRequest::class, 'lifecycle_instance_id');
    }
}

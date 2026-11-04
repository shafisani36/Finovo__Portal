<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompensationPackage extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'currency',
        'base_salary',
        'pay_frequency',
        'components',
        'effective_from',
        'effective_to',
        'is_active',
    ];

    protected $casts = [
        'base_salary' => 'decimal:4',
        'components' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_active' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class);
    }

    public function isCurrentlyEffective(): bool
    {
        $today = now()->toDateString();
        return $this->is_active
            && $this->effective_from <= $today
            && ($this->effective_to === null || $this->effective_to > $today);
    }
}

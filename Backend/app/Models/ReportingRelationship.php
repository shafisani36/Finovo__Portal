<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportingRelationship extends Model
{
    use HasFactory;

    protected $table = 'reporting_relationships';

    protected $fillable = [
        'company_id',
        'employee_id',
        'manager_id',
        'relationship_type',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'employee_id' => 'integer',
        'manager_id' => 'integer',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employee_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'manager_id');
    }

    /**
     * Check if this reporting link is currently effective
     */
    public function isEffective(): bool
    {
        $now = now();
        if ($this->effective_from && $now->lt($this->effective_from)) {
            return false;
        }
        if ($this->effective_to && $now->gte($this->effective_to)) {
            return false;
        }
        return true;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantUsageCounter extends Model
{
    use HasFactory;

    protected $table = 'tenant_usage_counters';

    protected $fillable = [
        'company_id',
        'meter_code',
        'current_value',
        'period_start',
        'period_end',
    ];

    protected $casts = [
        'current_value' => 'integer',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

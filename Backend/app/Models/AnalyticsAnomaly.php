<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsAnomaly extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'kpi_code',
        'baseline_value',
        'observed_value',
        'deviation_percent',
        'severity',
        'explanation_summary',
        'evidence_context',
        'detected_at',
        'acknowledged_at',
        'acknowledged_by_id',
    ];

    protected $casts = [
        'baseline_value' => 'decimal:4',
        'observed_value' => 'decimal:4',
        'deviation_percent' => 'decimal:2',
        'evidence_context' => 'array',
        'detected_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function acknowledgedBy()
    {
        return $this->belongsTo(CompanyMembership::class, 'acknowledged_by_id');
    }
}

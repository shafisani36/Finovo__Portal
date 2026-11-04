<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'kpi_code',
        'kpi_version_number',
        'time_bucket',
        'period_start',
        'period_end',
        'dimension_values',
        'metric_value',
        'numerator',
        'denominator',
        'source_watermark',
        'quality_status',
        'computed_at',
    ];

    protected $casts = [
        'kpi_version_number' => 'integer',
        'period_start' => 'date',
        'period_end' => 'date',
        'dimension_values' => 'array',
        'metric_value' => 'decimal:4',
        'numerator' => 'decimal:4',
        'denominator' => 'decimal:4',
        'computed_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsForecast extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'kpi_code',
        'model_name',
        'model_version',
        'forecast_horizon_date',
        'forecast_value',
        'lower_bound',
        'upper_bound',
        'confidence_level',
        'assumptions',
        'generated_at',
    ];

    protected $casts = [
        'forecast_horizon_date' => 'date',
        'forecast_value' => 'decimal:4',
        'lower_bound' => 'decimal:4',
        'upper_bound' => 'decimal:4',
        'confidence_level' => 'decimal:2',
        'assumptions' => 'array',
        'generated_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

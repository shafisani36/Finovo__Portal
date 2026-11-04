<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsKpiVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'kpi_id',
        'version_number',
        'calculation_method',
        'formula_expression',
        'inclusion_criteria',
        'exclusion_criteria',
        'required_permission',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'inclusion_criteria' => 'array',
        'exclusion_criteria' => 'array',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
    ];

    public function kpi()
    {
        return $this->belongsTo(AnalyticsKpi::class, 'kpi_id');
    }
}

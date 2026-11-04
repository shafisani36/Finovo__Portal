<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsKpi extends Model
{
    use HasFactory;

    protected $fillable = [
        'kpi_code',
        'name',
        'domain',
        'description',
        'owner_role',
        'unit',
        'supported_dimensions',
        'is_active',
    ];

    protected $casts = [
        'supported_dimensions' => 'array',
        'is_active' => 'boolean',
    ];

    public function versions()
    {
        return $this->hasMany(AnalyticsKpiVersion::class, 'kpi_id')->orderByDesc('version_number');
    }

    public function latestVersion()
    {
        return $this->hasOne(AnalyticsKpiVersion::class, 'kpi_id')->latestOfMany('version_number');
    }
}

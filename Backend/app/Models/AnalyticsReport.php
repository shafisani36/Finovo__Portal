<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'created_by_membership_id',
        'title',
        'description',
        'selected_kpis',
        'dimensions',
        'filters',
        'chart_type',
        'is_shared',
    ];

    protected $casts = [
        'selected_kpis' => 'array',
        'dimensions' => 'array',
        'filters' => 'array',
        'is_shared' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function creator()
    {
        return $this->belongsTo(CompanyMembership::class, 'created_by_membership_id');
    }

    public function schedules()
    {
        return $this->hasMany(AnalyticsReportSchedule::class, 'report_id');
    }
}

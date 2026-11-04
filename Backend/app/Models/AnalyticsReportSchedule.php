<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsReportSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_id',
        'company_id',
        'cron_expression',
        'format',
        'recipients',
        'is_active',
        'last_run_at',
        'last_run_status',
    ];

    protected $casts = [
        'recipients' => 'array',
        'is_active' => 'boolean',
        'last_run_at' => 'datetime',
    ];

    public function report()
    {
        return $this->belongsTo(AnalyticsReport::class, 'report_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

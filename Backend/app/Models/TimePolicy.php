<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimePolicy extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'allow_concurrent_sessions',
        'max_manual_entry_hours',
        'idle_timeout_minutes',
        'require_timesheet_approval',
        'enforce_separation_of_duties',
        'timesheet_frequency',
        'timezone',
    ];

    protected $casts = [
        'allow_concurrent_sessions' => 'boolean',
        'require_timesheet_approval' => 'boolean',
        'enforce_separation_of_duties' => 'boolean',
        'max_manual_entry_hours' => 'integer',
        'idle_timeout_minutes' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}

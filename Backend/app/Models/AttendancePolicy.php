<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendancePolicy extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'require_shift_assignment',
        'auto_clock_out_hours',
        'late_tolerance_minutes',
        'early_departure_tolerance_minutes',
        'enable_offline_sync',
    ];

    protected $casts = [
        'require_shift_assignment' => 'boolean',
        'auto_clock_out_hours' => 'integer',
        'late_tolerance_minutes' => 'integer',
        'early_departure_tolerance_minutes' => 'integer',
        'enable_offline_sync' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}

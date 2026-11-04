<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeSyncBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'tracker_device_id',
        'membership_id',
        'batch_uid',
        'events_count',
        'status',
        'conflicts_payload',
    ];

    protected $casts = [
        'events_count' => 'integer',
        'conflicts_payload' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function trackerDevice(): BelongsTo
    {
        return $this->belongsTo(TrackerDevice::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }
}

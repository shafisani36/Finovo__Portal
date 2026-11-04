<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringDeviceHeartbeat extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'tracker_device_id',
        'membership_id',
        'received_at',
        'app_version',
        'os_version',
        'pending_sync_count',
        'last_sync_status',
        'is_online',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'pending_sync_count' => 'integer',
        'is_online' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function trackerDevice(): BelongsTo
    {
        return $this->belongsTo(TrackerDevice::class, 'tracker_device_id');
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }
}

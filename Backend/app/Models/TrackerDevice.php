<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrackerDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'device_uid',
        'device_name',
        'os_version',
        'app_version',
        'status',
        'last_sync_at',
        'revoked_at',
    ];

    protected $casts = [
        'last_sync_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }
}

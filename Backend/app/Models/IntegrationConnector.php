<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationConnector extends Model
{
    use HasFactory;

    protected $fillable = [
        'connector_key',
        'name',
        'category',
        'description',
        'version',
        'auth_type',
        'icon_url',
        'supported_events',
        'supported_sync_directions',
        'rate_limit_per_minute',
        'is_active',
    ];

    protected $casts = [
        'supported_events' => 'array',
        'supported_sync_directions' => 'array',
        'rate_limit_per_minute' => 'integer',
        'is_active' => 'boolean',
    ];

    public function connections()
    {
        return $this->hasMany(IntegrationConnection::class, 'connector_id');
    }
}

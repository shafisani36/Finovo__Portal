<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class IntegrationConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'connector_id',
        'name',
        'status',
        'encrypted_credentials',
        'scopes',
        'configuration',
        'external_account_id',
        'external_account_name',
        'last_connected_at',
        'last_sync_at',
        'last_error',
    ];

    protected $casts = [
        'scopes' => 'array',
        'configuration' => 'array',
        'last_connected_at' => 'datetime',
        'last_sync_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function connector()
    {
        return $this->belongsTo(IntegrationConnector::class, 'connector_id');
    }

    public function syncRuns()
    {
        return $this->hasMany(IntegrationSyncRun::class, 'connection_id');
    }

    public function identityMappings()
    {
        return $this->hasMany(IntegrationIdentityMapping::class, 'connection_id');
    }

    /**
     * Secure credential access (encryted at rest)
     */
    public function setCredentialsAttribute(?array $value): void
    {
        $this->attributes['encrypted_credentials'] = $value ? Crypt::encryptString(json_encode($value)) : null;
    }

    public function getCredentialsAttribute(): ?array
    {
        if (empty($this->attributes['encrypted_credentials'])) {
            return null;
        }
        try {
            return json_decode(Crypt::decryptString($this->attributes['encrypted_credentials']), true);
        } catch (\Exception $e) {
            return null;
        }
    }
}

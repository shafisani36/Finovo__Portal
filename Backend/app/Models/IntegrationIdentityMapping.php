<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationIdentityMapping extends Model
{
    use HasFactory;

    protected $fillable = [
        'connection_id',
        'company_id',
        'resource_type',
        'external_id',
        'internal_id',
        'external_fingerprint',
        'last_synced_at',
    ];

    protected $casts = [
        'internal_id' => 'integer',
        'last_synced_at' => 'datetime',
    ];

    public function connection()
    {
        return $this->belongsTo(IntegrationConnection::class, 'connection_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

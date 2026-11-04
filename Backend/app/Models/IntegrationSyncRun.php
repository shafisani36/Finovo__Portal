<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationSyncRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'connection_id',
        'company_id',
        'resource_type',
        'direction',
        'status',
        'lease_token',
        'lease_expires_at',
        'records_fetched',
        'records_processed',
        'records_failed',
        'current_cursor',
        'error_summary',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'records_fetched' => 'integer',
        'records_processed' => 'integer',
        'records_failed' => 'integer',
        'lease_expires_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
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

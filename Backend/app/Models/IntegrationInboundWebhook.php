<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationInboundWebhook extends Model
{
    use HasFactory;

    protected $fillable = [
        'connection_id',
        'company_id',
        'connector_key',
        'event_id',
        'event_type',
        'payload',
        'signature',
        'status',
        'processing_error',
        'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];

    public function connection()
    {
        return $this->belongsTo(IntegrationConnection::class, 'connection_id');
    }
}

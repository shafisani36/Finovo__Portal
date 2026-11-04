<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationWebhookDelivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'outbound_webhook_id',
        'company_id',
        'event_type',
        'delivery_uuid',
        'payload',
        'response_status',
        'response_body',
        'attempts',
        'status',
        'scheduled_at',
        'delivered_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'response_status' => 'integer',
        'attempts' => 'integer',
        'scheduled_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function webhook()
    {
        return $this->belongsTo(IntegrationOutboundWebhook::class, 'outbound_webhook_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

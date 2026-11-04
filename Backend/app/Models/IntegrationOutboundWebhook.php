<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntegrationOutboundWebhook extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'target_url',
        'signing_secret',
        'subscribed_events',
        'is_active',
        'ssrf_validated',
        'failure_count',
        'disabled_at',
    ];

    protected $casts = [
        'subscribed_events' => 'array',
        'is_active' => 'boolean',
        'ssrf_validated' => 'boolean',
        'failure_count' => 'integer',
        'disabled_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function deliveries()
    {
        return $this->hasMany(IntegrationWebhookDelivery::class, 'outbound_webhook_id');
    }
}

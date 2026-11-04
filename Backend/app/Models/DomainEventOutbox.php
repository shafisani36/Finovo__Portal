<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DomainEventOutbox extends Model
{
    use HasFactory;

    protected $table = 'domain_event_outbox';

    protected $fillable = [
        'event_id',
        'event_type',
        'schema_version',
        'occurred_at',
        'company_id',
        'correlation_id',
        'causation_id',
        'producer',
        'payload',
        'status',
        'attempts',
        'last_error',
        'locked_until',
        'dispatched_at',
    ];

    protected $casts = [
        'schema_version' => 'integer',
        'occurred_at' => 'datetime',
        'payload' => 'array',
        'attempts' => 'integer',
        'locked_until' => 'datetime',
        'dispatched_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

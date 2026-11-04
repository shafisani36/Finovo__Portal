<?php

namespace App\Services\Events;

use App\Models\DomainEventOutbox;
use Illuminate\Support\Str;

class DomainEventDispatcher
{
    /**
     * Dispatch an internal event with the standard event envelope (Section 32.1)
     */
    public function dispatch(
        string $eventType,
        ?int $companyId,
        array $data,
        string $producer = 'finovo_core',
        ?string $correlationId = null,
        ?string $causationId = null
    ): DomainEventOutbox {
        $eventId = (string) Str::uuid();

        return DomainEventOutbox::create([
            'event_id' => $eventId,
            'event_type' => $eventType,
            'schema_version' => 1,
            'occurred_at' => now(),
            'company_id' => $companyId,
            'correlation_id' => $correlationId ?? (string) Str::uuid(),
            'causation_id' => $causationId,
            'producer' => $producer,
            'payload' => $data,
            'status' => 'pending',
            'attempts' => 0,
        ]);
    }
}

<?php

namespace App\Domain\Organization\Events;

use App\Models\Company;

class TenantSuspended
{
    public function __construct(
        public readonly Company $tenant,
        public readonly string $reason,
        public readonly int $actorUserId
    ) {}
}

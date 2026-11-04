<?php

namespace App\Domain\Organization\Events;

use App\Models\Company;

class TenantPlanChanged
{
    public function __construct(
        public readonly Company $tenant,
        public readonly string $previousPlan,
        public readonly string $newPlan,
        public readonly int $actorUserId
    ) {}
}

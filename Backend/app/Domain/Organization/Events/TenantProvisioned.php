<?php

namespace App\Domain\Organization\Events;

use App\Models\Company;

class TenantProvisioned
{
    public function __construct(
        public readonly Company $tenant,
        public readonly int $ownerUserId,
        public readonly string $workspaceSlug
    ) {}
}

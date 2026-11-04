<?php

namespace App\Domain\Access\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoleAssigned
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $companyId,
        public int $membershipId,
        public int $roleId,
        public string $scopeType,
        public ?int $scopeId,
        public int $assignedByUserId,
    ) {}
}

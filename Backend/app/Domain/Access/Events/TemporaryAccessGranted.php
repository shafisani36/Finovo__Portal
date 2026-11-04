<?php

namespace App\Domain\Access\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TemporaryAccessGranted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $companyId,
        public int $membershipId,
        public int $grantId,
        public ?string $permissionKey,
        public ?int $roleId,
        public string $expiresAt,
        public int $grantedByUserId,
    ) {}
}

<?php

namespace App\Domain\Access\DTOs;

readonly class AssignRoleData
{
    public function __construct(
        public int $membershipId,
        public int $roleId,
        public string $scopeType = 'organization',
        public ?int $scopeId = null,
        public ?string $effectiveFrom = null,
        public ?string $effectiveTo = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            membershipId: (int)($data['membership_id'] ?? 0),
            roleId: (int)($data['role_id'] ?? 0),
            scopeType: (string)($data['scope_type'] ?? 'organization'),
            scopeId: isset($data['scope_id']) ? (int)$data['scope_id'] : null,
            effectiveFrom: isset($data['effective_from']) ? (string)$data['effective_from'] : null,
            effectiveTo: isset($data['effective_to']) ? (string)$data['effective_to'] : null,
        );
    }
}

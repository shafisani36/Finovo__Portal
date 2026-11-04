<?php

namespace App\Domain\Access\DTOs;

readonly class GrantTemporaryAccessData
{
    public function __construct(
        public int $membershipId,
        public ?int $roleId,
        public ?string $permissionKey,
        public string $reason,
        public int $durationHours,
        public string $scopeType = 'organization',
        public ?int $scopeId = null,
        public string $grantType = 'grant',
        public bool $isPermanent = false,
    ) {}

    public static function fromArray(array $data): self
    {
        $isPermanent = (bool)($data['is_permanent'] ?? false);
        $duration = (int)($data['duration_hours'] ?? 24);

        return new self(
            membershipId: (int)($data['membership_id'] ?? 0),
            roleId: isset($data['role_id']) ? (int)$data['role_id'] : null,
            permissionKey: isset($data['permission_key']) ? (string)$data['permission_key'] : null,
            reason: trim((string)($data['reason'] ?? '')),
            durationHours: $isPermanent ? 0 : max(1, min(8760, $duration)),
            scopeType: (string)($data['scope_type'] ?? 'organization'),
            scopeId: isset($data['scope_id']) ? (int)$data['scope_id'] : null,
            grantType: in_array($data['grant_type'] ?? '', ['grant', 'restrict']) ? (string)$data['grant_type'] : 'grant',
            isPermanent: $isPermanent,
        );
    }
}

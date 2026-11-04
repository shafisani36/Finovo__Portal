<?php

namespace App\Domain\Organization\DTOs;

class TenantRegistrationData
{
    public function __construct(
        public readonly string $name,
        public readonly string $workspaceSlug,
        public readonly ?string $timezone = 'UTC',
        public readonly ?string $locale = 'en-US',
        public readonly ?string $planCode = 'starter',
        public readonly ?string $logoPath = null,
        public readonly ?string $idempotencyKey = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            name: $data['name'],
            workspaceSlug: $data['workspace_slug'] ?? $data['slug'],
            timezone: $data['timezone'] ?? 'UTC',
            locale: $data['locale'] ?? 'en-US',
            planCode: $data['plan_code'] ?? 'starter',
            logoPath: $data['logo_path'] ?? null,
            idempotencyKey: $data['idempotency_key'] ?? null,
        );
    }
}

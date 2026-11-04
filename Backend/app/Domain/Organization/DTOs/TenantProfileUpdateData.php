<?php

namespace App\Domain\Organization\DTOs;

class TenantProfileUpdateData
{
    public function __construct(
        public readonly ?string $name = null,
        public readonly ?string $timezone = null,
        public readonly ?string $locale = null,
        public readonly ?string $logoPath = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            name: $data['name'] ?? null,
            timezone: $data['timezone'] ?? null,
            locale: $data['locale'] ?? null,
            logoPath: $data['logo_path'] ?? null,
        );
    }
}

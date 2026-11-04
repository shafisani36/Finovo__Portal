<?php

namespace App\Domain\Access\DTOs;

readonly class CreateRoleData
{
    public function __construct(
        public string $name,
        public string $slug,
        public ?string $description = null,
        public array $permissionIds = [],
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            name: trim((string)($data['name'] ?? '')),
            slug: \Illuminate\Support\Str::slug((string)($data['slug'] ?? $data['name'] ?? '')),
            description: isset($data['description']) ? trim((string)$data['description']) : null,
            permissionIds: array_map('intval', (array)($data['permission_ids'] ?? $data['permissions'] ?? [])),
        );
    }
}

<?php

namespace App\Domain\Access\DTOs;

readonly class AccessEvaluationResult
{
    public function __construct(
        public bool $isAllowed,
        public string $permissionKey,
        public ?string $reason = null,
        public ?string $matchedRole = null,
        public ?string $matchedGrant = null,
        public string $scopeType = 'organization',
        public ?int $scopeId = null,
        public array $decisionTree = [],
    ) {}

    public function toArray(): array
    {
        return [
            'is_allowed' => $this->isAllowed,
            'permission_key' => $this->permissionKey,
            'reason' => $this->reason,
            'matched_role' => $this->matchedRole,
            'matched_grant' => $this->matchedGrant,
            'scope' => [
                'type' => $this->scopeType,
                'id' => $this->scopeId,
            ],
            'decision_tree' => $this->decisionTree,
        ];
    }
}

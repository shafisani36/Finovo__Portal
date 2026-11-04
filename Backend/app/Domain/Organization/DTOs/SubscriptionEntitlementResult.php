<?php

namespace App\Domain\Organization\DTOs;

class SubscriptionEntitlementResult
{
    public function __construct(
        public readonly string $featureCode,
        public readonly bool $isAllowed,
        public readonly ?int $quotaLimit = null,
        public readonly ?int $currentUsage = null,
        public readonly ?string $denialReason = null,
    ) {}

    public function toArray(): array
    {
        return [
            'feature_code' => $this->featureCode,
            'is_allowed' => $this->isAllowed,
            'quota_limit' => $this->quotaLimit,
            'current_usage' => $this->currentUsage,
            'denial_reason' => $this->denialReason,
        ];
    }
}

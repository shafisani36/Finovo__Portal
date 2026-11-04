<?php

namespace App\Domain\Organization\Exceptions;

use Exception;

class EntitlementExceededException extends Exception
{
    public function __construct(
        public readonly string $featureCode,
        public readonly int $limit,
        public readonly int $currentUsage,
        string $message = 'Subscription plan entitlement or seat quota exceeded.'
    ) {
        parent::__construct($message, 402);
    }
}

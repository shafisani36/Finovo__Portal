<?php

namespace App\Domain\Organization\Exceptions;

use Exception;

class TenantSuspendedException extends Exception
{
    public function __construct(string $message = 'This organization workspace has been suspended.')
    {
        parent::__construct($message, 403);
    }
}

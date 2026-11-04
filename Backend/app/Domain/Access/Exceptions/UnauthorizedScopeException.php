<?php

namespace App\Domain\Access\Exceptions;

use Exception;

class UnauthorizedScopeException extends Exception
{
    public function __construct(string $message = "Action is outside your authorized resource scope.")
    {
        parent::__construct($message, 403);
    }
}

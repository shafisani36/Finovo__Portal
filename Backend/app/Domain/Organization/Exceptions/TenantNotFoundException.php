<?php

namespace App\Domain\Organization\Exceptions;

use Exception;

class TenantNotFoundException extends Exception
{
    public function __construct(string $message = 'Organization workspace not found or you lack membership.')
    {
        parent::__construct($message, 404);
    }
}

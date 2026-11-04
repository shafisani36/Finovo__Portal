<?php

namespace App\Domain\Access\Exceptions;

use Exception;

class RoleNotFoundException extends Exception
{
    public function __construct(string $message = "The requested role was not found in this organization.")
    {
        parent::__construct($message, 404);
    }
}

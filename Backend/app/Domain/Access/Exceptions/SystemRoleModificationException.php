<?php

namespace App\Domain\Access\Exceptions;

use Exception;

class SystemRoleModificationException extends Exception
{
    public function __construct(string $roleSlug)
    {
        parent::__construct("Built-in system role '{$roleSlug}' cannot be modified or deleted.", 403);
    }
}

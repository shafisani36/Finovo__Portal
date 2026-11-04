<?php

namespace App\Domain\Structure\Exceptions;

use Exception;

class DepartmentHierarchyCycleException extends Exception
{
    public function __construct(string $message = "Circular dependency detected in department hierarchy.")
    {
        parent::__construct($message, 422);
    }
}

<?php

namespace App\Domain\Structure\Exceptions;

use Exception;

class ReportingHierarchyCycleException extends Exception
{
    public function __construct(string $message = "Circular reporting relationship detected in management graph.")
    {
        parent::__construct($message, 422);
    }
}

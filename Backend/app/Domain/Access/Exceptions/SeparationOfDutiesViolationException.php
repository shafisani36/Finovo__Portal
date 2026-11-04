<?php

namespace App\Domain\Access\Exceptions;

use Exception;

class SeparationOfDutiesViolationException extends Exception
{
    public function __construct(string $message = "Action denied due to separation-of-duties policy conflict.")
    {
        parent::__construct($message, 403);
    }
}

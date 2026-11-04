<?php

namespace App\Domain\Structure\Exceptions;

use Exception;

class DepartmentHasActiveDependenciesException extends Exception
{
    public function __construct(string $message = "Cannot delete or close department with active employees or subdepartments.")
    {
        parent::__construct($message, 409);
    }
}

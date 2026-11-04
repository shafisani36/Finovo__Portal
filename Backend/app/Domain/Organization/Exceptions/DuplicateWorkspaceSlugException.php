<?php

namespace App\Domain\Organization\Exceptions;

use Exception;

class DuplicateWorkspaceSlugException extends Exception
{
    public function __construct(string $slug, string $message = 'The requested workspace slug is already registered.')
    {
        parent::__construct("{$message} (slug: {$slug})", 422);
    }
}

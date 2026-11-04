<?php

namespace App\Domain\Structure\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DepartmentReorganized
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $companyId,
        public int $departmentId,
        public ?int $oldParentId,
        public ?int $newParentId,
        public int $reorganizedByUserId,
    ) {}
}

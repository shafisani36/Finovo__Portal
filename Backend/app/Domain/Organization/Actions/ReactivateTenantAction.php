<?php

namespace App\Domain\Organization\Actions;

use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReactivateTenantAction
{
    public function execute(Company $company, User $actor): Company
    {
        $company->update(['status' => 'active']);
        return $company->fresh();
    }
}

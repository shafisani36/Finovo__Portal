<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\DTOs\TenantProfileUpdateData;
use App\Models\Company;

class UpdateTenantProfileAction
{
    public function execute(Company $company, TenantProfileUpdateData $data): Company
    {
        $attributes = array_filter([
            'name' => $data->name,
            'timezone' => $data->timezone,
            'locale' => $data->locale,
            'logo_path' => $data->logoPath,
        ], fn ($val) => !is_null($val));

        if (!empty($attributes)) {
            $company->update($attributes);
        }

        return $company->fresh();
    }
}

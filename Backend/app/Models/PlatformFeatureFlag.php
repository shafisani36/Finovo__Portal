<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformFeatureFlag extends Model
{
    use HasFactory;

    protected $fillable = [
        'flag_key',
        'name',
        'description',
        'is_enabled_globally',
        'rollout_percentage',
        'allowed_company_ids',
        'rules',
    ];

    protected $casts = [
        'is_enabled_globally' => 'boolean',
        'rollout_percentage' => 'integer',
        'allowed_company_ids' => 'array',
        'rules' => 'array',
    ];

    public function isEnabledForTenant(?int $companyId): bool
    {
        if ($this->is_enabled_globally) {
            return true;
        }

        if (!$companyId) {
            return false;
        }

        if (!empty($this->allowed_company_ids) && in_array($companyId, $this->allowed_company_ids)) {
            return true;
        }

        if ($this->rollout_percentage > 0) {
            // Consistent hashing based on companyId
            return ($companyId % 100) < $this->rollout_percentage;
        }

        return false;
    }
}

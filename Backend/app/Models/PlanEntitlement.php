<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanEntitlement extends Model
{
    use HasFactory;

    protected $table = 'plan_entitlements';

    protected $fillable = [
        'company_id',
        'feature_code',
        'is_enabled',
        'quota_limit',
        'override_reason',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'quota_limit' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

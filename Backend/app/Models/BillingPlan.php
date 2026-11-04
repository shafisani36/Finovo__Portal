<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_code',
        'name',
        'description',
        'tier',
        'is_active',
        'is_public',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_public' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function priceVersions()
    {
        return $this->hasMany(BillingPriceVersion::class, 'plan_id');
    }

    public function entitlements()
    {
        return $this->hasMany(BillingPlanEntitlement::class, 'plan_id');
    }

    public function subscriptions()
    {
        return $this->hasMany(BillingSubscription::class, 'plan_id');
    }

    public function activePriceVersion(string $interval = 'monthly')
    {
        return $this->priceVersions()
            ->where('billing_interval', $interval)
            ->where('is_active', true)
            ->orderByDesc('version_number')
            ->first();
    }
}

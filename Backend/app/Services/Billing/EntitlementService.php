<?php

namespace App\Services\Billing;

use App\Models\Company;
use App\Models\BillingSubscription;
use App\Models\BillingPlanEntitlement;
use App\Models\BillingSubscriptionSeat;
use Illuminate\Support\Facades\Cache;

class EntitlementService
{
    /**
     * Authoritative calculation: E = f(S, P, A, U, G, R)
     */
    public function getEntitlement(Company $company, string $featureKey): array
    {
        $cacheKey = "entitlement_{$company->id}_{$featureKey}";
        
        return Cache::remember($cacheKey, 60, function () use ($company, $featureKey) {
            $subscription = BillingSubscription::where('company_id', $company->id)
                ->with(['plan.entitlements', 'seats'])
                ->first();

            if (!$subscription) {
                return [
                    'enabled' => false,
                    'limit' => 0,
                    'unlimited' => false,
                    'reason' => 'No active subscription found',
                    'subscription_status' => 'none',
                ];
            }

            if (!$subscription->isActive()) {
                return [
                    'enabled' => false,
                    'limit' => 0,
                    'unlimited' => false,
                    'reason' => "Subscription is currently {$subscription->status}",
                    'subscription_status' => $subscription->status,
                ];
            }

            // Lookup entitlement from plan
            $entitlement = $subscription->plan?->entitlements
                ->where('feature_key', $featureKey)
                ->first();

            if (!$entitlement) {
                // If feature is seat limit
                if ($featureKey === 'seats') {
                    $totalSeats = $subscription->totalAllowedSeats();
                    return [
                        'enabled' => true,
                        'limit' => $totalSeats,
                        'occupied' => $subscription->seats?->occupied_seats ?? 1,
                        'available' => max(0, $totalSeats - ($subscription->seats?->occupied_seats ?? 1)),
                        'unlimited' => false,
                        'reason' => 'Seat quota determined by plan and purchased add-ons',
                    ];
                }

                return [
                    'enabled' => true,
                    'limit' => null,
                    'unlimited' => true,
                    'reason' => 'Default permissive feature policy',
                ];
            }

            if ($entitlement->value_type === 'boolean') {
                $enabled = filter_var($entitlement->value, FILTER_VALIDATE_BOOLEAN);
                return [
                    'enabled' => $enabled,
                    'limit' => null,
                    'unlimited' => false,
                    'reason' => $enabled ? 'Granted by plan' : 'Feature not included in plan tier',
                ];
            }

            if ($entitlement->value_type === 'unlimited') {
                return [
                    'enabled' => true,
                    'limit' => null,
                    'unlimited' => true,
                    'reason' => 'Unlimited by plan tier',
                ];
            }

            $limit = (int) $entitlement->value;
            return [
                'enabled' => $limit > 0,
                'limit' => $limit,
                'unlimited' => false,
                'reason' => 'Quantitative quota enforced by plan',
            ];
        });
    }

    /**
     * Check if tenant has capacity to invite/create another employee seat
     */
    public function canAddSeat(Company $company): bool
    {
        $seatEntitlement = $this->getEntitlement($company, 'seats');
        if (!$seatEntitlement['enabled']) {
            return false;
        }

        if ($seatEntitlement['unlimited'] ?? false) {
            return true;
        }

        $available = $seatEntitlement['available'] ?? 0;
        return $available > 0;
    }

    /**
     * Clear cached entitlements when subscription changes
     */
    public function invalidateEntitlements(int $companyId): void
    {
        $commonKeys = ['seats', 'max_projects', 'storage_gb', 'custom_integrations', 'advanced_analytics'];
        foreach ($commonKeys as $key) {
            Cache::forget("entitlement_{$companyId}_{$key}");
        }
    }
}

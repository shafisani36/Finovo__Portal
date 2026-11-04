<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\DTOs\SubscriptionEntitlementResult;
use App\Domain\Organization\Exceptions\EntitlementExceededException;
use App\Models\Company;
use App\Models\PlanEntitlement;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionEntitlementService
{
    private const CACHE_TTL_SECONDS = 300; // 5 minutes

    /**
     * Standard baseline entitlements per subscription tier
     */
    private const PLAN_MATRIX = [
        'starter' => [
            'seats' => 10,
            'storage_gb' => 10,
            'features' => [
                'm01_tenant_management' => true,
                'm02_org_structure' => true,
                'm03_access_control' => true,
                'm04_employees' => true,
                'm07_attendance_leave' => true,
                'm08_time_tracking' => true,
                'collaboration' => true,
                'm05_recruitment' => false,
                'm06_lifecycle' => false,
                'm09_payroll' => false,
                'm10_performance' => false,
            ],
        ],
        'professional' => [
            'seats' => 50,
            'storage_gb' => 50,
            'features' => [
                'm01_tenant_management' => true,
                'm02_org_structure' => true,
                'm03_access_control' => true,
                'm04_employees' => true,
                'm05_recruitment' => true,
                'm06_lifecycle' => true,
                'm07_attendance_leave' => true,
                'm08_time_tracking' => true,
                'collaboration' => true,
                'm09_payroll' => true,
                'm10_performance' => true,
            ],
        ],
        'enterprise' => [
            'seats' => 999999,
            'storage_gb' => 1000,
            'features' => [
                'm01_tenant_management' => true,
                'm02_org_structure' => true,
                'm03_access_control' => true,
                'm04_employees' => true,
                'm05_recruitment' => true,
                'm06_lifecycle' => true,
                'm07_attendance_leave' => true,
                'm08_time_tracking' => true,
                'collaboration' => true,
                'm09_payroll' => true,
                'm10_performance' => true,
            ],
        ],
    ];

    /**
     * Resolves whether the tenant is entitled to a specific feature code
     */
    public function checkFeatureEntitlement(Company $company, string $featureCode): SubscriptionEntitlementResult
    {
        $cacheKey = "tenant_entitlement_{$company->id}_{$featureCode}";

        return Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($company, $featureCode) {
            // 1. Check database overrides first (highest priority)
            $override = PlanEntitlement::where('company_id', $company->id)
                ->where('feature_code', $featureCode)
                ->first();

            if ($override) {
                return new SubscriptionEntitlementResult(
                    featureCode: $featureCode,
                    isAllowed: $override->is_enabled,
                    quotaLimit: $override->quota_limit,
                    denialReason: $override->is_enabled ? null : ($override->override_reason ?? 'Feature disabled for this organization')
                );
            }

            // 2. Resolve via active subscription tier
            $subscription = $company->subscription;
            $planCode = strtolower($subscription?->plan_id ? ($subscription->plan?->code ?? 'starter') : ($subscription->plan_code ?? 'professional'));

            $tierMatrix = self::PLAN_MATRIX[$planCode] ?? self::PLAN_MATRIX['starter'];
            $isAllowed = $tierMatrix['features'][$featureCode] ?? true;

            return new SubscriptionEntitlementResult(
                featureCode: $featureCode,
                isAllowed: $isAllowed,
                quotaLimit: null,
                denialReason: $isAllowed ? null : "Feature '{$featureCode}' requires upgrading to the Professional or Enterprise tier."
            );
        });
    }

    /**
     * Asserts that adding an employee/seat will not breach the tenant's purchased seat limit
     *
     * @throws EntitlementExceededException
     */
    public function assertCanAddSeat(Company $company): void
    {
        $subscription = $company->subscription;
        $purchasedSeats = $subscription ? ($subscription->purchased_seats + $subscription->additional_seats) : 10;

        // Count current active employees in the tenant
        $activeCount = DB::table('employees')
            ->where('company_id', $company->id)
            ->whereNull('deleted_at')
            ->count();

        if ($activeCount >= $purchasedSeats) {
            throw new EntitlementExceededException(
                featureCode: 'seat_capacity',
                limit: $purchasedSeats,
                currentUsage: $activeCount,
                message: "Organization seat limit reached ({$activeCount}/{$purchasedSeats}). Upgrade plan to add more members."
            );
        }
    }

    /**
     * Invalidates cached entitlements when subscriptions or overrides change
     */
    public function invalidateEntitlements(Company $company): void
    {
        foreach (array_keys(self::PLAN_MATRIX['professional']['features']) as $code) {
            Cache::forget("tenant_entitlement_{$company->id}_{$code}");
        }
    }
}

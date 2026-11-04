<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Services\Billing\EntitlementService;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscriptionEntitlement
{
    protected EntitlementService $entitlementService;

    public function __construct(EntitlementService $entitlementService)
    {
        $this->entitlementService = $entitlementService;
    }

    /**
     * Handle an incoming request.
     * Enforces feature limits server-side (NFR-14-06).
     */
    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $company = $request->route('company');
        if (!$company) {
            return $next($request);
        }

        $entitlement = $this->entitlementService->getEntitlement($company, $featureKey);

        if (!$entitlement['enabled']) {
            return response()->json([
                'success' => false,
                'error' => 'SUBSCRIPTION_ENTITLEMENT_RESTRICTION',
                'message' => "Your plan does not permit access to '{$featureKey}'. Reason: {$entitlement['reason']}",
                'feature_key' => $featureKey,
                'entitlement' => $entitlement,
            ], 403);
        }

        return $next($request);
    }
}

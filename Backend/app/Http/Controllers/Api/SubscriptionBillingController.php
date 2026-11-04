<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\BillingPlan;
use App\Models\BillingPriceVersion;
use App\Models\BillingSubscription;
use App\Models\BillingSubscriptionSeat;
use App\Models\BillingInvoice;
use App\Models\BillingUsageRecord;
use App\Services\Billing\EntitlementService;
use App\Services\Events\DomainEventDispatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubscriptionBillingController extends Controller
{
    protected EntitlementService $entitlementService;
    protected DomainEventDispatcher $eventDispatcher;

    public function __construct(EntitlementService $entitlementService, DomainEventDispatcher $eventDispatcher)
    {
        $this->entitlementService = $entitlementService;
        $this->eventDispatcher = $eventDispatcher;
    }

    /**
     * FR-14-01: Public Plan & Pricing Catalog
     */
    public function getPlans()
    {
        $plans = BillingPlan::where('is_active', true)
            ->where('is_public', true)
            ->with(['priceVersions' => function ($q) {
                $q->where('is_active', true);
            }, 'entitlements'])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'plans' => $plans,
        ]);
    }

    /**
     * Current Tenant Subscription Overview
     */
    public function getSubscription(Company $company)
    {
        $subscription = BillingSubscription::where('company_id', $company->id)
            ->with(['plan.entitlements', 'priceVersion', 'seats'])
            ->first();

        if (!$subscription) {
            return response()->json([
                'success' => true,
                'has_subscription' => false,
                'subscription' => null,
            ]);
        }

        // Active employee count from memberships
        $occupiedSeats = $company->memberships()->where('status', 'active')->count();

        // Reconcile seat counter
        if ($subscription->seats && $subscription->seats->occupied_seats !== $occupiedSeats) {
            $subscription->seats->update([
                'occupied_seats' => $occupiedSeats,
                'last_reconciled_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'has_subscription' => true,
            'subscription' => $subscription,
            'seat_metrics' => [
                'total_seats' => $subscription->totalAllowedSeats(),
                'occupied_seats' => $occupiedSeats,
                'available_seats' => max(0, $subscription->totalAllowedSeats() - $occupiedSeats),
            ],
            'entitlements' => [
                'max_projects' => $this->entitlementService->getEntitlement($company, 'max_projects'),
                'storage_gb' => $this->entitlementService->getEntitlement($company, 'storage_gb'),
                'custom_integrations' => $this->entitlementService->getEntitlement($company, 'custom_integrations'),
            ],
        ]);
    }

    /**
     * FR-14-05: Upgrades & Downgrades (Deterministic proration & capacity check)
     */
    public function changePlan(Request $request, Company $company)
    {
        $request->validate([
            'target_plan_code' => 'required|string|exists:billing_plans,plan_code',
            'billing_interval' => 'nullable|string|in:monthly,annual',
        ]);

        $targetPlan = BillingPlan::where('plan_code', $request->target_plan_code)->firstOrFail();
        $interval = $request->billing_interval ?? 'monthly';
        $priceVersion = $targetPlan->activePriceVersion($interval);

        if (!$priceVersion) {
            return response()->json([
                'success' => false,
                'message' => 'No active pricing version available for selected billing interval.',
            ], 422);
        }

        $subscription = BillingSubscription::where('company_id', $company->id)->first();
        if (!$subscription) {
            return response()->json([
                'success' => false,
                'message' => 'No existing subscription to modify.',
            ], 404);
        }

        // Capacity constraint check on downgrade: Ensure occupied seats fit new plan
        $occupiedSeats = $company->memberships()->where('status', 'active')->count();
        if ($priceVersion->included_seats < $occupiedSeats) {
            return response()->json([
                'success' => false,
                'error' => 'DOWNGRADE_CAPACITY_EXCEEDED',
                'message' => "Cannot change plan: current active team members ({$occupiedSeats}) exceed target plan capacity ({$priceVersion->included_seats}). Please adjust seats first.",
            ], 422);
        }

        DB::transaction(function () use ($subscription, $targetPlan, $priceVersion, $interval, $company) {
            $subscription->update([
                'plan_id' => $targetPlan->id,
                'price_version_id' => $priceVersion->id,
                'billing_interval' => $interval,
                'purchased_seats' => $priceVersion->included_seats,
                'current_price' => $priceVersion->base_price,
                'currency' => $priceVersion->currency,
            ]);

            if ($subscription->seats) {
                $subscription->seats->update([
                    'total_seats' => $priceVersion->included_seats + $subscription->additional_seats,
                    'last_reconciled_at' => now(),
                ]);
            }

            $this->entitlementService->invalidateEntitlements($company->id);

            // Record outbox domain event (Section 32)
            $this->eventDispatcher->dispatch(
                'subscription.state_changed',
                $company->id,
                [
                    'subscription_id' => $subscription->id,
                    'new_plan' => $targetPlan->plan_code,
                    'interval' => $interval,
                ],
                'billing_service'
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Successfully transitioned subscription to {$targetPlan->name}.",
            'subscription' => $subscription->fresh(['plan', 'priceVersion', 'seats']),
        ]);
    }

    /**
     * FR-14-03: Seat Capacity Management
     */
    public function manageSeats(Request $request, Company $company)
    {
        $request->validate([
            'additional_seats' => 'required|integer|min:0|max:500',
        ]);

        $subscription = BillingSubscription::where('company_id', $company->id)->firstOrFail();
        
        $subscription->update([
            'additional_seats' => $request->additional_seats,
        ]);

        if ($subscription->seats) {
            $subscription->seats->update([
                'total_seats' => $subscription->purchased_seats + $request->additional_seats,
                'last_reconciled_at' => now(),
            ]);
        }

        $this->entitlementService->invalidateEntitlements($company->id);

        return response()->json([
            'success' => true,
            'message' => 'Subscription seat quota updated successfully.',
            'total_seats' => $subscription->totalAllowedSeats(),
        ]);
    }

    /**
     * Cancel Subscription at Period End
     */
    public function cancelSubscription(Request $request, Company $company)
    {
        $subscription = BillingSubscription::where('company_id', $company->id)->firstOrFail();

        $subscription->update([
            'status' => BillingSubscription::STATUS_CANCEL_SCHEDULED,
            'cancel_at_period_end_requested_at' => now(),
            'cancellation_reason' => $request->reason ?? 'User initiated cancellation',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Subscription will remain active until the end of the billing period.',
            'subscription' => $subscription,
        ]);
    }

    /**
     * Reactivate scheduled cancellation
     */
    public function reactivateSubscription(Company $company)
    {
        $subscription = BillingSubscription::where('company_id', $company->id)->firstOrFail();

        if ($subscription->status !== BillingSubscription::STATUS_CANCEL_SCHEDULED) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription is not scheduled for cancellation.',
            ], 422);
        }

        $subscription->update([
            'status' => BillingSubscription::STATUS_ACTIVE,
            'cancel_at_period_end_requested_at' => null,
            'cancellation_reason' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Subscription reactivated successfully.',
            'subscription' => $subscription,
        ]);
    }

    /**
     * FR-14-06: Billing Invoices History
     */
    public function getInvoices(Company $company)
    {
        $invoices = BillingInvoice::where('company_id', $company->id)
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'invoices' => $invoices,
        ]);
    }

    /**
     * FR-14-08: Idempotent Usage Metering
     */
    public function recordUsage(Request $request, Company $company)
    {
        $request->validate([
            'meter_key' => 'required|string',
            'quantity' => 'required|numeric|min:0',
            'idempotency_key' => 'required|string',
        ]);

        // Deduplication using unique idempotency key
        $record = BillingUsageRecord::firstOrCreate(
            ['idempotency_key' => $request->idempotency_key],
            [
                'company_id' => $company->id,
                'meter_key' => $request->meter_key,
                'quantity' => $request->quantity,
                'recorded_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'record_id' => $record->id,
            'is_duplicate' => !$record->wasRecentlyCreated,
        ]);
    }

    public function listPlans()
    {
        $plans = BillingPlan::where('is_active', true)
            ->with(['priceVersions' => function ($q) {
                $q->where('is_active', true);
            }, 'entitlements'])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $plans,
        ]);
    }

    public function currentSubscription(Company $company)
    {
        $res = $this->getSubscription($company)->getData(true);
        return response()->json([
            'status' => 'success',
            'data' => $res['subscription'] ?? null,
            'seat_metrics' => $res['seat_metrics'] ?? null,
            'entitlements' => $res['entitlements'] ?? [],
        ]);
    }

    public function initiateCheckout(Request $request, Company $company)
    {
        $plan = BillingPlan::findOrFail($request->plan_id);
        $request->merge(['target_plan_code' => $plan->plan_code]);
        return $this->changePlan($request, $company);
    }

    public function updateSeats(Request $request, Company $company)
    {
        $subscription = BillingSubscription::where('company_id', $company->id)->firstOrFail();
        $newSeats = $request->input('new_seat_count', $request->input('additional_seats', 25));

        $subscription->update([
            'purchased_seats' => $newSeats,
        ]);

        if ($subscription->seats) {
            $subscription->seats->update([
                'total_seats' => $newSeats,
                'last_reconciled_at' => now(),
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Seat capacity updated.',
            'data' => $subscription->fresh('seats'),
        ]);
    }

    public function invoices(Company $company)
    {
        $res = $this->getInvoices($company)->getData(true);
        return response()->json([
            'status' => 'success',
            'data' => $res['invoices'] ?? [],
        ]);
    }

    public function entitlements(Company $company)
    {
        $subscription = BillingSubscription::where('company_id', $company->id)->first();
        $entitlements = $subscription?->plan?->entitlements ?? [];

        return response()->json([
            'status' => 'success',
            'data' => $entitlements,
        ]);
    }
}

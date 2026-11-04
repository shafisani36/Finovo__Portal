<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingWebhookEvent;
use App\Models\BillingSubscription;
use App\Models\BillingInvoice;
use App\Models\Company;
use App\Services\Billing\EntitlementService;
use App\Services\Events\DomainEventDispatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BillingWebhookController extends Controller
{
    protected EntitlementService $entitlementService;
    protected DomainEventDispatcher $eventDispatcher;

    public function __construct(EntitlementService $entitlementService, DomainEventDispatcher $eventDispatcher)
    {
        $this->entitlementService = $entitlementService;
        $this->eventDispatcher = $eventDispatcher;
    }

    /**
     * FR-14-04 & Algorithm 14.D: Payment Webhook Processing
     */
    public function handleProviderWebhook(Request $request, string $provider = 'stripe')
    {
        $payload = $request->all();
        $eventId = $payload['id'] ?? $request->header('Stripe-Event-Id') ?? ('evt_' . md5(json_encode($payload)));
        $eventType = $payload['type'] ?? 'unknown.event';

        // 1. Deduplicate using provider's stable event identifier
        $existing = BillingWebhookEvent::where('event_id', $eventId)->first();
        if ($existing) {
            return response()->json(['status' => 'duplicate', 'received' => true, 'deduplicated' => true]);
        }

        // 2. Persist event durably before processing
        $eventLog = BillingWebhookEvent::create([
            'provider' => $provider,
            'event_id' => $eventId,
            'event_type' => $eventType,
            'payload' => $payload,
            'signature_hash' => hash('sha256', $request->getContent()),
            'status' => 'pending',
        ]);

        try {
            // Process according to event type
            switch ($eventType) {
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    $subId = $payload['data']['object']['id'] ?? null;
                    if ($subId) {
                        $subscription = BillingSubscription::where('provider_subscription_id', $subId)->first();
                        if ($subscription) {
                            $status = $payload['data']['object']['status'] ?? 'active';
                            $statusMap = [
                                'active' => BillingSubscription::STATUS_ACTIVE,
                                'trialing' => BillingSubscription::STATUS_TRIAL,
                                'past_due' => BillingSubscription::STATUS_PAST_DUE,
                                'canceled' => BillingSubscription::STATUS_CANCELED,
                                'unpaid' => BillingSubscription::STATUS_EXPIRED,
                            ];
                            $subscription->update([
                                'status' => $statusMap[$status] ?? BillingSubscription::STATUS_ACTIVE,
                            ]);
                            $this->entitlementService->invalidateEntitlements($subscription->company_id);
                        }
                    }
                    break;

                case 'invoice.payment_succeeded':
                    $invData = $payload['data']['object'] ?? [];
                    if (!empty($invData['customer'])) {
                        $sub = BillingSubscription::where('provider_customer_id', $invData['customer'])->first();
                        if ($sub) {
                            BillingInvoice::firstOrCreate(
                                ['invoice_number' => $invData['number'] ?? ('INV-' . rand(1000, 9999))],
                                [
                                    'company_id' => $sub->company_id,
                                    'subscription_id' => $sub->id,
                                    'provider_invoice_id' => $invData['id'] ?? null,
                                    'total' => ($invData['amount_paid'] ?? 0) / 100,
                                    'currency' => strtoupper($invData['currency'] ?? 'USD'),
                                    'status' => 'paid',
                                    'paid_at' => now(),
                                ]
                            );
                        }
                    }
                    break;
            }

            $eventLog->update([
                'status' => 'processed',
                'processed_at' => now(),
            ]);

            return response()->json(['received' => true, 'status' => 'processed']);
        } catch (\Exception $e) {
            $eventLog->update([
                'status' => 'failed',
                'processing_error' => $e->getMessage(),
            ]);
            Log::error("Billing Webhook processing error: {$e->getMessage()}");
            return response()->json(['received' => true, 'error' => $e->getMessage()], 500);
        }
    }
}

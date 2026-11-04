<?php

namespace App\Services\Integrations;

use App\Models\IntegrationOutboundWebhook;
use App\Models\IntegrationWebhookDelivery;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class OutboundWebhookDispatcher
{
    /**
     * Dispatch an outbound event to an active webhook endpoint with SSRF protection (NFR-15-12)
     */
    public function dispatchEvent(IntegrationOutboundWebhook $webhook, string $eventType, array $data): IntegrationWebhookDelivery
    {
        $deliveryUuid = (string) Str::uuid();
        $payload = [
            'event_id' => $deliveryUuid,
            'event_type' => $eventType,
            'occurred_at' => now()->toIso8601String(),
            'company_id' => $webhook->company_id,
            'data' => $data,
        ];

        $delivery = IntegrationWebhookDelivery::create([
            'outbound_webhook_id' => $webhook->id,
            'company_id' => $webhook->company_id,
            'event_type' => $eventType,
            'delivery_uuid' => $deliveryUuid,
            'payload' => $payload,
            'status' => 'pending',
            'attempts' => 1,
        ]);

        // SSRF Safety Check: Block private RFC1918 / loopback / link-local addresses
        if (!$this->isSafeUrl($webhook->target_url)) {
            $delivery->update([
                'status' => 'failed',
                'response_body' => 'Target URL blocked by SSRF Security Policy.',
            ]);
            return $delivery;
        }

        try {
            $signature = hash_hmac('sha256', json_encode($payload), $webhook->signing_secret);

            $response = Http::timeout(5)
                ->withHeaders([
                    'X-Finovo-Signature' => $signature,
                    'X-Finovo-Event' => $eventType,
                    'X-Finovo-Delivery' => $deliveryUuid,
                    'Content-Type' => 'application/json',
                ])
                ->post($webhook->target_url, $payload);

            $isSuccess = $response->successful();

            $delivery->update([
                'status' => $isSuccess ? 'delivered' : 'failed',
                'response_status' => $response->status(),
                'response_body' => Str::limit($response->body(), 1000),
                'delivered_at' => $isSuccess ? now() : null,
            ]);
        } catch (\Exception $e) {
            $delivery->update([
                'status' => 'failed',
                'response_body' => $e->getMessage(),
            ]);
        }

        return $delivery;
    }

    /**
     * SSRF URL Validation
     */
    protected function isSafeUrl(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return false;
        }

        $ip = gethostbyname($host);
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        // Filter private and reserved ranges
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;
    }
}

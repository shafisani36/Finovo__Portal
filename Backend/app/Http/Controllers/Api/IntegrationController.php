<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\IntegrationConnector;
use App\Models\IntegrationConnection;
use App\Models\IntegrationSyncRun;
use App\Models\IntegrationInboundWebhook;
use App\Models\IntegrationOutboundWebhook;
use App\Services\Integrations\IntegrationSyncService;
use App\Services\Integrations\OutboundWebhookDispatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class IntegrationController extends Controller
{
    protected IntegrationSyncService $syncService;
    protected OutboundWebhookDispatcher $dispatcher;

    public function __construct(IntegrationSyncService $syncService, OutboundWebhookDispatcher $dispatcher)
    {
        $this->syncService = $syncService;
        $this->dispatcher = $dispatcher;
    }

    /**
     * FR-15-01: Connector Catalog
     */
    public function getConnectors()
    {
        $connectors = IntegrationConnector::where('is_active', true)->get();

        return response()->json([
            'success' => true,
            'connectors' => $connectors,
        ]);
    }

    /**
     * FR-15-02: Organization Connections
     */
    public function getConnections(Company $company)
    {
        $connections = IntegrationConnection::where('company_id', $company->id)
            ->with('connector')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'connections' => $connections,
        ]);
    }

    /**
     * Connect or update external integration with encrypted credentials (NFR-15-01)
     */
    public function storeConnection(Request $request, Company $company)
    {
        $request->validate([
            'connector_id' => 'required|exists:integration_connectors,id',
            'name' => 'required|string|max:255',
            'credentials' => 'required|array',
            'configuration' => 'nullable|array',
        ]);

        $connection = IntegrationConnection::updateOrCreate(
            [
                'company_id' => $company->id,
                'connector_id' => $request->connector_id,
            ],
            [
                'name' => $request->name,
                'status' => 'connected',
                'credentials' => $request->credentials, // Uses encrypted mutator
                'configuration' => $request->configuration,
                'last_connected_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Integration connected successfully.',
            'connection' => $connection->fresh('connector'),
        ]);
    }

    /**
     * FR-15-03: Trigger Incremental Synchronization
     */
    public function triggerSync(Company $company, int $connectionId)
    {
        $connection = IntegrationConnection::where('company_id', $company->id)
            ->where('id', $connectionId)
            ->firstOrFail();

        $syncRun = $this->syncService->executeSync($connection);

        return response()->json([
            'success' => true,
            'message' => 'Synchronization finished.',
            'sync_run' => $syncRun,
        ]);
    }

    /**
     * FR-15-06: Sync Runs & Health History
     */
    public function getSyncRuns(Company $company, int $connectionId)
    {
        $runs = IntegrationSyncRun::where('company_id', $company->id)
            ->where('connection_id', $connectionId)
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'sync_runs' => $runs,
        ]);
    }

    /**
     * FR-15-04: Inbound Webhook Processing
     */
    public function handleInboundWebhook(Request $request, string $connectorKey)
    {
        $payload = $request->all();
        $eventId = $request->header('X-GitHub-Delivery') 
            ?? $payload['id'] 
            ?? ('evt_' . md5(json_encode($payload)));

        // Idempotency check
        $existing = IntegrationInboundWebhook::where('event_id', $eventId)->first();
        if ($existing) {
            return response()->json(['received' => true, 'deduplicated' => true]);
        }

        IntegrationInboundWebhook::create([
            'connector_key' => $connectorKey,
            'event_id' => $eventId,
            'event_type' => $request->header('X-GitHub-Event') ?? ($payload['type'] ?? 'generic.event'),
            'payload' => $payload,
            'signature' => $request->header('X-Hub-Signature-256') ?? $request->header('X-Signature'),
            'status' => 'processed',
            'processed_at' => now(),
        ]);

        return response()->json(['received' => true, 'status' => 'processed']);
    }

    /**
     * FR-15-07: Outbound Webhook Subscriptions
     */
    public function getOutboundWebhooks(Company $company)
    {
        $webhooks = IntegrationOutboundWebhook::where('company_id', $company->id)
            ->withCount('deliveries')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'webhooks' => $webhooks,
        ]);
    }
    public function listConnectors()
    {
        $connectors = IntegrationConnector::where('is_active', true)->get();
        return response()->json([
            'status' => 'success',
            'data' => $connectors,
        ]);
    }

    public function listConnections(Company $company)
    {
        $connections = IntegrationConnection::where('company_id', $company->id)
            ->with('connector')
            ->orderByDesc('created_at')
            ->get();
        return response()->json([
            'status' => 'success',
            'data' => $connections,
        ]);
    }

    public function createConnection(Request $request, Company $company)
    {
        return $this->storeConnection($request, $company);
    }

    public function syncRuns(Company $company, int $connection)
    {
        return $this->getSyncRuns($company, $connection);
    }

    public function listOutboundWebhooks(Company $company)
    {
        $webhooks = IntegrationOutboundWebhook::where('company_id', $company->id)
            ->withCount('deliveries')
            ->orderByDesc('created_at')
            ->get();
        return response()->json([
            'status' => 'success',
            'data' => $webhooks,
        ]);
    }

    public function registerOutboundWebhook(Request $request, Company $company)
    {
        $url = $request->input('destination_url', $request->input('target_url'));
        $name = $request->input('name', 'Outbound Webhook ' . parse_url($url, PHP_URL_HOST));
        $events = $request->input('subscribed_events', []);

        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['message' => 'Invalid webhook URL.'], 422);
        }

        // SSRF Check (NFR-15-12)
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host || $host === 'localhost' || str_ends_with($host, '.internal') || str_ends_with($host, '.local')) {
            return response()->json(['message' => 'SSRF violation: Internal destinations are prohibited.'], 422);
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return response()->json(['message' => 'SSRF violation: Internal or private IP destinations are prohibited.'], 422);
            }
        } else {
            $resolvedIp = gethostbyname($host);
            if ($resolvedIp !== $host && !filter_var($resolvedIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return response()->json(['message' => 'SSRF violation: Internal or private IP destinations are prohibited.'], 422);
            }
        }

        $webhook = IntegrationOutboundWebhook::create([
            'company_id' => $company->id,
            'name' => $name,
            'target_url' => $url,
            'signing_secret' => $request->input('secret_token', 'whsec_' . Str::random(32)),
            'subscribed_events' => $events,
            'is_active' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Outbound webhook registered.',
            'data' => $webhook,
        ], 201);
    }

    public function testOutboundWebhook(Company $company, int $webhookId)
    {
        $webhook = IntegrationOutboundWebhook::where('company_id', $company->id)
            ->where('id', $webhookId)
            ->firstOrFail();

        $delivery = $this->dispatcher->dispatchEvent($webhook, 'test.ping', [
            'message' => 'Finovo Integration Outbound Webhook Verification Ping',
            'timestamp' => now()->toIso8601String(),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $delivery,
        ]);
    }
}

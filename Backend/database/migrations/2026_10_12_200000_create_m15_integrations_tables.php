<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M15 Integrations Platform.
     */
    public function up(): void
    {
        // 1. Connector Catalog (Approved providers & metadata)
        Schema::create('integration_connectors', function (Blueprint $table) {
            $table->id();
            $table->string('connector_key')->unique(); // e.g. github, slack, google_calendar, stripe, custom_webhook
            $table->string('name');
            $table->string('category')->default('productivity'); // devops, communication, calendar, payments, crm
            $table->text('description')->nullable();
            $table->string('version')->default('1.0.0');
            $table->string('auth_type')->default('oauth2'); // oauth2, api_key, webhook_secret
            $table->string('icon_url')->nullable();
            $table->json('supported_events')->nullable();
            $table->json('supported_sync_directions')->nullable(); // inbound, outbound, bidirectional
            $table->integer('rate_limit_per_minute')->default(60);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Organization Connections (Encrypted credentials & state)
        Schema::create('integration_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('connector_id')->constrained('integration_connectors')->onDelete('restrict');
            $table->string('name');
            // Status: disconnected, connected, error, rate_limited, suspended
            $table->string('status')->default('disconnected')->index();
            $table->text('encrypted_credentials')->nullable(); // Encrypted at rest via Laravel Crypt
            $table->json('scopes')->nullable();
            $table->json('configuration')->nullable(); // Field mapping, sync interval, filter criteria
            $table->string('external_account_id')->nullable();
            $table->string('external_account_name')->nullable();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 3. Synchronization Runs (Durable sync jobs, leases, checkpoints)
        Schema::create('integration_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->constrained('integration_connections')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('resource_type')->index(); // e.g. issues, commits, calendar_events, contacts
            $table->string('direction')->default('inbound'); // inbound, outbound
            // Status: pending, running, completed, failed, partially_completed
            $table->string('status')->default('pending')->index();
            $table->string('lease_token')->nullable();
            $table->timestamp('lease_expires_at')->nullable();
            $table->integer('records_fetched')->default(0);
            $table->integer('records_processed')->default(0);
            $table->integer('records_failed')->default(0);
            $table->text('current_cursor')->nullable();
            $table->text('error_summary')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['connection_id', 'status']);
        });

        // 4. External Identity Mappings (Provider ID to Finovo domain record ID)
        Schema::create('integration_identity_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->constrained('integration_connections')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('resource_type')->index(); // e.g. task, project, user
            $table->string('external_id');
            $table->unsignedBigInteger('internal_id');
            $table->string('external_fingerprint')->nullable();
            $table->timestamp('last_synced_at')->useCurrent();
            $table->timestamps();

            $table->unique(['connection_id', 'resource_type', 'external_id'], 'conn_res_ext_unique');
            $table->index(['connection_id', 'resource_type', 'internal_id'], 'conn_res_int_index');
        });

        // 5. Inbound Webhook Events
        Schema::create('integration_inbound_webhooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->nullable()->constrained('integration_connections')->onDelete('cascade');
            $table->foreignId('company_id')->nullable()->constrained('companies')->onDelete('cascade');
            $table->string('connector_key')->index();
            $table->string('event_id')->unique(); // Provider event ID for deduplication
            $table->string('event_type')->index();
            $table->json('payload');
            $table->string('signature')->nullable();
            // Status: pending, processed, failed, ignored
            $table->string('status')->default('pending')->index();
            $table->text('processing_error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        // 6. Outbound Webhook Endpoints & Deliveries (with SSRF protection attributes)
        Schema::create('integration_outbound_webhooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('name');
            $table->string('target_url');
            $table->string('signing_secret');
            $table->json('subscribed_events'); // e.g. ["task.created", "project.completed", "invoice.paid"]
            $table->boolean('is_active')->default(true);
            $table->boolean('ssrf_validated')->default(true); // Must validate against private IP / intranet
            $table->integer('failure_count')->default(0);
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_active']);
        });

        Schema::create('integration_webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outbound_webhook_id')->constrained('integration_outbound_webhooks')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('event_type')->index();
            $table->string('delivery_uuid')->unique();
            $table->json('payload');
            $table->integer('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->integer('attempts')->default(0);
            $table->string('status')->default('pending'); // pending, delivered, failed
            $table->timestamp('scheduled_at')->useCurrent();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['outbound_webhook_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_webhook_deliveries');
        Schema::dropIfExists('integration_outbound_webhooks');
        Schema::dropIfExists('integration_inbound_webhooks');
        Schema::dropIfExists('integration_identity_mappings');
        Schema::dropIfExists('integration_sync_runs');
        Schema::dropIfExists('integration_connections');
        Schema::dropIfExists('integration_connectors');
    }
};

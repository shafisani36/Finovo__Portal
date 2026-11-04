<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M14 Subscription Billing & Entitlements.
     */
    public function up(): void
    {
        // 1. Subscription Plans Catalog
        Schema::create('billing_plans', function (Blueprint $table) {
            $table->id();
            $table->string('plan_code')->unique(); // e.g. starter, professional, enterprise
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('tier')->default('standard'); // standard, premium, enterprise
            $table->boolean('is_active')->default(true);
            $table->boolean('is_public')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // 2. Pricing Versions (Versioned pricing to never rewrite existing contractual terms)
        Schema::create('billing_price_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('billing_plans')->onDelete('cascade');
            $table->integer('version_number')->default(1);
            $table->string('billing_interval'); // monthly, annual
            $table->decimal('base_price', 12, 2)->default(0.00);
            $table->decimal('per_seat_price', 12, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->integer('included_seats')->default(5);
            $table->integer('trial_period_days')->default(14);
            $table->timestamp('effective_from')->useCurrent();
            $table->timestamp('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['plan_id', 'version_number', 'billing_interval'], 'plan_ver_interval_unique');
        });

        // 3. Plan Entitlements & Feature Limits
        Schema::create('billing_plan_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('billing_plans')->onDelete('cascade');
            $table->string('feature_key'); // e.g. max_projects, storage_gb, audit_retention_days, advanced_analytics, custom_integrations
            $table->string('value_type')->default('boolean'); // boolean, integer, string, unlimited
            $table->string('value'); // 'true', '50', 'unlimited'
            $table->string('description')->nullable();
            $table->timestamps();

            $table->unique(['plan_id', 'feature_key']);
        });

        // 4. Subscriptions Lifecycle State Machine
        Schema::create('billing_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('plan_id')->constrained('billing_plans')->onDelete('restrict');
            $table->foreignId('price_version_id')->constrained('billing_price_versions')->onDelete('restrict');
            $table->string('subscription_code')->unique();
            $table->string('provider')->default('stripe'); // stripe, paddle, manual
            $table->string('provider_subscription_id')->nullable()->index();
            $table->string('provider_customer_id')->nullable()->index();
            
            // Lifecycle States: draft, pending_checkout, incomplete, trial, active, past_due, cancel_scheduled, canceled, expired, review_hold
            $table->string('status')->default('trial')->index();
            $table->integer('purchased_seats')->default(5);
            $table->integer('additional_seats')->default(0);
            $table->string('billing_interval')->default('monthly'); // monthly, annual
            $table->decimal('current_price', 12, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');

            $table->timestamp('trial_starts_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_starts_at')->nullable();
            $table->timestamp('current_period_ends_at')->nullable();
            $table->timestamp('cancel_at_period_end_requested_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamp('grace_period_ends_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 5. Subscription Seat Quotas & Allocations
        Schema::create('billing_subscription_seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained('billing_subscriptions')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->integer('total_seats')->default(5);
            $table->integer('occupied_seats')->default(1);
            $table->integer('pending_invitations')->default(0);
            $table->timestamp('last_reconciled_at')->nullable();
            $table->timestamps();

            $table->unique('subscription_id');
        });

        // 6. Invoices & Billing History
        Schema::create('billing_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('subscription_id')->nullable()->constrained('billing_subscriptions')->onDelete('set null');
            $table->string('invoice_number')->unique();
            $table->string('provider_invoice_id')->nullable()->index();
            $table->decimal('subtotal', 12, 2)->default(0.00);
            $table->decimal('tax_amount', 12, 2)->default(0.00);
            $table->decimal('discount_amount', 12, 2)->default(0.00);
            $table->decimal('total', 12, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            // draft, open, paid, void, uncollectible
            $table->string('status')->default('draft')->index();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('hosted_invoice_url')->nullable();
            $table->string('invoice_pdf_url')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 7. Payment Transactions
        Schema::create('billing_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('invoice_id')->nullable()->constrained('billing_invoices')->onDelete('set null');
            $table->string('payment_reference')->unique();
            $table->string('provider_payment_id')->nullable()->index();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('USD');
            // pending, succeeded, failed, refunded
            $table->string('status')->default('pending')->index();
            $table->string('payment_method')->default('card'); // card, wire, sepa
            $table->string('last4')->nullable();
            $table->string('brand')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        // 8. Payment Webhook Event Log (Idempotent signature verification & deduplication)
        Schema::create('billing_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('stripe');
            $table->string('event_id')->unique(); // Provider event ID for deduplication
            $table->string('event_type')->index();
            $table->json('payload');
            $table->string('signature_hash')->nullable();
            $table->string('status')->default('pending'); // pending, processed, failed, ignored
            $table->text('processing_error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        // 9. Billable Usage Meters & Events
        Schema::create('billing_usage_meters', function (Blueprint $table) {
            $table->id();
            $table->string('meter_key')->unique(); // e.g. api_calls, storage_gb, compute_minutes
            $table->string('name');
            $table->string('aggregation_type')->default('sum'); // sum, max, count
            $table->decimal('unit_price', 10, 4)->default(0.0000);
            $table->timestamps();
        });

        Schema::create('billing_usage_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('meter_key')->index();
            $table->string('idempotency_key')->unique();
            $table->decimal('quantity', 14, 4);
            $table->timestamp('recorded_at')->useCurrent();
            $table->boolean('is_invoiced')->default(false);
            $table->timestamps();

            $table->index(['company_id', 'meter_key', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_usage_records');
        Schema::dropIfExists('billing_usage_meters');
        Schema::dropIfExists('billing_webhook_events');
        Schema::dropIfExists('billing_payments');
        Schema::dropIfExists('billing_invoices');
        Schema::dropIfExists('billing_subscription_seats');
        Schema::dropIfExists('billing_subscriptions');
        Schema::dropIfExists('billing_plan_entitlements');
        Schema::dropIfExists('billing_price_versions');
        Schema::dropIfExists('billing_plans');
    }
};

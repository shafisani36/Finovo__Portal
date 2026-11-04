<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M16 SaaS Administration & Platform Operations.
     */
    public function up(): void
    {
        // 1. Privileged Platform Roles & Capabilities
        Schema::create('platform_admin_roles', function (Blueprint $table) {
            $table->id();
            $table->string('role_key')->unique(); // super_admin, platform_ops, support_lead, billing_admin, security_auditor
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('permissions'); // e.g. ["tenant.manage", "subscription.override", "support.impersonate", "audit.view", "flags.manage"]
            $table->boolean('requires_mfa')->default(true);
            $table->timestamps();
        });

        // 2. Platform Admin Users (Separate from tenant users)
        Schema::create('platform_admin_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('role_id')->constrained('platform_admin_roles')->onDelete('restrict');
            $table->boolean('is_active')->default(true);
            $table->boolean('mfa_verified')->default(true);
            $table->timestamp('last_active_at')->nullable();
            $table->timestamp('access_expires_at')->nullable(); // For temporary / break-glass access
            $table->timestamps();

            $table->unique('user_id');
        });

        // 3. Controlled Tenant Support & Scoped Support Sessions
        Schema::create('platform_support_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->constrained('platform_admin_users')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('reason'); // Mandated ticket ID or customer request reason
            $table->string('session_token')->unique();
            // Status: requested, approved, active, expired, revoked
            $table->string('status')->default('active')->index();
            $table->foreignId('approved_by_admin_id')->nullable()->constrained('platform_admin_users')->onDelete('set null');
            $table->boolean('redacted_mode')->default(true); // Masks sensitive PII
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->text('revocation_reason')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 4. Immutable Platform-Wide Audit Trail
        Schema::create('platform_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->nullable()->constrained('platform_admin_users')->onDelete('set null');
            $table->foreignId('company_id')->nullable()->constrained('companies')->onDelete('set null');
            $table->string('event_type')->index(); // e.g. tenant.suspended, subscription.overridden, support.accessed
            $table->string('target_entity_type')->nullable();
            $table->unsignedBigInteger('target_entity_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('correlation_id')->nullable()->index();
            $table->json('payload')->nullable();
            $table->string('hash', 64)->nullable(); // Tamper-evident hash
            $table->timestamp('recorded_at')->useCurrent();

            $table->index(['event_type', 'recorded_at']);
        });

        // 5. Feature Flags & Staged Rollout Cohorts
        Schema::create('platform_feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('flag_key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_enabled_globally')->default(false);
            $table->integer('rollout_percentage')->default(0); // 0 - 100
            $table->json('allowed_company_ids')->nullable(); // Whitelisted tenants
            $table->json('rules')->nullable(); // Custom targeting criteria
            $table->timestamps();
        });

        // 6. Platform Incidents & Health Status
        Schema::create('platform_incidents', function (Blueprint $table) {
            $table->id();
            $table->string('incident_number')->unique();
            $table->string('title');
            $table->text('summary')->nullable();
            // Severity: low, medium, high, critical
            $table->string('severity')->default('medium')->index();
            // Status: investigating, identified, monitoring, resolved
            $table->string('status')->default('investigating')->index();
            $table->string('affected_component')->default('core_api'); // core_api, database, queues, integrations, billing
            $table->foreignId('lead_admin_id')->nullable()->constrained('platform_admin_users')->onDelete('set null');
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('platform_incident_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained('platform_incidents')->onDelete('cascade');
            $table->foreignId('admin_user_id')->nullable()->constrained('platform_admin_users')->onDelete('set null');
            $table->string('status'); // investigating, identified, monitoring, resolved
            $table->text('message');
            $table->timestamp('posted_at')->useCurrent();
            $table->timestamps();
        });

        // 7. Platform Telemetry & Health Metrics
        Schema::create('platform_health_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('metric_name')->index(); // e.g. api_p95_latency_ms, queue_depth, error_rate_percent, db_connections
            $table->decimal('value', 14, 4);
            $table->string('unit')->default('ms');
            $table->json('tags')->nullable();
            $table->timestamp('sampled_at')->useCurrent();

            $table->index(['metric_name', 'sampled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_health_metrics');
        Schema::dropIfExists('platform_incident_updates');
        Schema::dropIfExists('platform_incidents');
        Schema::dropIfExists('platform_feature_flags');
        Schema::dropIfExists('platform_audit_events');
        Schema::dropIfExists('platform_support_sessions');
        Schema::dropIfExists('platform_admin_users');
        Schema::dropIfExists('platform_admin_roles');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Extend companies (tenants) with uuid, deleted_at
        if (Schema::hasTable('companies')) {
            Schema::table('companies', function (Blueprint $table) {
                if (!Schema::hasColumn('companies', 'uuid')) {
                    $table->char('uuid', 36)->nullable()->after('id');
                }
                if (!Schema::hasColumn('companies', 'deleted_at')) {
                    $table->softDeletes()->after('updated_at');
                }
            });

            // Backfill existing companies with UUIDv4 if missing
            $companies = DB::table('companies')->whereNull('uuid')->get();
            foreach ($companies as $company) {
                DB::table('companies')->where('id', $company->id)->update([
                    'uuid' => (string) Str::uuid(),
                ]);
            }

            // Apply unique constraint to uuid
            Schema::table('companies', function (Blueprint $table) {
                $table->unique('uuid', 'uq_companies_uuid');
            });
        }

        // 2. Custom vanity domains & TLS tracking
        if (!Schema::hasTable('tenant_domains')) {
            Schema::create('tenant_domains', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
                $table->string('domain', 190)->unique();
                $table->boolean('is_primary')->default(false);
                $table->enum('verification_status', ['pending', 'verified', 'failed'])->default('pending');
                $table->string('verification_token', 64)->nullable();
                $table->enum('ssl_status', ['pending', 'active', 'expired', 'failed'])->default('pending');
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'is_primary'], 'ix_tenant_domains_company');
            });
        }

        // 3. Granular plan feature entitlements and quotas
        if (!Schema::hasTable('plan_entitlements')) {
            Schema::create('plan_entitlements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
                $table->string('feature_code', 64);
                $table->boolean('is_enabled')->default(true);
                $table->unsignedInteger('quota_limit')->nullable(); // NULL = unlimited
                $table->string('override_reason', 255)->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'feature_code'], 'uq_entitlement_company_feature');
            });
        }

        // 4. Real-time usage tracking counters
        if (!Schema::hasTable('tenant_usage_counters')) {
            Schema::create('tenant_usage_counters', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
                $table->string('meter_code', 64);
                $table->unsignedBigInteger('current_value')->default(0);
                $table->timestamp('period_start')->nullable();
                $table->timestamp('period_end')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'meter_code'], 'uq_usage_company_meter');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_usage_counters');
        Schema::dropIfExists('plan_entitlements');
        Schema::dropIfExists('tenant_domains');

        if (Schema::hasTable('companies')) {
            Schema::table('companies', function (Blueprint $table) {
                if (Schema::hasColumn('companies', 'uuid')) {
                    $table->dropUnique('uq_companies_uuid');
                    $table->dropColumn('uuid');
                }
                if (Schema::hasColumn('companies', 'deleted_at')) {
                    $table->dropSoftDeletes();
                }
            });
        }
    }
};

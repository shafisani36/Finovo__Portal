<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\DTOs\TenantRegistrationData;
use App\Domain\Organization\Events\TenantProvisioned;
use App\Domain\Organization\Exceptions\DuplicateWorkspaceSlugException;
use App\Models\BillingSubscription;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompanySettings;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProvisionTenantAction
{
    /**
     * Atomically provisions a new organization workspace, owner membership, baseline settings, and trial subscription
     *
     * @throws DuplicateWorkspaceSlugException
     */
    public function execute(TenantRegistrationData $data, User $owner): Company
    {
        $normalizedSlug = Str::slug($data->workspaceSlug);

        // Pre-transaction check (database uniqueness constraint guarantees final concurrency safety)
        if (Company::where('slug', $normalizedSlug)->exists()) {
            throw new DuplicateWorkspaceSlugException($normalizedSlug);
        }

        return DB::transaction(function () use ($data, $owner, $normalizedSlug) {
            // 1. Authoritative Tenant Record
            $company = Company::create([
                'uuid' => (string) Str::uuid(),
                'name' => $data->name,
                'slug' => $normalizedSlug,
                'status' => 'active',
                'timezone' => $data->timezone ?? 'UTC',
                'locale' => $data->locale ?? 'en-US',
                'logo_path' => $data->logoPath,
            ]);

            // 2. Owner Membership Binding
            CompanyMembership::create([
                'company_id' => $company->id,
                'user_id' => $owner->id,
                'status' => 'active',
                'membership_type' => 'owner',
                'joined_at' => now(),
            ]);

            // 3. Organization Baseline Configuration
            CompanySettings::create([
                'company_id' => $company->id,
                'working_days' => json_encode(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
                'fiscal_year_start' => '01-01',
                'allow_employee_invites' => true,
                'enforce_mfa' => false,
                'session_timeout_minutes' => 1440,
                'date_format' => 'YYYY-MM-DD',
                'time_format' => '12h',
            ]);

            // 4. Initial Plan Subscription (14-day trial)
            $plan = \App\Models\BillingPlan::where('plan_code', $data->planCode ?? 'starter')->first()
                ?? \App\Models\BillingPlan::where('plan_code', 'starter')->first()
                ?? \App\Models\BillingPlan::first();

            $priceVersion = \App\Models\BillingPriceVersion::where('plan_id', $plan?->id)->first();

            $subscription = BillingSubscription::create([
                'company_id' => $company->id,
                'plan_id' => $plan?->id,
                'price_version_id' => $priceVersion?->id,
                'subscription_code' => 'sub_' . Str::random(16),
                'provider' => 'internal',
                'status' => 'trial',
                'purchased_seats' => $data->planCode === 'enterprise' ? 100 : ($data->planCode === 'professional' ? 50 : 10),
                'additional_seats' => 0,
                'billing_interval' => 'monthly',
                'current_price' => 0.00,
                'currency' => 'USD',
                'trial_starts_at' => now(),
                'trial_ends_at' => now()->addDays(14),
                'current_period_starts_at' => now(),
                'current_period_ends_at' => now()->addDays(14),
                'metadata' => ['plan_code' => $data->planCode ?? 'starter'],
            ]);

            if ($subscription) {
                \App\Models\BillingSubscriptionSeat::create([
                    'subscription_id' => $subscription->id,
                    'company_id' => $company->id,
                    'total_seats' => $subscription->purchased_seats,
                    'occupied_seats' => 1,
                    'pending_invitations' => 0,
                    'last_reconciled_at' => now(),
                ]);
            }

            // 5. Transactional Outbox Event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'event_type' => TenantProvisioned::class,
                'schema_version' => 1,
                'company_id' => $company->id,
                'correlation_id' => $data->idempotencyKey ?? (string) Str::uuid(),
                'producer' => 'm01_tenant_management',
                'payload' => json_encode([
                    'tenant_id' => $company->id,
                    'tenant_uuid' => $company->uuid,
                    'workspace_slug' => $company->slug,
                    'organization_name' => $company->name,
                    'owner_user_id' => $owner->id,
                    'plan_code' => $data->planCode ?? 'starter',
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $company;
        });
    }
}

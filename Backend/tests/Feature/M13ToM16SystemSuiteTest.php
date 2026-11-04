<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Role;
use App\Models\User;
use App\Models\PlatformAdminRole;
use App\Models\PlatformAdminUser;
use App\Models\Task;
use App\Models\Project;
use Database\Seeders\M13ToM16Seeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class M13ToM16SystemSuiteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(M13ToM16Seeder::class);
    }

    private function createTenantContext(): array
    {
        $user = User::factory()->create();
        $company = Company::create([
            'name' => 'Acme Corporation',
            'slug' => 'acme-corp-' . uniqid(),
            'status' => 'active',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();
        $membership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $membership->roles()->sync([$ownerRole->id]);

        $plan = \App\Models\BillingPlan::where('plan_code', 'professional')->first() ?? \App\Models\BillingPlan::first();
        $priceVersion = $plan ? $plan->priceVersions()->first() : null;
        if ($plan && $priceVersion) {
            $sub = \App\Models\BillingSubscription::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'price_version_id' => $priceVersion->id,
                'subscription_code' => 'SUB-' . strtoupper(uniqid()),
                'provider' => 'stripe',
                'provider_subscription_id' => 'sub_' . uniqid(),
                'status' => 'active',
                'purchased_seats' => 25,
                'billing_interval' => 'monthly',
                'current_price' => 289.00,
                'currency' => 'USD',
                'current_period_starts_at' => now()->startOfMonth(),
                'current_period_ends_at' => now()->endOfMonth(),
            ]);

            \App\Models\BillingSubscriptionSeat::create([
                'company_id' => $company->id,
                'subscription_id' => $sub->id,
                'total_seats' => 25,
                'occupied_seats' => 1,
            ]);
        }

        return [$user, $company];
    }

    /**
     * M14: Subscription billing plans and checkout
     */
    public function test_m14_subscription_billing_lifecycle(): void
    {
        [$user, $company] = $this->createTenantContext();
        Sanctum::actingAs($user);

        // 1. Fetch plans
        $plansRes = $this->getJson("/api/v1/companies/{$company->slug}/billing/plans");
        $plansRes->assertStatus(200);
        $this->assertNotEmpty($plansRes->json('data'));

        // 2. Fetch current subscription
        $subRes = $this->getJson("/api/v1/companies/{$company->slug}/billing/subscription");
        $subRes->assertStatus(200);

        // 3. Update seats
        $seatRes = $this->postJson("/api/v1/companies/{$company->slug}/billing/subscription/seats", [
            'new_seat_count' => 30,
        ]);
        $seatRes->assertStatus(200);
        $this->assertEquals(30, $seatRes->json('data.purchased_seats'));
    }

    /**
     * M14: Webhook idempotency
     */
    public function test_m14_webhook_idempotency_duplicate_handling(): void
    {
        $payload = [
            'id' => 'evt_test_unique_1001',
            'type' => 'invoice.payment_succeeded',
            'data' => [
                'object' => [
                    'id' => 'in_test_999',
                    'customer' => 'cus_test',
                    'amount_paid' => 28900,
                    'currency' => 'usd',
                ],
            ],
        ];

        // First delivery
        $res1 = $this->postJson('/api/v1/webhooks/billing/stripe', $payload);
        $res1->assertStatus(200);

        // Duplicate delivery should be safely handled as duplicate
        $res2 = $this->postJson('/api/v1/webhooks/billing/stripe', $payload);
        $res2->assertStatus(200);
        $this->assertEquals('duplicate', $res2->json('status'));
    }

    /**
     * M15: Integrations platform connector listing and SSRF egress blocking
     */
    public function test_m15_integrations_and_ssrf_egress_protection(): void
    {
        [$user, $company] = $this->createTenantContext();
        Sanctum::actingAs($user);

        // 1. List connectors
        $connRes = $this->getJson("/api/v1/companies/{$company->slug}/integrations/connectors");
        $connRes->assertStatus(200);
        $this->assertNotEmpty($connRes->json('data'));

        // 2. Register SSRF-blocked outbound webhook (127.0.0.1 must be rejected)
        $ssrfRes = $this->postJson("/api/v1/companies/{$company->slug}/integrations/webhooks/outbound", [
            'destination_url' => 'http://127.0.0.1:8000/internal-bypass',
            'secret_token' => 'whsec_secret_123',
            'subscribed_events' => ['task.created'],
        ]);
        $ssrfRes->assertStatus(422);

        // 3. Register valid public outbound webhook
        $validRes = $this->postJson("/api/v1/companies/{$company->slug}/integrations/webhooks/outbound", [
            'destination_url' => 'https://api.acme-corp.com/webhooks/finovo',
            'secret_token' => 'whsec_secret_123',
            'subscribed_events' => ['task.created'],
        ]);
        $validRes->assertStatus(201);
    }

    /**
     * M16: Platform administration privilege separation
     */
    public function test_m16_privileged_access_separation(): void
    {
        [$regularUser, $company] = $this->createTenantContext();

        // Regular tenant user should be denied access to platform endpoints
        Sanctum::actingAs($regularUser);
        $deniedRes = $this->getJson('/api/v1/platform/telemetry');
        $deniedRes->assertStatus(403);

        // Platform Admin user should be granted access
        $superAdmin = User::factory()->create(['email' => 'operator@finovo.internal']);
        $adminRole = PlatformAdminRole::where('role_key', 'super_admin')->first();
        PlatformAdminUser::create([
            'user_id' => $superAdmin->id,
            'role_id' => $adminRole->id,
            'is_active' => true,
            'mfa_verified' => true,
        ]);

        Sanctum::actingAs($superAdmin);
        $telRes = $this->getJson('/api/v1/platform/telemetry');
        $telRes->assertStatus(200);
        $this->assertArrayHasKey('tenants_count', $telRes->json('data'));

        // Tenant lifecycle inspection
        $tenantsRes = $this->getJson('/api/v1/platform/tenants');
        $tenantsRes->assertStatus(200);
    }

    /**
     * M13: Reporting & Analytics deterministic snapshots and Finobo query
     */
    public function test_m13_kpi_catalog_and_finobo_query(): void
    {
        [$user, $company] = $this->createTenantContext();
        Sanctum::actingAs($user);

        // Create project and task to calculate metric
        $project = Project::create([
            'company_id' => $company->id,
            'project_code' => 'DELIV-' . rand(100, 999),
            'name' => 'Delivery Core Sprint',
            'status' => 'in_progress',
        ]);

        $membership = $company->memberships()->first();

        Task::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'creator_membership_id' => $membership->id,
            'task_code' => 'TASK-' . rand(100, 999),
            'title' => 'Test Delivery Task 1',
            'status' => 'completed',
            'priority' => 'high',
            'due_at' => now(),
        ]);

        // 1. KPI catalog
        $catRes = $this->getJson("/api/v1/companies/{$company->slug}/analytics/catalog");
        $catRes->assertStatus(200);
        $this->assertNotEmpty($catRes->json('data'));

        // 2. Compute KPI snapshot
        $snapRes = $this->getJson("/api/v1/companies/{$company->slug}/analytics/kpis/task_completion_rate/snapshot");
        $snapRes->assertStatus(200);
        $this->assertEquals(100.0, $snapRes->json('data.metric_value'));
        $this->assertEquals('verified', $snapRes->json('data.quality_status'));

        // 3. Finobo AI analytical interface
        $finoboRes = $this->postJson("/api/v1/companies/{$company->slug}/analytics/finobo/query", [
            'intent' => 'Explain current delivery velocity',
            'kpi_code' => 'task_completion_rate',
            'date_range' => '30d',
        ]);
        $finoboRes->assertStatus(200);
        $this->assertArrayHasKey('lineage', $finoboRes->json('data'));
        $this->assertArrayHasKey('projected_trend', $finoboRes->json('data'));
    }
}

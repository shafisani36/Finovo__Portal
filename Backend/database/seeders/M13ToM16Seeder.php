<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\BillingPlan;
use App\Models\BillingPriceVersion;
use App\Models\BillingPlanEntitlement;
use App\Models\BillingSubscription;
use App\Models\BillingSubscriptionSeat;
use App\Models\IntegrationConnector;
use App\Models\PlatformAdminRole;
use App\Models\PlatformAdminUser;
use App\Models\AnalyticsKpi;
use App\Models\AnalyticsKpiVersion;
use App\Models\Company;
use App\Models\User;

class M13ToM16Seeder extends Seeder
{
    public function run(): void
    {
        // ==========================================
        // 1. M14: Plan & Price Catalog
        // ==========================================
        $starter = BillingPlan::firstOrCreate(
            ['plan_code' => 'starter'],
            [
                'name' => 'Starter Team',
                'description' => 'Essential tools for small agencies and growing teams up to 10 seats.',
                'tier' => 'standard',
                'is_active' => true,
                'is_public' => true,
                'sort_order' => 1,
            ]
        );

        BillingPriceVersion::firstOrCreate(
            ['plan_id' => $starter->id, 'version_number' => 1, 'billing_interval' => 'monthly'],
            [
                'base_price' => 49.00,
                'per_seat_price' => 8.00,
                'currency' => 'USD',
                'included_seats' => 5,
                'trial_period_days' => 14,
                'effective_from' => now(),
                'is_active' => true,
            ]
        );

        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $starter->id, 'feature_key' => 'max_projects'],
            ['value_type' => 'integer', 'value' => '25', 'description' => 'Maximum active projects']
        );
        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $starter->id, 'feature_key' => 'storage_gb'],
            ['value_type' => 'integer', 'value' => '50', 'description' => 'Encrypted document storage']
        );
        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $starter->id, 'feature_key' => 'custom_integrations'],
            ['value_type' => 'boolean', 'value' => 'false', 'description' => 'Third-party integrations']
        );

        $pro = BillingPlan::firstOrCreate(
            ['plan_code' => 'professional'],
            [
                'name' => 'Professional Growth',
                'description' => 'Complete enterprise workforce analytics, custom workflows, and integrations.',
                'tier' => 'premium',
                'is_active' => true,
                'is_public' => true,
                'sort_order' => 2,
            ]
        );

        BillingPriceVersion::firstOrCreate(
            ['plan_id' => $pro->id, 'version_number' => 1, 'billing_interval' => 'monthly'],
            [
                'base_price' => 149.00,
                'per_seat_price' => 14.00,
                'currency' => 'USD',
                'included_seats' => 15,
                'trial_period_days' => 14,
                'effective_from' => now(),
                'is_active' => true,
            ]
        );

        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $pro->id, 'feature_key' => 'max_projects'],
            ['value_type' => 'unlimited', 'value' => 'unlimited', 'description' => 'Unlimited active projects']
        );
        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $pro->id, 'feature_key' => 'storage_gb'],
            ['value_type' => 'integer', 'value' => '250', 'description' => 'Encrypted document storage']
        );
        BillingPlanEntitlement::firstOrCreate(
            ['plan_id' => $pro->id, 'feature_key' => 'custom_integrations'],
            ['value_type' => 'boolean', 'value' => 'true', 'description' => 'Third-party integrations']
        );

        // Ensure default active subscription for demo company (finovo-global)
        $demoCompany = Company::where('slug', 'finovo-global')->first() ?? Company::first();
        if ($demoCompany) {
            $sub = BillingSubscription::firstOrCreate(
                ['company_id' => $demoCompany->id],
                [
                    'plan_id' => $pro->id,
                    'price_version_id' => $pro->priceVersions()->first()->id,
                    'subscription_code' => 'SUB-FINOVO-PRO-01',
                    'provider' => 'stripe',
                    'provider_subscription_id' => 'sub_demo_finovo_1001',
                    'status' => 'active',
                    'purchased_seats' => 25,
                    'billing_interval' => 'monthly',
                    'current_price' => 289.00,
                    'currency' => 'USD',
                    'current_period_starts_at' => now()->startOfMonth(),
                    'current_period_ends_at' => now()->endOfMonth(),
                ]
            );

            BillingSubscriptionSeat::firstOrCreate(
                ['subscription_id' => $sub->id],
                [
                    'company_id' => $demoCompany->id,
                    'total_seats' => 25,
                    'occupied_seats' => 12,
                    'pending_invitations' => 2,
                    'last_reconciled_at' => now(),
                ]
            );
        }

        // ==========================================
        // 2. M15: Integrations Connector Catalog
        // ==========================================
        $connectors = [
            [
                'connector_key' => 'github',
                'name' => 'GitHub',
                'category' => 'devops',
                'description' => 'Sync repositories, issues, branches and link commit evidence directly to tasks.',
                'version' => '2.1.0',
                'auth_type' => 'oauth2',
                'supported_events' => ['push', 'pull_request', 'issues', 'issue_comment'],
                'supported_sync_directions' => ['bidirectional'],
                'rate_limit_per_minute' => 120,
            ],
            [
                'connector_key' => 'slack',
                'name' => 'Slack',
                'category' => 'communication',
                'description' => 'Instant task notifications, escalation alerts, and automated review gates.',
                'version' => '1.4.0',
                'auth_type' => 'oauth2',
                'supported_events' => ['message', 'app_mention'],
                'supported_sync_directions' => ['outbound'],
                'rate_limit_per_minute' => 60,
            ],
            [
                'connector_key' => 'google_calendar',
                'name' => 'Google Calendar',
                'category' => 'calendar',
                'description' => 'Bi-directional employee shift synchronization, approved leaves, and milestone deadlines.',
                'version' => '1.0.0',
                'auth_type' => 'oauth2',
                'supported_events' => ['event.created', 'event.updated', 'event.cancelled'],
                'supported_sync_directions' => ['bidirectional'],
                'rate_limit_per_minute' => 60,
            ],
            [
                'connector_key' => 'stripe',
                'name' => 'Stripe Payments',
                'category' => 'payments',
                'description' => 'Seamless subscription checkout, automatic renewals, and webhook reconciliation.',
                'version' => '3.0.0',
                'auth_type' => 'webhook_secret',
                'supported_events' => ['invoice.payment_succeeded', 'customer.subscription.updated', 'charge.failed'],
                'supported_sync_directions' => ['inbound'],
                'rate_limit_per_minute' => 300,
            ],
            [
                'connector_key' => 'custom_webhook',
                'name' => 'Custom Webhooks',
                'category' => 'crm',
                'description' => 'Deliver signed real-time business events with SSRF protection and retry policies.',
                'version' => '1.0.0',
                'auth_type' => 'api_key',
                'supported_events' => ['task.completed', 'invoice.issued', 'employee.onboarded'],
                'supported_sync_directions' => ['outbound'],
                'rate_limit_per_minute' => 100,
            ],
        ];

        foreach ($connectors as $c) {
            IntegrationConnector::firstOrCreate(
                ['connector_key' => $c['connector_key']],
                $c
            );
        }

        // ==========================================
        // 3. M16: Platform Admin Roles
        // ==========================================
        $adminRoles = [
            [
                'role_key' => 'super_admin',
                'name' => 'Platform SuperAdministrator',
                'description' => 'Unrestricted platform oversight, tenant state management, and incident response.',
                'permissions' => ['*'],
                'requires_mfa' => true,
            ],
            [
                'role_key' => 'platform_ops',
                'name' => 'Platform Operations Engineer',
                'description' => 'System telemetry, queue health, incident remediation, and feature flag management.',
                'permissions' => ['telemetry.view', 'incidents.manage', 'queues.manage', 'flags.manage'],
                'requires_mfa' => true,
            ],
            [
                'role_key' => 'support_lead',
                'name' => 'Customer Support Lead',
                'description' => 'Time-limited, redacted tenant investigation with approval gating.',
                'permissions' => ['support.session.request', 'support.session.view', 'tenant.inspect'],
                'requires_mfa' => true,
            ],
            [
                'role_key' => 'billing_admin',
                'name' => 'SaaS Billing Specialist',
                'description' => 'Plan management, subscription overrides, and payment discrepancy reconciliation.',
                'permissions' => ['billing.plans.manage', 'billing.subscriptions.override', 'billing.reconcile'],
                'requires_mfa' => true,
            ],
        ];

        $superRole = null;
        foreach ($adminRoles as $r) {
            $roleObj = PlatformAdminRole::firstOrCreate(
                ['role_key' => $r['role_key']],
                $r
            );
            if ($r['role_key'] === 'super_admin') {
                $superRole = $roleObj;
            }
        }

        // Enroll SuperAdmin user in platform_admin_users if exists
        $adminUser = User::where('email', 'superadmin@finovo.internal')->first();
        if ($adminUser && $superRole) {
            PlatformAdminUser::firstOrCreate(
                ['user_id' => $adminUser->id],
                [
                    'role_id' => $superRole->id,
                    'is_active' => true,
                    'mfa_verified' => true,
                    'last_active_at' => now(),
                ]
            );
        }

        // ==========================================
        // 4. M13: Central KPI Definitions & Versions
        // ==========================================
        $kpis = [
            [
                'kpi_code' => 'task_completion_rate',
                'name' => 'Task Completion Rate',
                'domain' => 'delivery',
                'description' => 'Percentage of scheduled tasks completed within their defined deadline period.',
                'unit' => 'percent',
                'formula' => '(completed_tasks_in_period / due_tasks_in_period) * 100',
            ],
            [
                'kpi_code' => 'employee_utilization',
                'name' => 'Employee Utilization',
                'domain' => 'workforce',
                'description' => 'Ratio of verified billable logged project hours over total available working capacity.',
                'unit' => 'percent',
                'formula' => '(billable_hours / available_capacity_hours) * 100',
            ],
            [
                'kpi_code' => 'project_gross_margin',
                'name' => 'Project Gross Margin',
                'domain' => 'finance',
                'description' => 'Net financial margin realized on completed deliverables minus direct labor costs.',
                'unit' => 'percent',
                'formula' => '((invoiced_revenue - labor_cost) / invoiced_revenue) * 100',
            ],
            [
                'kpi_code' => 'sprint_delivery_velocity',
                'name' => 'Sprint Delivery Velocity',
                'domain' => 'operations',
                'description' => 'Total story points and task weight delivered per active cycle.',
                'unit' => 'count',
                'formula' => 'sum(completed_task_weights)',
            ],
        ];

        foreach ($kpis as $k) {
            $kpiObj = AnalyticsKpi::firstOrCreate(
                ['kpi_code' => $k['kpi_code']],
                [
                    'name' => $k['name'],
                    'domain' => $k['domain'],
                    'description' => $k['description'],
                    'unit' => $k['unit'],
                    'supported_dimensions' => ['department', 'project', 'client', 'assignee'],
                    'is_active' => true,
                ]
            );

            AnalyticsKpiVersion::firstOrCreate(
                ['kpi_id' => $kpiObj->id, 'version_number' => 1],
                [
                    'calculation_method' => 'formula',
                    'formula_expression' => $k['formula'],
                    'required_permission' => 'analytics.view',
                    'effective_from' => now()->subYear(),
                ]
            );
        }
    }
}

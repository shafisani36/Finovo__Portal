<?php

namespace App\Domain\Organization\Http\Controllers;

use App\Domain\Organization\Actions\ExportTenantDataAction;
use App\Domain\Organization\Actions\ProvisionTenantAction;
use App\Domain\Organization\Actions\SuspendTenantAction;
use App\Domain\Organization\Actions\UpdateTenantProfileAction;
use App\Domain\Organization\DTOs\TenantProfileUpdateData;
use App\Domain\Organization\DTOs\TenantRegistrationData;
use App\Domain\Organization\Exceptions\DuplicateWorkspaceSlugException;
use App\Domain\Organization\Exceptions\TenantNotFoundException;
use App\Domain\Organization\Exceptions\TenantSuspendedException;
use App\Domain\Organization\Policies\TenantPolicy;
use App\Domain\Organization\Services\SubscriptionEntitlementService;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Http\Controllers\Controller;
use App\Models\CompanySettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrganizationController extends Controller
{
    public function __construct(
        private readonly TenantContextResolver $contextResolver,
        private readonly ProvisionTenantAction $provisionAction,
        private readonly UpdateTenantProfileAction $updateAction,
        private readonly SuspendTenantAction $suspendAction,
        private readonly ExportTenantDataAction $exportAction,
        private readonly SubscriptionEntitlementService $entitlementService,
        private readonly TenantPolicy $policy,
    ) {}

    /**
     * POST /api/v1/organizations
     * Provision a new organization workspace
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:180',
            'workspace_slug' => 'required|string|max:80|regex:/^[a-z0-9\-]+$/i',
            'timezone' => 'nullable|string|max:64',
            'locale' => 'nullable|string|max:12',
            'plan_code' => 'nullable|string|in:starter,professional,enterprise',
            'logo_path' => 'nullable|string|max:255',
        ]);

        $idempotencyKey = $request->header('Idempotency-Key') ?? $request->input('idempotency_key');
        $dto = TenantRegistrationData::fromArray(array_merge($validated, ['idempotency_key' => $idempotencyKey]));

        try {
            $tenant = $this->provisionAction->execute($dto, $user);

            return response()->json([
                'data' => [
                    'id' => $tenant->uuid ?? (string) $tenant->id,
                    'name' => $tenant->name,
                    'workspace_slug' => $tenant->slug,
                    'status' => $tenant->status,
                    'timezone' => $tenant->timezone,
                    'locale' => $tenant->locale,
                    'subscription' => [
                        'plan_code' => $dto->planCode,
                        'status' => 'trialing',
                        'seat_limit' => $tenant->subscription?->purchased_seats ?? 10,
                        'trial_ends_at' => $tenant->subscription?->trial_ends_at?->toIso8601String(),
                    ],
                ],
                'meta' => [
                    'request_id' => (string) Str::uuid(),
                ],
            ], 201);
        } catch (DuplicateWorkspaceSlugException $e) {
            return response()->json([
                'error' => [
                    'code' => 'WORKSPACE_SLUG_TAKEN',
                    'message' => $e->getMessage(),
                ],
            ], 422);
        }
    }

    /**
     * GET /api/v1/organizations/current
     * Retrieve authenticated organization workspace profile
     */
    public function current(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            $subscription = $company->subscription;
            $activeEmployeesCount = $company->memberships()->where('status', 'active')->count();

            return response()->json([
                'data' => [
                    'id' => $company->uuid ?? (string) $company->id,
                    'name' => $company->name,
                    'workspace_slug' => $company->slug,
                    'status' => $company->status,
                    'timezone' => $company->timezone,
                    'locale' => $company->locale,
                    'logo_path' => $company->logo_path,
                    'subscription' => [
                        'status' => $subscription?->status ?? 'active',
                        'plan_code' => $subscription?->metadata ? (json_decode($subscription->metadata, true)['plan_code'] ?? 'professional') : 'professional',
                        'purchased_seats' => $subscription ? ($subscription->purchased_seats + $subscription->additional_seats) : 10,
                        'active_seats_used' => $activeEmployeesCount,
                        'trial_ends_at' => $subscription?->trial_ends_at?->toIso8601String(),
                        'period_ends_at' => $subscription?->current_period_ends_at?->toIso8601String(),
                    ],
                ],
                'meta' => [
                    'request_id' => (string) Str::uuid(),
                ],
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        } catch (TenantSuspendedException $e) {
            return response()->json(['error' => ['code' => 'TENANT_SUSPENDED', 'message' => $e->getMessage()]], 403);
        }
    }

    /**
     * PATCH /api/v1/organizations/current
     * Update organization profile
     */
    public function update(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            if (!$this->policy->update($request->user(), $company)) {
                return response()->json(['error' => ['code' => 'UNAUTHORIZED_TENANT_ACCESS', 'message' => 'Insufficient permissions to update organization settings.']], 403);
            }

            $validated = $request->validate([
                'name' => 'nullable|string|max:180',
                'timezone' => 'nullable|string|max:64',
                'locale' => 'nullable|string|max:12',
                'logo_path' => 'nullable|string|max:255',
            ]);

            $dto = TenantProfileUpdateData::fromArray($validated);
            $updated = $this->updateAction->execute($company, $dto);

            return response()->json([
                'data' => [
                    'id' => $updated->uuid ?? (string) $updated->id,
                    'name' => $updated->name,
                    'workspace_slug' => $updated->slug,
                    'status' => $updated->status,
                    'timezone' => $updated->timezone,
                    'locale' => $updated->locale,
                    'logo_path' => $updated->logo_path,
                ],
                'message' => 'Organization profile updated successfully.',
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        } catch (TenantSuspendedException $e) {
            return response()->json(['error' => ['code' => 'TENANT_SUSPENDED', 'message' => $e->getMessage()]], 403);
        }
    }

    /**
     * GET /api/v1/organizations/current/settings
     */
    public function settings(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);
            $settings = CompanySettings::where('company_id', $company->id)->first();

            return response()->json([
                'data' => $settings ? [
                    'working_days' => json_decode($settings->working_days ?? '[]'),
                    'fiscal_year_start' => $settings->fiscal_year_start,
                    'allow_employee_invites' => (bool)$settings->allow_employee_invites,
                    'enforce_mfa' => (bool)$settings->enforce_mfa,
                    'session_timeout_minutes' => $settings->session_timeout_minutes,
                    'date_format' => $settings->date_format,
                    'time_format' => $settings->time_format,
                ] : [],
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        }
    }

    /**
     * PATCH /api/v1/organizations/current/settings
     */
    public function updateSettings(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            if (!$this->policy->update($request->user(), $company)) {
                return response()->json(['error' => ['code' => 'UNAUTHORIZED_TENANT_ACCESS', 'message' => 'Insufficient permissions to update settings.']], 403);
            }

            $validated = $request->validate([
                'working_days' => 'nullable|array',
                'fiscal_year_start' => 'nullable|string|max:10',
                'allow_employee_invites' => 'nullable|boolean',
                'enforce_mfa' => 'nullable|boolean',
                'session_timeout_minutes' => 'nullable|integer|min:15|max:10080',
                'date_format' => 'nullable|string|max:20',
                'time_format' => 'nullable|string|max:10',
            ]);

            if (isset($validated['working_days'])) {
                $validated['working_days'] = json_encode($validated['working_days']);
            }

            $settings = CompanySettings::updateOrCreate(
                ['company_id' => $company->id],
                $validated
            );

            return response()->json([
                'message' => 'Organization settings updated successfully.',
                'data' => $settings,
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        }
    }

    /**
     * GET /api/v1/organizations/current/entitlements
     * Evaluates current plan entitlement flags and quotas
     */
    public function entitlements(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            $features = [
                'm01_tenant_management',
                'm02_org_structure',
                'm03_access_control',
                'm04_employees',
                'm05_recruitment',
                'm06_lifecycle',
                'm07_attendance_leave',
                'm08_time_tracking',
                'm09_payroll',
                'm10_performance',
                'collaboration',
            ];

            $results = [];
            foreach ($features as $f) {
                $results[$f] = $this->entitlementService->checkFeatureEntitlement($company, $f)->toArray();
            }

            $subscription = $company->subscription;
            $purchasedSeats = $subscription ? ($subscription->purchased_seats + $subscription->additional_seats) : 10;
            $activeCount = $company->memberships()->where('status', 'active')->count();

            return response()->json([
                'data' => [
                    'tier' => $subscription?->metadata ? (json_decode($subscription->metadata, true)['plan_code'] ?? 'starter') : 'starter',
                    'seats' => [
                        'limit' => $purchasedSeats,
                        'current' => $activeCount,
                        'available' => max(0, $purchasedSeats - $activeCount),
                        'can_add_seat' => $activeCount < $purchasedSeats,
                    ],
                    'features' => $results,
                ],
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        }
    }

    /**
     * POST /api/v1/organizations/current/suspension-requests
     */
    public function suspend(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            if (!$this->policy->suspend($request->user(), $company)) {
                return response()->json(['error' => ['code' => 'UNAUTHORIZED_TENANT_ACCESS', 'message' => 'Only organization owners or platform admins can suspend workspaces.']], 403);
            }

            $validated = $request->validate([
                'reason' => 'required|string|max:255',
            ]);

            $suspended = $this->suspendAction->execute($company, $validated['reason'], $request->user());

            return response()->json([
                'message' => 'Organization workspace suspended.',
                'data' => [
                    'id' => $suspended->uuid,
                    'status' => $suspended->status,
                ],
            ]);
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        }
    }

    /**
     * POST /api/v1/organizations/current/data-exports
     */
    public function export(Request $request): JsonResponse
    {
        try {
            $company = $this->contextResolver->resolve($request);

            if (!$this->policy->export($request->user(), $company)) {
                return response()->json(['error' => ['code' => 'UNAUTHORIZED_TENANT_ACCESS', 'message' => 'Insufficient permissions to request data export.']], 403);
            }

            $result = $this->exportAction->execute($company, $request->user());

            return response()->json([
                'data' => $result,
            ], 202); // 202 Accepted for async operation
        } catch (TenantNotFoundException $e) {
            return response()->json(['error' => ['code' => 'TENANT_NOT_FOUND', 'message' => $e->getMessage()]], 404);
        }
    }
}

<?php

namespace App\Domain\Access\Http\Controllers;

use App\Domain\Access\Actions\AssignRoleAction;
use App\Domain\Access\Actions\CreateRoleAction;
use App\Domain\Access\Actions\DeleteRoleAction;
use App\Domain\Access\Actions\GrantTemporaryAccessAction;
use App\Domain\Access\Actions\RevokeTemporaryAccessAction;
use App\Domain\Access\Actions\SyncRolePermissionsAction;
use App\Domain\Access\DTOs\AssignRoleData;
use App\Domain\Access\DTOs\CreateRoleData;
use App\Domain\Access\DTOs\GrantTemporaryAccessData;
use App\Domain\Access\Policies\RolePolicy;
use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Access\Services\PermissionCatalogService;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Http\Controllers\Controller;
use App\Models\CompanyMembership;
use App\Models\MembershipRole;
use App\Models\Role;
use App\Models\TemporaryAccessGrant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AccessControlController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected RolePolicy $policy,
        protected AuthorizationEngine $authEngine
    ) {}

    /**
     * GET /api/v1/permissions/catalog
     * Global catalog of registered permissions across all modules
     */
    public function catalog(PermissionCatalogService $catalogService): JsonResponse
    {
        return response()->json([
            'data' => $catalogService->getCatalog(),
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    /**
     * GET /api/v1/access/roles
     * List all system and tenant-specific roles
     */
    public function indexRoles(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $roles = Role::where(function ($q) use ($company) {
            $q->whereNull('company_id')->orWhere('company_id', $company->id);
        })
        ->withCount('permissions')
        ->withCount(['memberships' => function ($q) use ($company) {
            $q->where('company_id', $company->id);
        }])
        ->orderByDesc('is_system')
        ->orderBy('name')
        ->get();

        return response()->json([
            'data' => $roles->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
                'description' => $r->description,
                'is_system' => (bool)$r->is_system,
                'is_custom' => $r->company_id !== null,
                'permissions_count' => $r->permissions_count,
                'active_members_count' => $r->memberships_count,
            ]),
        ]);
    }

    /**
     * GET /api/v1/access/roles/{id}
     * Inspect single role and its full permission set
     */
    public function showRole(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $role = Role::where(function ($q) use ($company) {
            $q->whereNull('company_id')->orWhere('company_id', $company->id);
        })->where('id', $id)->with('permissions')->firstOrFail();

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'is_system' => (bool)$role->is_system,
                'permissions' => $role->permissions->map(fn ($p) => [
                    'id' => $p->id,
                    'key' => $p->key,
                    'name' => $p->name,
                    'module' => $p->module,
                ]),
            ],
        ]);
    }

    /**
     * POST /api/v1/access/roles
     * Create a custom organization role
     */
    public function storeRole(Request $request, CreateRoleAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to manage roles.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        $dto = CreateRoleData::fromArray($validated);
        $role = $action->execute($company, $dto, $user);

        return response()->json([
            'message' => 'Role created successfully.',
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'permissions_count' => $role->permissions->count(),
            ],
        ], 201);
    }

    /**
     * PUT /api/v1/access/roles/{id}/permissions
     * Sync permissions for a custom role
     */
    public function syncPermissions(Request $request, int $id, SyncRolePermissionsAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to manage roles.'], 403);
        }

        $validated = $request->validate([
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        $role = $action->execute($company, $id, $validated['permission_ids'], $user);

        return response()->json([
            'message' => 'Role permissions updated successfully.',
            'data' => [
                'id' => $role->id,
                'permissions_count' => $role->permissions->count(),
            ],
        ]);
    }

    /**
     * DELETE /api/v1/access/roles/{id}
     * Delete a custom role
     */
    public function destroyRole(Request $request, int $id, DeleteRoleAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to manage roles.'], 403);
        }

        $action->execute($company, $id, $user);

        return response()->json(['message' => 'Role deleted successfully.']);
    }

    /**
     * POST /api/v1/access/role-assignments
     * Assign role to a member with optional scope
     */
    public function assignRole(Request $request, AssignRoleAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to assign roles.'], 403);
        }

        $validated = $request->validate([
            'membership_id' => 'required|integer|exists:company_memberships,id',
            'role_id' => 'required|integer|exists:roles,id',
            'scope_type' => 'nullable|string|in:organization,department,team',
            'scope_id' => 'nullable|integer',
            'effective_from' => 'nullable|date',
            'effective_to' => 'nullable|date|after:effective_from',
        ]);

        $dto = AssignRoleData::fromArray($validated);
        $assignment = $action->execute($company, $dto, $user);

        return response()->json([
            'message' => 'Role assigned successfully.',
            'data' => [
                'id' => $assignment->id,
                'membership_id' => $assignment->membership_id,
                'role' => [
                    'id' => $assignment->role->id,
                    'name' => $assignment->role->name,
                    'slug' => $assignment->role->slug,
                ],
                'scope_type' => $assignment->scope_type,
                'scope_id' => $assignment->scope_id,
                'effective_from' => $assignment->effective_from?->toIso8601String(),
                'effective_to' => $assignment->effective_to?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * DELETE /api/v1/access/role-assignments/{id}
     * Revoke a role assignment
     */
    public function revokeRoleAssignment(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to revoke roles.'], 403);
        }

        $assignment = MembershipRole::whereHas('membership', fn ($q) => $q->where('company_id', $company->id))
            ->where('id', $id)
            ->firstOrFail();

        $assignment->delete();

        return response()->json(['message' => 'Role assignment revoked successfully.']);
    }

    /**
     * GET /api/v1/access/grants
     * List active and historical elevated access grants
     */
    public function listGrants(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to view access grants.'], 403);
        }

        $grants = TemporaryAccessGrant::where('company_id', $company->id)
            ->with(['membership.user', 'role', 'grantedByUser'])
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $grants->map(fn (TemporaryAccessGrant $g) => [
                'id' => $g->id,
                'member' => [
                    'id' => $g->membership->id,
                    'user_name' => $g->membership->user->name,
                    'user_email' => $g->membership->user->email,
                ],
                'permission_key' => $g->permission_key,
                'role_name' => $g->role?->name,
                'grant_type' => $g->grant_type ?? 'grant',
                'is_permanent' => (bool)$g->is_permanent,
                'scope_type' => $g->scope_type,
                'scope_id' => $g->scope_id,
                'reason' => $g->reason,
                'is_active' => $g->isActive(),
                'granted_by' => $g->grantedByUser->name,
                'granted_at' => $g->granted_at->toIso8601String(),
                'expires_at' => $g->expires_at?->toIso8601String(),
                'revoked_at' => $g->revoked_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * POST /api/v1/access/grants
     * Issue an elevated temporary access grant
     */
    public function grantTemporaryAccess(Request $request, GrantTemporaryAccessAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->grant($user, $company)) {
            return response()->json(['message' => 'Unauthorized to grant elevated access.'], 403);
        }

        $validated = $request->validate([
            'membership_id' => 'required|integer|exists:company_memberships,id',
            'role_id' => 'nullable|integer|exists:roles,id',
            'permission_key' => 'nullable|string|max:100',
            'grant_type' => 'nullable|string|in:grant,restrict',
            'is_permanent' => 'nullable|boolean',
            'reason' => 'required|string|min:5|max:1000',
            'duration_hours' => 'nullable|integer|min:1|max:8760',
            'scope_type' => 'nullable|string|in:organization,department,team',
            'scope_id' => 'nullable|integer',
        ]);

        $dto = GrantTemporaryAccessData::fromArray($validated);
        $grant = $action->execute($company, $dto, $user);

        $msg = ($grant->grant_type === 'restrict')
            ? 'Permission restriction applied successfully.'
            : 'Temporary access granted successfully.';

        return response()->json([
            'message' => $msg,
            'data' => [
                'id' => $grant->id,
                'membership_id' => $grant->membership_id,
                'permission_key' => $grant->permission_key,
                'grant_type' => $grant->grant_type ?? 'grant',
                'is_permanent' => (bool)$grant->is_permanent,
                'scope_type' => $grant->scope_type,
                'scope_id' => $grant->scope_id,
                'expires_at' => $grant->expires_at?->toIso8601String(),
                'reason' => $grant->reason,
            ],
        ], 201);
    }

    /**
     * POST /api/v1/access/grants/{id}/revoke
     * Early revocation of a temporary grant
     */
    public function revokeTemporaryAccess(Request $request, int $id, RevokeTemporaryAccessAction $action): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $user = $request->user();

        if (!$this->policy->manage($user, $company)) {
            return response()->json(['message' => 'Unauthorized to revoke access grants.'], 403);
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        $grant = $action->execute($company, $id, $validated['reason'], $user);

        return response()->json([
            'message' => 'Temporary access revoked successfully.',
            'data' => [
                'id' => $grant->id,
                'revoked_at' => $grant->revoked_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/v1/access/preview
     * Simulate and explain effective permission evaluation for a user on a resource
     */
    public function previewAccess(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'membership_id' => 'required|integer|exists:company_memberships,id',
            'permission_key' => 'required|string',
            'scope_type' => 'nullable|string|in:organization,department,team,self',
            'scope_id' => 'nullable|integer',
            'resource_context' => 'nullable|array',
        ]);

        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('id', $validated['membership_id'])
            ->firstOrFail();

        $result = $this->authEngine->evaluate(
            membership: $membership,
            permissionKey: $validated['permission_key'],
            scopeType: $validated['scope_type'] ?? 'organization',
            scopeId: isset($validated['scope_id']) ? (int)$validated['scope_id'] : null,
            resourceContext: $validated['resource_context'] ?? null
        );

        return response()->json([
            'data' => $result->toArray(),
        ]);
    }
}

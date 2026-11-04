<?php

namespace App\Domain\Access\Services;

use App\Domain\Access\DTOs\AccessEvaluationResult;
use App\Models\CompanyMembership;
use App\Models\PolicyDefinition;
use App\Models\Role;
use App\Models\TemporaryAccessGrant;
use Illuminate\Support\Facades\DB;

class AuthorizationEngine
{
    /**
     * Complete RBAC + Scoped ABAC + Policy Evaluation Decision Pipeline
     */
    public function evaluate(
        CompanyMembership $membership,
        string $permissionKey,
        string $scopeType = 'organization',
        ?int $scopeId = null,
        ?array $resourceContext = null
    ): AccessEvaluationResult {
        $decisionTree = [];

        // 1. Validate Membership Status
        if (!$membership->isActive()) {
            return new AccessEvaluationResult(
                isAllowed: false,
                permissionKey: $permissionKey,
                reason: "Membership is {$membership->status} or revoked.",
                scopeType: $scopeType,
                scopeId: $scopeId,
                decisionTree: ['membership_status' => 'inactive']
            );
        }
        $decisionTree['membership_status'] = 'active';

        // 2. Company Owner Override (Root Authority)
        if ($membership->hasRole('company-owner')) {
            $decisionTree['rule'] = 'company_owner_superuser';
            return new AccessEvaluationResult(
                isAllowed: true,
                permissionKey: $permissionKey,
                reason: 'Company Owner possesses unrestricted authorization within this organization.',
                matchedRole: 'company-owner',
                scopeType: $scopeType,
                scopeId: $scopeId,
                decisionTree: $decisionTree
            );
        }

        // 3. Separation of Duties (SoD) Invariants Check
        $sodViolation = $this->checkSeparationOfDutiesViolation($membership, $permissionKey, $resourceContext);
        if ($sodViolation !== null) {
            $decisionTree['sod_check'] = 'violated';
            $decisionTree['sod_policy'] = $sodViolation;
            return new AccessEvaluationResult(
                isAllowed: false,
                permissionKey: $permissionKey,
                reason: "Denied by Separation of Duties Policy ({$sodViolation}). Dual custody required.",
                scopeType: $scopeType,
                scopeId: $scopeId,
                decisionTree: $decisionTree
            );
        }
        $decisionTree['sod_check'] = 'passed';

        // 3.5 Explicit Permission Denial / Restriction Check (Deny Overrides Allow)
        $activeRestriction = TemporaryAccessGrant::where('membership_id', $membership->id)
            ->where('grant_type', 'restrict')
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->where(function ($q) use ($permissionKey) {
                $q->where('permission_key', $permissionKey)
                  ->orWhereNull('permission_key'); // Wildcard restriction
            })
            ->first();

        if ($activeRestriction) {
            $restrictionScopeMatches = ($activeRestriction->scope_type === 'organization') ||
                ($activeRestriction->scope_type === $scopeType && ($activeRestriction->scope_id === null || $activeRestriction->scope_id === $scopeId));

            if ($restrictionScopeMatches) {
                $decisionTree['rule'] = 'explicit_permission_restriction';
                $decisionTree['restriction_id'] = $activeRestriction->id;
                $decisionTree['is_permanent'] = (bool)$activeRestriction->is_permanent;
                $decisionTree['expires_at'] = $activeRestriction->expires_at?->toIso8601String();

                $expStr = $activeRestriction->is_permanent
                    ? 'Permanent restriction (Forever)'
                    : "expires {$activeRestriction->expires_at->toDateTimeString()}";

                return new AccessEvaluationResult(
                    isAllowed: false,
                    permissionKey: $permissionKey,
                    reason: "Explicitly RESTRICTED by security policy ({$expStr}). Reason: {$activeRestriction->reason}",
                    matchedGrant: "restriction_{$activeRestriction->id}",
                    scopeType: $scopeType,
                    scopeId: $scopeId,
                    decisionTree: $decisionTree
                );
            }
        }
        $decisionTree['restrictions_evaluated'] = 'no_active_restrictions';

        // 4. Temporary / Permanent Elevated Access Grants Check
        $activeGrant = TemporaryAccessGrant::where('membership_id', $membership->id)
            ->where(function ($q) {
                $q->whereNull('grant_type')->orWhere('grant_type', 'grant');
            })
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->where(function ($q) use ($permissionKey) {
                $q->where('permission_key', $permissionKey)
                  ->orWhereNull('permission_key'); // Wildcard elevated role grant
            })
            ->first();

        if ($activeGrant) {
            $grantScopeMatches = ($activeGrant->scope_type === 'organization') ||
                ($activeGrant->scope_type === $scopeType && ($activeGrant->scope_id === null || $activeGrant->scope_id === $scopeId));

            if ($grantScopeMatches) {
                // If grant is for a role, verify that role contains the requested permission
                $rolePermitted = true;
                if ($activeGrant->role_id) {
                    $grantRole = Role::find($activeGrant->role_id);
                    $rolePermitted = $grantRole && $grantRole->permissions->contains('key', $permissionKey);
                }

                if ($rolePermitted) {
                    $decisionTree['rule'] = $activeGrant->is_permanent ? 'permanent_access_grant' : 'temporary_access_grant';
                    $decisionTree['grant_id'] = $activeGrant->id;
                    $decisionTree['is_permanent'] = (bool)$activeGrant->is_permanent;
                    $decisionTree['expires_at'] = $activeGrant->expires_at?->toIso8601String();

                    $expStr = $activeGrant->is_permanent
                        ? 'Permanent override (Forever)'
                        : "expires: {$activeGrant->expires_at->toDateTimeString()}";

                    return new AccessEvaluationResult(
                        isAllowed: true,
                        permissionKey: $permissionKey,
                        reason: "Allowed via active elevated access grant ({$expStr}). Reason: {$activeGrant->reason}",
                        matchedGrant: "grant_{$activeGrant->id}",
                        scopeType: $scopeType,
                        scopeId: $scopeId,
                        decisionTree: $decisionTree
                    );
                }
            }
        }
        $decisionTree['temporary_grants_evaluated'] = true;

        // 5. Assigned RBAC Roles & Scopes Evaluation
        $membershipRoles = DB::table('membership_roles')
            ->join('roles', 'membership_roles.role_id', '=', 'roles.id')
            ->join('role_permissions', 'roles.id', '=', 'role_permissions.role_id')
            ->join('permissions', 'role_permissions.permission_id', '=', 'permissions.id')
            ->where('membership_roles.membership_id', $membership->id)
            ->where('permissions.key', $permissionKey)
            ->where(function ($q) {
                $now = now();
                $q->whereNull('membership_roles.effective_from')->orWhere('membership_roles.effective_from', '<=', $now);
            })
            ->where(function ($q) {
                $now = now();
                $q->whereNull('membership_roles.effective_to')->orWhere('membership_roles.effective_to', '>', $now);
            })
            ->select(
                'roles.name as role_name',
                'roles.slug as role_slug',
                'membership_roles.scope_type as assignment_scope_type',
                'membership_roles.scope_id as assignment_scope_id',
                'role_permissions.scope_type as perm_scope_type',
                'role_permissions.scope_id as perm_scope_id'
            )
            ->get();

        foreach ($membershipRoles as $record) {
            $effectiveScopeType = $record->assignment_scope_type;
            $effectiveScopeId = $record->assignment_scope_id;

            // Organization-wide assignment covers all sub-resources
            if ($effectiveScopeType === 'organization') {
                $decisionTree['matched_role'] = $record->role_slug;
                $decisionTree['matched_scope'] = 'organization';

                return new AccessEvaluationResult(
                    isAllowed: true,
                    permissionKey: $permissionKey,
                    reason: "Allowed via role '{$record->role_name}' with organization-wide scope.",
                    matchedRole: $record->role_slug,
                    scopeType: $scopeType,
                    scopeId: $scopeId,
                    decisionTree: $decisionTree
                );
            }

            // Scoped assignment (e.g. Department Manager for Department #5)
            if ($effectiveScopeType === $scopeType && ($effectiveScopeId === null || (int)$effectiveScopeId === (int)$scopeId)) {
                $decisionTree['matched_role'] = $record->role_slug;
                $decisionTree['matched_scope'] = "{$effectiveScopeType}:{$effectiveScopeId}";

                return new AccessEvaluationResult(
                    isAllowed: true,
                    permissionKey: $permissionKey,
                    reason: "Allowed via role '{$record->role_name}' scoped to {$effectiveScopeType} #{$effectiveScopeId}.",
                    matchedRole: $record->role_slug,
                    scopeType: $scopeType,
                    scopeId: $scopeId,
                    decisionTree: $decisionTree
                );
            }
        }

        // 6. Default Deny (Fail Closed)
        $decisionTree['final_decision'] = 'deny';
        return new AccessEvaluationResult(
            isAllowed: false,
            permissionKey: $permissionKey,
            reason: "Access denied. Insufficient role permissions or scope mismatch for '{$permissionKey}' in {$scopeType} context.",
            scopeType: $scopeType,
            scopeId: $scopeId,
            decisionTree: $decisionTree
        );
    }

    /**
     * Check if requested action violates any Separation of Duties policies
     */
    private function checkSeparationOfDutiesViolation(
        CompanyMembership $membership,
        string $requestedPermission,
        ?array $resourceContext
    ): ?string {
        if (!$resourceContext || empty($resourceContext['resource_id'])) {
            return null;
        }

        $sodPolicies = PolicyDefinition::where('policy_type', 'separation_of_duties')
            ->where('is_active', true)
            ->where(function ($q) use ($membership) {
                $q->whereNull('company_id')->orWhere('company_id', $membership->company_id);
            })
            ->get();

        foreach ($sodPolicies as $policy) {
            $definition = $policy->definition;
            if (empty($definition['prohibited_combinations'])) {
                continue;
            }

            foreach ($definition['prohibited_combinations'] as $combo) {
                // If requested permission is action_b, check if user was the actor for action_a on this resource
                if (($combo['action_b'] ?? '') === $requestedPermission) {
                    $priorActorId = $resourceContext['created_by_user_id'] ?? $resourceContext['prepared_by_user_id'] ?? null;
                    if ($priorActorId !== null && (int)$priorActorId === (int)$membership->user_id) {
                        return $policy->name;
                    }
                }
            }
        }

        return null;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CompanyMembership extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'user_id',
        'status',
        'joined_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'membership_roles', 'membership_id', 'role_id')
            ->using(MembershipRole::class)
            ->withPivot(['id', 'scope_type', 'scope_id', 'assigned_by_user_id', 'effective_from', 'effective_to'])
            ->withTimestamps();
    }

    public function membershipRoles(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MembershipRole::class, 'membership_id');
    }

    public function temporaryAccessGrants(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(TemporaryAccessGrant::class, 'membership_id');
    }

    public function role()
    {
        return $this->hasOneThrough(Role::class, MembershipRole::class, 'membership_id', 'id', 'id', 'role_id');
    }

    public function employeeProfile(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(EmployeeProfile::class, 'membership_id');
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(
            Department::class,
            'department_memberships',
            'membership_id',
            'department_id'
        )->withTimestamps();
    }

    public function managedDepartments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Department::class, 'manager_membership_id');
    }

    public function hasRole(string|array $roleSlug): bool
    {
        if (is_array($roleSlug)) {
            return $this->roles->contains(fn (Role $r) => in_array($r->slug, $roleSlug));
        }

        return $this->roles->contains('slug', $roleSlug);
    }

    /**
     * Admin-captured monitoring screenshots are visible only to administrators and managers,
     * never to the employee whose screen was captured.
     */
    public function canViewMonitoringScreenshots(): bool
    {
        return $this->hasPermission('attendance.manage')
            || $this->hasPermission('monitoring.policy.manage')
            || $this->hasPermission('attendance.view_team')
            || $this->hasRole(['company-owner', 'company-admin', 'project-manager', 'hr-officer']);
    }

    public function hasPermission(string $permissionKey): bool
    {
        // 1. Explicit Denial / Restriction Check (Deny overrides Allow)
        $hasActiveRestriction = $this->temporaryAccessGrants()
            ->where('permission_key', $permissionKey)
            ->where('grant_type', 'restrict')
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->exists();

        if ($hasActiveRestriction) {
            return false;
        }

        // Owner role has implicit superuser permission within the company (unless explicitly restricted above)
        if ($this->hasRole('company-owner')) {
            return true;
        }

        // 2. Check active temporary or permanent elevated grants
        $hasActiveGrant = $this->temporaryAccessGrants()
            ->where('permission_key', $permissionKey)
            ->where(function ($q) {
                $q->whereNull('grant_type')->orWhere('grant_type', 'grant');
            })
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->exists();

        if ($hasActiveGrant) {
            return true;
        }

        return $this->roles->flatMap(fn (Role $role) => $role->permissions)->contains('key', $permissionKey);
    }

    /**
     * Evaluates permission within a specific resource scope (organization, department, team, self)
     */
    public function hasScopedPermission(string $permissionKey, string $scopeType = 'organization', ?int $scopeId = null): bool
    {
        // 1. Explicit Denial / Restriction Check (Deny overrides Allow)
        $matchingRestriction = $this->temporaryAccessGrants()
            ->where('permission_key', $permissionKey)
            ->where('grant_type', 'restrict')
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->where(function ($q) use ($scopeType, $scopeId) {
                $q->where('scope_type', 'organization')
                  ->orWhere(fn ($sub) => $sub->where('scope_type', $scopeType)->where('scope_id', $scopeId));
            })
            ->exists();

        if ($matchingRestriction) {
            return false;
        }

        if ($this->hasRole('company-owner')) {
            return true;
        }

        // 2. Direct active temporary or permanent grant check with matching scope
        $matchingGrant = $this->temporaryAccessGrants()
            ->where('permission_key', $permissionKey)
            ->where(function ($q) {
                $q->whereNull('grant_type')->orWhere('grant_type', 'grant');
            })
            ->whereNull('revoked_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->where(function ($q) use ($scopeType, $scopeId) {
                $q->where('scope_type', 'organization')
                  ->orWhere(fn ($sub) => $sub->where('scope_type', $scopeType)->where('scope_id', $scopeId));
            })
            ->exists();

        if ($matchingGrant) {
            return true;
        }

        // 2. Role assignment scope check
        foreach ($this->roles as $role) {
            $hasPerm = $role->permissions->contains('key', $permissionKey);
            if (!$hasPerm) {
                continue;
            }

            $pivot = $role->pivot;
            if (!$pivot || !$pivot->isEffective()) {
                continue;
            }

            // Organization-scoped assignment grants access across all resources
            if ($pivot->scope_type === 'organization') {
                return true;
            }

            // Scoped match
            if ($pivot->scope_type === $scopeType && ($pivot->scope_id === null || $pivot->scope_id === $scopeId)) {
                return true;
            }
        }

        return false;
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && $this->revoked_at === null;
    }
}

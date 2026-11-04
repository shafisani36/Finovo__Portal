<?php

namespace App\Domain\Access\Policies;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\User;

class RolePolicy
{
    /**
     * Determine whether the user can view roles in the company
     */
    public function viewAny(User $user, Company $company): bool
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Determine whether the user can manage roles and role assignments
     */
    public function manage(User $user, Company $company): bool
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            return false;
        }

        if ($membership->hasRole('company-owner')) {
            return true;
        }

        return $membership->hasPermission('roles.manage');
    }

    /**
     * Determine whether the user can grant temporary elevated access
     */
    public function grant(User $user, Company $company): bool
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            return false;
        }

        if ($membership->hasRole('company-owner')) {
            return true;
        }

        return $membership->hasPermission('access.grant') || $membership->hasPermission('roles.manage');
    }
}

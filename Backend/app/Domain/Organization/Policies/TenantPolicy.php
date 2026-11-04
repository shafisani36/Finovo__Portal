<?php

namespace App\Domain\Organization\Policies;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\User;

class TenantPolicy
{
    /**
     * Determine whether the user can view the organization profile
     */
    public function view(User $user, Company $company): bool
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Determine whether the user can update organization settings/profile
     */
    public function update(User $user, Company $company): bool
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            return false;
        }

        return $membership->hasRole(['owner', 'admin', 'company-admin', 'organization-admin']);
    }

    /**
     * Determine whether the user can suspend or close the tenant
     */
    public function suspend(User $user, Company $company): bool
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            return false;
        }

        return $membership->hasRole(['owner', 'platform-admin']);
    }

    /**
     * Determine whether the user can request a tenant data export
     */
    public function export(User $user, Company $company): bool
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            return false;
        }

        return $membership->hasRole(['owner', 'admin', 'compliance-admin']);
    }
}

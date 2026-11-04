<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Exceptions\TenantNotFoundException;
use App\Domain\Organization\Exceptions\TenantSuspendedException;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\User;
use Illuminate\Http\Request;

class TenantContextResolver
{
    /**
     * Resolves and verifies authorized tenant context from the request & authenticated user
     *
     * @throws TenantNotFoundException
     * @throws TenantSuspendedException
     */
    public function resolve(Request $request, ?User $actor = null): Company
    {
        $user = $actor ?? $request->user();

        if (!$user) {
            throw new TenantNotFoundException('Authentication required to resolve organization context.');
        }

        // 1. Resolve identifier from route, header, or query
        $slugOrId = $request->route('companySlug')
            ?? $request->route('company')
            ?? $request->header('X-Tenant-ID')
            ?? $request->header('X-Company-Slug');

        if ($slugOrId instanceof Company) {
            $company = $slugOrId;
        } elseif (!empty($slugOrId)) {
            $company = Company::where('slug', $slugOrId)
                ->orWhere('id', is_numeric($slugOrId) ? (int)$slugOrId : -1)
                ->orWhere('uuid', $slugOrId)
                ->first();
        } else {
            // Default to actor's primary active membership if no tenant passed in route
            $firstMembership = CompanyMembership::where('user_id', $user->id)
                ->where('status', 'active')
                ->first();
            $company = $firstMembership?->company;
        }

        if (!$company) {
            throw new TenantNotFoundException("Organization workspace not found or inaccessible.");
        }

        // 2. Authoritative membership verification
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$membership) {
            throw new TenantNotFoundException("You do not have active membership in this organization.");
        }

        // 3. Status enforcement (FSM: suspended check)
        if ($company->status === 'suspended') {
            // Allow billing remediation actions if role is owner or billing_admin
            $isRemediationRoute = str_contains($request->path(), 'billing') || str_contains($request->path(), 'subscriptions');
            $canRemediate = in_array($membership->membership_type ?? 'member', ['owner', 'billing_admin', 'admin']);

            if (!$isRemediationRoute || !$canRemediate) {
                throw new TenantSuspendedException("Organization '{$company->name}' is currently suspended. Please contact your workspace administrator.");
            }
        }

        return $company;
    }
}

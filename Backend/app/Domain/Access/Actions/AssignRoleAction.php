<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\DTOs\AssignRoleData;
use App\Domain\Access\Events\RoleAssigned;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\MembershipRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AssignRoleAction
{
    /**
     * Atomically assigns a role to a member with optional resource scoping and temporal constraints
     */
    public function execute(Company $company, AssignRoleData $data, User $actor): MembershipRole
    {
        return DB::transaction(function () use ($company, $data, $actor) {
            $membership = CompanyMembership::where('company_id', $company->id)
                ->where('id', $data->membershipId)
                ->firstOrFail();

            $role = Role::where(function ($q) use ($company) {
                $q->whereNull('company_id')->orWhere('company_id', $company->id);
            })->where('id', $data->roleId)->firstOrFail();

            // Create or update membership role assignment with scope
            $membershipRole = MembershipRole::updateOrCreate(
                [
                    'membership_id' => $membership->id,
                    'role_id' => $role->id,
                    'scope_type' => $data->scopeType,
                    'scope_id' => $data->scopeId,
                ],
                [
                    'assigned_by_user_id' => $actor->id,
                    'effective_from' => $data->effectiveFrom,
                    'effective_to' => $data->effectiveTo,
                ]
            );

            // Transactional outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'event_type' => RoleAssigned::class,
                'schema_version' => 1,
                'company_id' => $company->id,
                'correlation_id' => (string) Str::uuid(),
                'producer' => 'm03_access_control',
                'payload' => json_encode([
                    'membership_id' => $membership->id,
                    'user_id' => $membership->user_id,
                    'role_id' => $role->id,
                    'role_slug' => $role->slug,
                    'scope_type' => $data->scopeType,
                    'scope_id' => $data->scopeId,
                    'assigned_by_user_id' => $actor->id,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $membershipRole->load(['role', 'membership.user']);
        });
    }
}

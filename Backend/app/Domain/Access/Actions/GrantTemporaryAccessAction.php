<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\DTOs\GrantTemporaryAccessData;
use App\Domain\Access\Events\TemporaryAccessGranted;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\TemporaryAccessGrant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GrantTemporaryAccessAction
{
    /**
     * Atomically issues an elevated, time-bound temporary access grant
     */
    public function execute(Company $company, GrantTemporaryAccessData $data, User $actor): TemporaryAccessGrant
    {
        return DB::transaction(function () use ($company, $data, $actor) {
            $membership = CompanyMembership::where('company_id', $company->id)
                ->where('id', $data->membershipId)
                ->firstOrFail();

            $expiresAt = $data->isPermanent ? null : now()->addHours($data->durationHours);

            $grant = TemporaryAccessGrant::create([
                'company_id' => $company->id,
                'membership_id' => $membership->id,
                'role_id' => $data->roleId,
                'permission_key' => $data->permissionKey,
                'grant_type' => $data->grantType,
                'is_permanent' => $data->isPermanent,
                'scope_type' => $data->scopeType,
                'scope_id' => $data->scopeId,
                'reason' => $data->reason,
                'granted_by_user_id' => $actor->id,
                'granted_at' => now(),
                'expires_at' => $expiresAt,
            ]);

            // Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'event_type' => TemporaryAccessGranted::class,
                'schema_version' => 1,
                'company_id' => $company->id,
                'correlation_id' => (string) Str::uuid(),
                'producer' => 'm03_access_control',
                'payload' => json_encode([
                    'grant_id' => $grant->id,
                    'membership_id' => $membership->id,
                    'permission_key' => $data->permissionKey,
                    'role_id' => $data->roleId,
                    'grant_type' => $data->grantType,
                    'is_permanent' => $data->isPermanent,
                    'scope_type' => $data->scopeType,
                    'scope_id' => $data->scopeId,
                    'expires_at' => $expiresAt?->toIso8601String(),
                    'granted_by_user_id' => $actor->id,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $grant->load(['membership.user', 'role', 'grantedByUser']);
        });
    }
}

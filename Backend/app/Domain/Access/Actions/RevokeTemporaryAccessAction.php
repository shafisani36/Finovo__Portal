<?php

namespace App\Domain\Access\Actions;

use App\Models\Company;
use App\Models\TemporaryAccessGrant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RevokeTemporaryAccessAction
{
    /**
     * Early revocation of an active temporary access grant
     */
    public function execute(Company $company, int $grantId, string $reason, User $actor): TemporaryAccessGrant
    {
        return DB::transaction(function () use ($company, $grantId, $reason, $actor) {
            $grant = TemporaryAccessGrant::where('company_id', $company->id)
                ->where('id', $grantId)
                ->firstOrFail();

            $grant->update([
                'revoked_at' => now(),
                'revocation_reason' => $reason,
                'revoked_by_user_id' => $actor->id,
            ]);

            DB::table('security_audit_events')->insert([
                'actor_user_id' => $actor->id,
                'company_id' => $company->id,
                'event_type' => 'access.grant_revoked',
                'target_type' => TemporaryAccessGrant::class,
                'target_id' => (string)$grant->id,
                'metadata' => json_encode([
                    'membership_id' => $grant->membership_id,
                    'permission_key' => $grant->permission_key,
                    'revocation_reason' => $reason,
                ]),
                'created_at' => now(),
            ]);

            return $grant->fresh();
        });
    }
}

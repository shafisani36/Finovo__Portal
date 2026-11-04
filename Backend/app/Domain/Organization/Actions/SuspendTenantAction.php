<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Events\TenantSuspended;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SuspendTenantAction
{
    public function execute(Company $company, string $reason, User $actor): Company
    {
        return DB::transaction(function () use ($company, $reason, $actor) {
            $company->update(['status' => 'suspended']);

            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'event_type' => TenantSuspended::class,
                'schema_version' => 1,
                'company_id' => $company->id,
                'correlation_id' => (string) Str::uuid(),
                'producer' => 'm01_tenant_management',
                'payload' => json_encode([
                    'tenant_id' => $company->id,
                    'reason' => $reason,
                    'actor_user_id' => $actor->id,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $company->fresh();
        });
    }
}

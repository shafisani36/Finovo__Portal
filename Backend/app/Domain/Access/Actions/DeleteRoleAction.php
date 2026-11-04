<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Exceptions\SystemRoleModificationException;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeleteRoleAction
{
    /**
     * Deletes a custom organization role
     */
    public function execute(Company $company, int $roleId, User $actor): bool
    {
        return DB::transaction(function () use ($company, $roleId, $actor) {
            $role = Role::where(function ($q) use ($company) {
                $q->whereNull('company_id')->orWhere('company_id', $company->id);
            })->where('id', $roleId)->firstOrFail();

            if ($role->is_system) {
                throw new SystemRoleModificationException($role->slug);
            }

            $roleSlug = $role->slug;
            $role->delete();

            DB::table('security_audit_events')->insert([
                'actor_user_id' => $actor->id,
                'company_id' => $company->id,
                'event_type' => 'role.deleted',
                'target_type' => Role::class,
                'target_id' => (string)$roleId,
                'metadata' => json_encode(['role_slug' => $roleSlug]),
                'created_at' => now(),
            ]);

            return true;
        });
    }
}

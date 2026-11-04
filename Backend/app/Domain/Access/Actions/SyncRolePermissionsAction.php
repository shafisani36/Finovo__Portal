<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Exceptions\SystemRoleModificationException;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SyncRolePermissionsAction
{
    /**
     * Updates permission mappings for a custom role
     */
    public function execute(Company $company, int $roleId, array $permissionIds, User $actor): Role
    {
        return DB::transaction(function () use ($company, $roleId, $permissionIds, $actor) {
            $role = Role::where('company_id', $company->id)->where('id', $roleId)->firstOrFail();

            if ($role->is_system) {
                throw new SystemRoleModificationException($role->slug);
            }

            $validIds = Permission::whereIn('id', $permissionIds)->pluck('id')->all();
            $role->permissions()->sync($validIds);

            DB::table('security_audit_events')->insert([
                'actor_user_id' => $actor->id,
                'company_id' => $company->id,
                'event_type' => 'role.permissions_synced',
                'target_type' => Role::class,
                'target_id' => (string)$role->id,
                'metadata' => json_encode([
                    'role_slug' => $role->slug,
                    'permissions_count' => count($validIds),
                ]),
                'created_at' => now(),
            ]);

            return $role->load('permissions');
        });
    }
}

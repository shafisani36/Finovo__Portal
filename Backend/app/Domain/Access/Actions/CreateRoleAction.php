<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\DTOs\CreateRoleData;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateRoleAction
{
    /**
     * Atomically creates a custom organization role and binds requested permissions
     */
    public function execute(Company $company, CreateRoleData $data, User $actor): Role
    {
        return DB::transaction(function () use ($company, $data, $actor) {
            $uniqueSlug = Str::slug($data->slug);

            // Ensure unique slug within tenant
            $originalSlug = $uniqueSlug;
            $counter = 1;
            while (Role::where('company_id', $company->id)->where('slug', $uniqueSlug)->exists()) {
                $uniqueSlug = "{$originalSlug}-{$counter}";
                $counter++;
            }

            $role = Role::create([
                'company_id' => $company->id,
                'name' => $data->name,
                'slug' => $uniqueSlug,
                'description' => $data->description,
                'is_system' => false,
            ]);

            if (!empty($data->permissionIds)) {
                $validPermissionIds = Permission::whereIn('id', $data->permissionIds)->pluck('id')->all();
                $role->permissions()->sync($validPermissionIds);
            }

            // Write transactional audit event
            DB::table('security_audit_events')->insert([
                'actor_user_id' => $actor->id,
                'company_id' => $company->id,
                'event_type' => 'role.created',
                'target_type' => Role::class,
                'target_id' => (string)$role->id,
                'metadata' => json_encode([
                    'role_name' => $role->name,
                    'role_slug' => $role->slug,
                    'permissions_count' => count($data->permissionIds),
                ]),
                'created_at' => now(),
            ]);

            return $role->load('permissions');
        });
    }
}

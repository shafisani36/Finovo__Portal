<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformAdminUser extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'role_id',
        'is_active',
        'mfa_verified',
        'last_active_at',
        'access_expires_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'mfa_verified' => 'boolean',
        'last_active_at' => 'datetime',
        'access_expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function role()
    {
        return $this->belongsTo(PlatformAdminRole::class, 'role_id');
    }

    public function hasPermission(string $permission): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->access_expires_at && $this->access_expires_at->isPast()) {
            return false;
        }

        $perms = $this->role?->permissions ?? [];
        return in_array('*', $perms) || in_array($permission, $perms);
    }
}

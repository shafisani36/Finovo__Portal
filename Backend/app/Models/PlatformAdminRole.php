<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformAdminRole extends Model
{
    use HasFactory;

    protected $fillable = [
        'role_key',
        'name',
        'description',
        'permissions',
        'requires_mfa',
    ];

    protected $casts = [
        'permissions' => 'array',
        'requires_mfa' => 'boolean',
    ];

    public function adminUsers()
    {
        return $this->hasMany(PlatformAdminUser::class, 'role_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemporaryAccessGrant extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'role_id',
        'permission_key',
        'grant_type',
        'is_permanent',
        'scope_type',
        'scope_id',
        'reason',
        'granted_by_user_id',
        'granted_at',
        'expires_at',
        'revoked_at',
        'revocation_reason',
        'revoked_by_user_id',
    ];

    protected $casts = [
        'scope_id' => 'integer',
        'is_permanent' => 'boolean',
        'granted_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function grantedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by_user_id');
    }

    public function revokedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by_user_id');
    }

    /**
     * Determine if this grant/restriction is currently active
     */
    public function isActive(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        if ($this->is_permanent) {
            return true;
        }

        return $this->expires_at !== null && now()->lt($this->expires_at);
    }

    public function isRestriction(): bool
    {
        return $this->grant_type === 'restrict';
    }

    public function isGrant(): bool
    {
        return ($this->grant_type ?? 'grant') === 'grant';
    }
}

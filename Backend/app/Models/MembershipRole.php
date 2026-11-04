<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

class MembershipRole extends Pivot
{
    use HasFactory;

    protected $table = 'membership_roles';

    public $incrementing = true;

    protected $fillable = [
        'membership_id',
        'role_id',
        'scope_type',
        'scope_id',
        'assigned_by_user_id',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'scope_id' => 'integer',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
    ];

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function assignedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_user_id');
    }

    /**
     * Check if this role assignment is currently effective
     */
    public function isEffective(): bool
    {
        $now = now();

        if ($this->effective_from && $now->lt($this->effective_from)) {
            return false;
        }

        if ($this->effective_to && $now->gte($this->effective_to)) {
            return false;
        }

        return true;
    }
}

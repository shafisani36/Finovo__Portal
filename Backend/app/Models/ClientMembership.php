<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientMembership extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'user_id',
        'portal_role',
        'status',
        'permissions',
        'invited_by_membership_id',
        'last_active_at',
    ];

    protected $casts = [
        'permissions' => 'array',
        'last_active_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function clientOrganization(): BelongsTo
    {
        return $this->belongsTo(ClientOrganization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'invited_by_membership_id');
    }
}

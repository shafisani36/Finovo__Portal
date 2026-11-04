<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformSupportSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_user_id',
        'company_id',
        'reason',
        'session_token',
        'status',
        'approved_by_admin_id',
        'redacted_mode',
        'started_at',
        'expires_at',
        'revoked_at',
        'revocation_reason',
    ];

    protected $casts = [
        'redacted_mode' => 'boolean',
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function adminUser()
    {
        return $this->belongsTo(PlatformAdminUser::class, 'admin_user_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function isCurrentlyValid(): bool
    {
        return $this->status === 'active' 
            && $this->expires_at 
            && $this->expires_at->isFuture() 
            && is_null($this->revoked_at);
    }
}

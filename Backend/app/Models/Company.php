<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Company extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'name',
        'slug',
        'status',
        'timezone',
        'locale',
        'logo_path',
    ];

    protected static function booted(): void
    {
        static::creating(function ($company) {
            if (empty($company->uuid)) {
                $company->uuid = (string) Str::uuid();
            }
        });
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where('slug', $value)
            ->orWhere('id', $value)
            ->first();
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CompanyMembership::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'company_memberships')
            ->withPivot(['id', 'status', 'joined_at', 'revoked_at'])
            ->withTimestamps();
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class);
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(SecurityAuditEvent::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function settings(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(CompanySettings::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(BillingSubscription::class, 'company_id');
    }

    public function subscription()
    {
        return $this->hasOne(BillingSubscription::class, 'company_id')->latestOfMany();
    }

    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class, 'company_id');
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(PlanEntitlement::class, 'company_id');
    }

    public function usageCounters(): HasMany
    {
        return $this->hasMany(TenantUsageCounter::class, 'company_id');
    }
}

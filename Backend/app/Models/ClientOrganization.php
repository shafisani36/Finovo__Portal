<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientOrganization extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'reference_code',
        'name',
        'status',
        'industry',
        'business_description',
        'billing_address',
        'country',
        'timezone',
        'account_manager_membership_id',
        'portal_enabled',
        'portal_domain',
        'custom_fields',
        'health_status',
        'archived_at',
    ];

    protected $casts = [
        'portal_enabled' => 'boolean',
        'custom_fields' => 'array',
        'archived_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function accountManager(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'account_manager_membership_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClientMembership::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(ClientInvitation::class);
    }

    public function engagements(): HasMany
    {
        return $this->hasMany(ClientProjectEngagement::class);
    }

    public function deliverableReviews(): HasMany
    {
        return $this->hasMany(ClientDeliverableReview::class);
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(ClientDecision::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ClientRequest::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(ClientContract::class);
    }

    public function onboardingRuns(): HasMany
    {
        return $this->hasMany(ClientOnboardingRun::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(ClientFile::class);
    }
}

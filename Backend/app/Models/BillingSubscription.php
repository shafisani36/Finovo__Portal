<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingSubscription extends Model
{
    use HasFactory;

    // Defined Subscription States
    const STATUS_DRAFT = 'draft';
    const STATUS_PENDING_CHECKOUT = 'pending_checkout';
    const STATUS_INCOMPLETE = 'incomplete';
    const STATUS_TRIAL = 'trial';
    const STATUS_ACTIVE = 'active';
    const STATUS_PAST_DUE = 'past_due';
    const STATUS_CANCEL_SCHEDULED = 'cancel_scheduled';
    const STATUS_CANCELED = 'canceled';
    const STATUS_EXPIRED = 'expired';
    const STATUS_REVIEW_HOLD = 'review_hold';

    protected $fillable = [
        'company_id',
        'plan_id',
        'price_version_id',
        'subscription_code',
        'provider',
        'provider_subscription_id',
        'provider_customer_id',
        'status',
        'purchased_seats',
        'additional_seats',
        'billing_interval',
        'current_price',
        'currency',
        'trial_starts_at',
        'trial_ends_at',
        'current_period_starts_at',
        'current_period_ends_at',
        'cancel_at_period_end_requested_at',
        'canceled_at',
        'grace_period_ends_at',
        'cancellation_reason',
        'metadata',
    ];

    protected $casts = [
        'purchased_seats' => 'integer',
        'additional_seats' => 'integer',
        'current_price' => 'decimal:2',
        'trial_starts_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'current_period_starts_at' => 'datetime',
        'current_period_ends_at' => 'datetime',
        'cancel_at_period_end_requested_at' => 'datetime',
        'canceled_at' => 'datetime',
        'grace_period_ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function plan()
    {
        return $this->belongsTo(BillingPlan::class, 'plan_id');
    }

    public function priceVersion()
    {
        return $this->belongsTo(BillingPriceVersion::class, 'price_version_id');
    }

    public function seats()
    {
        return $this->hasOne(BillingSubscriptionSeat::class, 'subscription_id');
    }

    public function invoices()
    {
        return $this->hasMany(BillingInvoice::class, 'subscription_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_ACTIVE, self::STATUS_TRIAL, self::STATUS_CANCEL_SCHEDULED]);
    }

    public function totalAllowedSeats(): int
    {
        return ($this->purchased_seats ?? 5) + ($this->additional_seats ?? 0);
    }
}

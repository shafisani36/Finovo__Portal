<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingPriceVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_id',
        'version_number',
        'billing_interval',
        'base_price',
        'per_seat_price',
        'currency',
        'included_seats',
        'trial_period_days',
        'effective_from',
        'effective_to',
        'is_active',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'per_seat_price' => 'decimal:2',
        'included_seats' => 'integer',
        'trial_period_days' => 'integer',
        'is_active' => 'boolean',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(BillingPlan::class, 'plan_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingSubscriptionSeat extends Model
{
    use HasFactory;

    protected $fillable = [
        'subscription_id',
        'company_id',
        'total_seats',
        'occupied_seats',
        'pending_invitations',
        'last_reconciled_at',
    ];

    protected $casts = [
        'total_seats' => 'integer',
        'occupied_seats' => 'integer',
        'pending_invitations' => 'integer',
        'last_reconciled_at' => 'datetime',
    ];

    public function subscription()
    {
        return $this->belongsTo(BillingSubscription::class, 'subscription_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function availableSeats(): int
    {
        return max(0, $this->total_seats - ($this->occupied_seats + $this->pending_invitations));
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LeaveType extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'is_paid',
        'requires_balance',
        'allow_half_day',
        'allow_partial_day',
        'color',
        'max_consecutive_days',
        'is_active',
    ];

    protected $casts = [
        'is_paid' => 'boolean',
        'requires_balance' => 'boolean',
        'allow_half_day' => 'boolean',
        'allow_partial_day' => 'boolean',
        'is_active' => 'boolean',
        'max_consecutive_days' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function policy(): HasOne
    {
        return $this->hasOne(LeavePolicy::class);
    }

    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }
}

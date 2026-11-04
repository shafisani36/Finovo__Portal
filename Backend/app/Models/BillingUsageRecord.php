<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingUsageRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'meter_key',
        'idempotency_key',
        'quantity',
        'recorded_at',
        'is_invoiced',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'recorded_at' => 'datetime',
        'is_invoiced' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

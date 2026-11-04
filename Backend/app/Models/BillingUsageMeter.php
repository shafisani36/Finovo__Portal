<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingUsageMeter extends Model
{
    use HasFactory;

    protected $fillable = [
        'meter_key',
        'name',
        'aggregation_type',
        'unit_price',
    ];

    protected $casts = [
        'unit_price' => 'decimal:4',
    ];
}

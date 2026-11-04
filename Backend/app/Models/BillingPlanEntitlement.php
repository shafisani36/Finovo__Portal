<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingPlanEntitlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_id',
        'feature_key',
        'value_type',
        'value',
        'description',
    ];

    public function plan()
    {
        return $this->belongsTo(BillingPlan::class, 'plan_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinanceBillingContract extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'billing_rate' => 'decimal:2',
        'budget_cap' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function client()
    {
        return $this->belongsTo(ClientOrganization::class, 'client_id');
    }
}

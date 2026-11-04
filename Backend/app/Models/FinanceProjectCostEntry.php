<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinanceProjectCostEntry extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'cost_rate' => 'decimal:2',
        'hours' => 'decimal:2',
        'amount' => 'decimal:2',
        'incurred_date' => 'date',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}

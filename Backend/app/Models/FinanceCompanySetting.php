<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinanceCompanySetting extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'default_tax_rate' => 'decimal:2',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}

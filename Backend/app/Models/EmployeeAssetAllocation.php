<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAssetAllocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'asset_name',
        'asset_tag',
        'serial_number',
        'category',
        'allocated_at',
        'returned_at',
        'status',
        'notes',
    ];

    protected $casts = [
        'allocated_at' => 'datetime',
        'returned_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }
}

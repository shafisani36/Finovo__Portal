<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollLineItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'payroll_run_id',
        'employment_record_id',
        'membership_id',
        'item_type',
        'code',
        'name',
        'rate',
        'hours',
        'amount',
        'is_taxable',
        'calculation_trace',
    ];

    protected $casts = [
        'rate' => 'decimal:4',
        'hours' => 'decimal:2',
        'amount' => 'decimal:4',
        'is_taxable' => 'boolean',
        'calculation_trace' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class);
    }
}

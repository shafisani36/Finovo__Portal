<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payslip extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'payroll_run_id',
        'employment_record_id',
        'membership_id',
        'payslip_number',
        'gross_pay',
        'total_deductions',
        'net_pay',
        'currency',
        'status',
        'payment_method',
        'bank_account_mask',
        'published_at',
    ];

    protected $casts = [
        'gross_pay' => 'decimal:4',
        'total_deductions' => 'decimal:4',
        'net_pay' => 'decimal:4',
        'published_at' => 'datetime',
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

    public function lineItems(): HasMany
    {
        return $this->hasMany(PayrollLineItem::class, 'payroll_run_id', 'payroll_run_id')
            ->where('employment_record_id', $this->employment_record_id);
    }
}

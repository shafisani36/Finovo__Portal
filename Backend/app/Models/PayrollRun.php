<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'run_number',
        'period_start',
        'period_end',
        'pay_date',
        'currency',
        'status',
        'total_gross',
        'total_deductions',
        'total_statutory',
        'total_net',
        'total_employer_contributions',
        'employee_count',
        'prepared_by_user_id',
        'approved_by_user_id',
        'approved_at',
        'finalized_by_user_id',
        'finalized_at',
        'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'pay_date' => 'date',
        'total_gross' => 'decimal:4',
        'total_deductions' => 'decimal:4',
        'total_statutory' => 'decimal:4',
        'total_net' => 'decimal:4',
        'total_employer_contributions' => 'decimal:4',
        'approved_at' => 'datetime',
        'finalized_at' => 'datetime',
        'employee_count' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by_user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function finalizedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by_user_id');
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(PayrollLineItem::class, 'payroll_run_id');
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'payroll_run_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeavePolicy extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'leave_type_id',
        'annual_accrual_days',
        'accrual_frequency',
        'carry_forward_limit_days',
        'negative_balance_allowed',
        'min_notice_days',
        'probation_eligible',
        'effective_from',
    ];

    protected $casts = [
        'annual_accrual_days' => 'decimal:2',
        'carry_forward_limit_days' => 'decimal:2',
        'negative_balance_allowed' => 'boolean',
        'probation_eligible' => 'boolean',
        'min_notice_days' => 'integer',
        'effective_from' => 'date',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }
}

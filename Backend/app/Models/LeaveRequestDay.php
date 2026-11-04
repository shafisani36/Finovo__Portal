<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveRequestDay extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'leave_request_id',
        'work_date',
        'units',
        'is_working_day',
    ];

    protected $casts = [
        'work_date' => 'date',
        'units' => 'decimal:2',
        'is_working_day' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }
}

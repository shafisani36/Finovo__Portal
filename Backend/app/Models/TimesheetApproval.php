<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'timesheet_id',
        'reviewer_membership_id',
        'action',
        'version_at_action',
        'reason',
    ];

    protected $casts = [
        'version_at_action' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'reviewer_membership_id');
    }
}

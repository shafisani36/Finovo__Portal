<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySettings extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'working_days',
        'fiscal_year_start',
        'allow_employee_invites',
        'enforce_mfa',
        'session_timeout_minutes',
        'date_format',
        'time_format',
        'preferences',
    ];

    protected function casts(): array
    {
        return [
            'working_days' => 'array',
            'allow_employee_invites' => 'boolean',
            'enforce_mfa' => 'boolean',
            'session_timeout_minutes' => 'integer',
            'preferences' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}

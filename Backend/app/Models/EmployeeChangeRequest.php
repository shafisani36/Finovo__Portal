<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeChangeRequest extends Model
{
    use HasFactory;

    protected $table = 'employee_change_requests';

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'requested_by_user_id',
        'request_type',
        'proposed_payload',
        'reason',
        'effective_date',
        'status',
        'reviewed_by_user_id',
        'reviewed_at',
        'review_notes',
    ];

    protected $casts = [
        'proposed_payload' => 'array',
        'effective_date' => 'date',
        'reviewed_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}

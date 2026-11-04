<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeePersonalDetail extends Model
{
    use HasFactory;

    protected $table = 'employee_personal_details';

    protected $fillable = [
        'employment_record_id',
        'date_of_birth',
        'gender',
        'marital_status',
        'national_id_number',
        'personal_email',
        'personal_phone',
        'emergency_contact_name',
        'emergency_contact_relationship',
        'emergency_contact_phone',
        'residential_address',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function employmentRecord(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }
}

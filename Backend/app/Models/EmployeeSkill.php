<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeSkill extends Model
{
    use HasFactory;

    protected $table = 'employee_skills';

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'skill_name',
        'proficiency_level',
        'years_of_experience',
        'verified',
    ];

    protected $casts = [
        'years_of_experience' => 'decimal:1',
        'verified' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }
}

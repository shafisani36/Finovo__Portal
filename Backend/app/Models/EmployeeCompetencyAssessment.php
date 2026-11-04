<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeCompetencyAssessment extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employee()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employee_id');
    }

    public function framework()
    {
        return $this->belongsTo(CompetencyFramework::class, 'framework_id');
    }

    public function assessedBy()
    {
        return $this->belongsTo(User::class, 'assessed_by_user_id');
    }
}

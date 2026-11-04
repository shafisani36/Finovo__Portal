<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompetencyFramework extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'competencies' => 'array',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function assessments()
    {
        return $this->hasMany(EmployeeCompetencyAssessment::class, 'framework_id');
    }
}

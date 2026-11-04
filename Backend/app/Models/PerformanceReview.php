<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerformanceReview extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'self_rating' => 'decimal:2',
        'manager_rating' => 'decimal:2',
        'final_rating' => 'decimal:2',
        'calibrated_rating' => 'decimal:2',
        'quality_score' => 'decimal:2',
        'self_responses' => 'array',
        'manager_responses' => 'array',
        'quality_flags' => 'array',
        'self_submitted_at' => 'datetime',
        'manager_submitted_at' => 'datetime',
        'released_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function cycle()
    {
        return $this->belongsTo(PerformanceReviewCycle::class, 'cycle_id');
    }

    public function template()
    {
        return $this->belongsTo(ReviewTemplate::class, 'template_id');
    }

    public function employee()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employee_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(EmploymentRecord::class, 'reviewer_id');
    }

    public function evidenceLinks()
    {
        return $this->hasMany(ReviewEvidenceLink::class, 'review_id');
    }

    public function appeals()
    {
        return $this->hasMany(PerformanceAppeal::class, 'review_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewScorecard extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'candidate_application_id',
        'interviewer_membership_id',
        'interview_stage',
        'overall_recommendation',
        'criteria_scores',
        'summary_notes',
        'submitted_at',
    ];

    protected $casts = [
        'criteria_scores' => 'array',
        'submitted_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(CandidateApplication::class, 'candidate_application_id');
    }

    public function interviewer(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'interviewer_membership_id');
    }
}

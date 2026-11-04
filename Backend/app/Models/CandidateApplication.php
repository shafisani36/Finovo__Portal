<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CandidateApplication extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'candidate_id',
        'job_requisition_id',
        'current_stage',
        'stage_notes',
        'rejection_reason',
        'converted_employment_record_id',
        'converted_at',
    ];

    protected $casts = [
        'converted_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(JobRequisition::class, 'job_requisition_id');
    }

    public function scorecards(): HasMany
    {
        return $this->hasMany(InterviewScorecard::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(CandidateOffer::class);
    }

    public function latestOffer(): HasOne
    {
        return $this->hasOne(CandidateOffer::class)->latestOfMany();
    }

    public function convertedEmployee(): BelongsTo
    {
        return $this->belongsTo(EmploymentRecord::class, 'converted_employment_record_id');
    }
}

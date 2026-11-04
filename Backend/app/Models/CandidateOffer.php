<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateOffer extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'candidate_application_id',
        'base_salary',
        'currency',
        'bonus_percentage',
        'equity_units',
        'proposed_start_date',
        'expiration_date',
        'status',
        'approved_by_user_id',
        'approved_at',
        'accepted_at',
        'offer_document_url',
        'terms_snapshot',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'bonus_percentage' => 'decimal:2',
        'equity_units' => 'integer',
        'proposed_start_date' => 'date',
        'expiration_date' => 'date',
        'approved_at' => 'datetime',
        'accepted_at' => 'datetime',
        'terms_snapshot' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(CandidateApplication::class, 'candidate_application_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }
}

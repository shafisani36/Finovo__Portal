<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationalChangeRequest extends Model
{
    use HasFactory;

    protected $table = 'organizational_change_requests';

    protected $fillable = [
        'company_id',
        'title',
        'request_type',
        'details',
        'status',
        'effective_date',
        'requested_by_user_id',
        'approved_by_user_id',
        'approved_at',
        'applied_at',
    ];

    protected $casts = [
        'details' => 'array',
        'effective_date' => 'datetime',
        'approved_at' => 'datetime',
        'applied_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function requestedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }
}

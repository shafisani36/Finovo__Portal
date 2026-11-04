<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PolicyDefinition extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'policy_code',
        'name',
        'description',
        'policy_type',
        'definition',
        'is_active',
        'version',
    ];

    protected $casts = [
        'definition' => 'array',
        'is_active' => 'boolean',
        'version' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}

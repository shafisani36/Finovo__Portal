<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationLocation extends Model
{
    use HasFactory;

    protected $table = 'organization_locations';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'timezone',
        'country',
        'city',
        'address',
        'is_remote',
        'is_active',
    ];

    protected $casts = [
        'is_remote' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function jobPositions(): HasMany
    {
        return $this->hasMany(JobPosition::class, 'location_id');
    }
}

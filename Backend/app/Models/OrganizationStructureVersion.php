<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationStructureVersion extends Model
{
    use HasFactory;

    protected $table = 'organization_structure_versions';

    protected $fillable = [
        'company_id',
        'version_number',
        'snapshot',
        'published_by_user_id',
        'published_at',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'snapshot' => 'array',
        'published_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function publishedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by_user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientOnboardingRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'template_name',
        'status',
        'completed_items_count',
        'total_items_count',
        'checklist_items',
        'completed_at',
    ];

    protected $casts = [
        'completed_items_count' => 'integer',
        'total_items_count' => 'integer',
        'checklist_items' => 'array',
        'completed_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function clientOrganization(): BelongsTo
    {
        return $this->belongsTo(ClientOrganization::class);
    }
}

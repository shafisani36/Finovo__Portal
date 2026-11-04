<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientProjectEngagement extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'project_id',
        'client_project_name',
        'client_visible_status',
        'visibility_mode',
        'show_milestones',
        'show_deliverables',
        'show_financials',
        'status',
    ];

    protected $casts = [
        'show_milestones' => 'boolean',
        'show_deliverables' => 'boolean',
        'show_financials' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function clientOrganization(): BelongsTo
    {
        return $this->belongsTo(ClientOrganization::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}

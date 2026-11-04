<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'project_id',
        'task_id',
        'request_code',
        'category',
        'title',
        'description',
        'priority',
        'client_status',
        'internal_status',
        'estimated_cost_hours',
        'estimated_budget_amount',
        'submitted_by_user_id',
        'triaged_by_membership_id',
    ];

    protected $casts = [
        'estimated_cost_hours' => 'decimal:2',
        'estimated_budget_amount' => 'decimal:2',
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

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }

    public function triagedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'triaged_by_membership_id');
    }
}

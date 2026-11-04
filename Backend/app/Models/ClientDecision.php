<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientDecision extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'project_id',
        'milestone_id',
        'decision_code',
        'title',
        'context_description',
        'requested_by_membership_id',
        'assigned_contact_id',
        'due_date',
        'status',
        'outcome_decision',
        'outcome_rationale',
        'responded_by_user_id',
        'responded_at',
        'impact_summary',
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'responded_at' => 'datetime',
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

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'requested_by_membership_id');
    }

    public function assignedContact(): BelongsTo
    {
        return $this->belongsTo(ClientContact::class, 'assigned_contact_id');
    }

    public function respondedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by_user_id');
    }
}

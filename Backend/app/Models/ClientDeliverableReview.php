<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientDeliverableReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'project_id',
        'project_deliverable_id',
        'version_label',
        'version_hash',
        'title',
        'description',
        'file_url',
        'file_size_bytes',
        'submitted_by_membership_id',
        'submitted_at',
        'due_date',
        'review_status',
        'decision_by_user_id',
        'decision_at',
        'decision_comment',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'due_date' => 'datetime',
        'decision_at' => 'datetime',
        'file_size_bytes' => 'integer',
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

    public function deliverable(): BelongsTo
    {
        return $this->belongsTo(ProjectDeliverable::class, 'project_deliverable_id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'submitted_by_membership_id');
    }

    public function decisionBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decision_by_user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'project_code',
        'name',
        'client_name',
        'manager_membership_id',
        'project_type',
        'priority',
        'status',
        'health_status',
        'billing_model',
        'budget_amount',
        'currency',
        'description',
        'scope_overview',
        'start_date',
        'target_end_date',
        'actual_completion_date',
        'cancellation_reason',
        'closure_notes',
        'progress_percent',
        'version',
    ];

    protected $casts = [
        'start_date' => 'date',
        'target_end_date' => 'date',
        'actual_completion_date' => 'date',
        'budget_amount' => 'decimal:2',
        'progress_percent' => 'decimal:2',
        'version' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'manager_membership_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(ProjectMilestone::class)->orderBy('order');
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(ProjectDeliverable::class);
    }

    public function scopeRevisions(): HasMany
    {
        return $this->hasMany(ProjectScopeRevision::class)->orderByDesc('revision_number');
    }

    public function changeRequests(): HasMany
    {
        return $this->hasMany(ProjectChangeRequest::class)->latest();
    }

    public function risks(): HasMany
    {
        return $this->hasMany(ProjectRisk::class)->latest();
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(ProjectDecision::class)->latest('decided_at');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class)->latest();
    }

    /**
     * Algorithm E: Weighted milestone progress calculation
     */
    public function calculateProgress(): float
    {
        $milestones = $this->milestones;
        if ($milestones->isEmpty()) {
            return 0.00;
        }

        $totalWeight = 0.0;
        $earnedWeight = 0.0;

        foreach ($milestones as $m) {
            $weight = (float) $m->weight;
            $totalWeight += $weight;
            if ($m->status === 'completed') {
                $earnedWeight += $weight;
            } elseif ($m->status === 'in_progress') {
                $earnedWeight += ($weight * 0.5); // Partial credit
            }
        }

        if ($totalWeight <= 0) {
            return 0.00;
        }

        $calculated = round(($earnedWeight / $totalWeight) * 100, 2);
        $this->update(['progress_percent' => $calculated]);

        return $calculated;
    }

    /**
     * Algorithm B: Explainable Project Health Engine
     */
    public function evaluateHealth(): array
    {
        $signals = [];
        $status = 'healthy';

        // 1. Critical unresolved blockers
        $blockersCount = $this->risks()
            ->where('type', 'blocker')
            ->whereIn('status', ['open', 'in_progress'])
            ->count();

        if ($blockersCount > 0) {
            $signals[] = "{$blockersCount} critical blocker(s) are active and unresolved.";
            $status = 'critical';
        }

        // 2. Overdue milestones
        $overdueMilestones = $this->milestones()
            ->where('status', '!=', 'completed')
            ->whereNotNull('forecast_due_date')
            ->where('forecast_due_date', '<', now()->toDateString())
            ->count();

        if ($overdueMilestones > 0) {
            $signals[] = "{$overdueMilestones} milestone(s) are past forecast due date.";
            if ($status !== 'critical') {
                $status = 'at_risk';
            }
        }

        // 3. Schedule target breach
        if ($this->target_end_date && $this->target_end_date->isPast() && !in_array($this->status, ['completed', 'closed', 'archived'])) {
            $signals[] = "Project target completion date ({$this->target_end_date->toDateString()}) has elapsed.";
            $status = 'critical';
        }

        if (empty($signals)) {
            $signals[] = 'All milestone deliveries and active indicators within normal parameters.';
        }

        $this->update(['health_status' => $status]);

        return [
            'health_status' => $status,
            'signals' => $signals,
            'evaluated_at' => now()->toIso8601String(),
        ];
    }

    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }
}

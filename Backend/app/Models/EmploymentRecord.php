<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class EmploymentRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'membership_id',
        'employee_number',
        'employment_type',
        'status',
        'department_id',
        'designation_id',
        'manager_membership_id',
        'hire_date',
        'probation_end_date',
        'confirmation_date',
        'contract_end_date',
        'termination_date',
        'termination_reason',
        'work_location',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'probation_end_date' => 'date',
            'confirmation_date' => 'date',
            'contract_end_date' => 'date',
            'termination_date' => 'date',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'membership_id');
    }

    public function user()
    {
        return $this->hasOneThrough(User::class, CompanyMembership::class, 'id', 'id', 'membership_id', 'user_id')
            ->select('users.*');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'manager_membership_id');
    }

    public function managerMembership(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'manager_membership_id');
    }

    public function teamMemberships(): HasMany
    {
        return $this->hasMany(TeamMembership::class, 'employment_record_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(EmploymentHistory::class);
    }

    public function onboardingTasks(): HasMany
    {
        return $this->hasMany(EmployeeOnboardingTask::class);
    }

    public function changeRequests(): HasMany
    {
        return $this->hasMany(EmployeeChangeRequest::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function skills(): HasMany
    {
        return $this->hasMany(EmployeeSkill::class);
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_memberships')
            ->withPivot(['membership_type', 'effective_from', 'effective_to'])
            ->withTimestamps();
    }

    public function personalDetails(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(EmployeePersonalDetail::class, 'employment_record_id');
    }

    public function jobAssignments(): HasMany
    {
        return $this->hasMany(JobAssignment::class, 'employment_record_id');
    }

    public function activePrimaryAssignment(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(JobAssignment::class, 'employment_record_id')
            ->where('is_primary', true)
            ->where('status', 'active');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(EmploymentContract::class, 'employment_record_id');
    }

    public function certifications(): HasMany
    {
        return $this->hasMany(EmployeeCertification::class, 'employment_record_id');
    }

    /**
     * Prevents circular manager assignments by traversing the proposed manager's chain of supervision.
     */
    public function createsCircularReporting(int $proposedManagerMembershipId): bool
    {
        // Direct self-reporting is invalid
        if ($this->membership_id === $proposedManagerMembershipId) {
            return true;
        }

        $visited = [$this->membership_id];
        $currentManagerMembershipId = $proposedManagerMembershipId;

        while ($currentManagerMembershipId) {
            if (in_array($currentManagerMembershipId, $visited, true)) {
                return true;
            }

            $visited[] = $currentManagerMembershipId;

            // Find employment record of the manager
            $managerEmployment = static::where('company_id', $this->company_id)
                ->where('membership_id', $currentManagerMembershipId)
                ->first();

            $currentManagerMembershipId = $managerEmployment?->manager_membership_id;
        }

        return false;
    }
}

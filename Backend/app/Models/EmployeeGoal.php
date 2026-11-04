<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeGoal extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'baseline_value' => 'decimal:2',
        'target_value' => 'decimal:2',
        'current_value' => 'decimal:2',
        'due_date' => 'date',
        'milestones' => 'array',
    ];

    protected $appends = ['calculated_progress'];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employee()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employee_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function getCalculatedProgressAttribute(): float
    {
        if ($this->measurement_type === 'percentage') {
            return (float) min(100, max(0, $this->current_value));
        }

        if ($this->measurement_type === 'numeric') {
            $denominator = $this->target_value - $this->baseline_value;
            if ($denominator == 0) {
                return $this->current_value >= $this->target_value ? 100.0 : 0.0;
            }
            $pct = (($this->current_value - $this->baseline_value) / $denominator) * 100;
            return (float) round(min(100, max(0, $pct)), 1);
        }

        if ($this->measurement_type === 'milestone') {
            if (is_array($this->milestones) && count($this->milestones) > 0) {
                $completed = count(array_filter($this->milestones, fn($m) => !empty($m['completed'])));
                return round(($completed / count($this->milestones)) * 100, 1);
            }
            return (float) min(100, max(0, $this->current_value));
        }

        return (float) min(100, max(0, $this->current_value));
    }
}

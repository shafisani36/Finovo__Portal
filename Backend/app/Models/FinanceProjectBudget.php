<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinanceProjectBudget extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'approved_budget' => 'decimal:2',
        'labor_budget' => 'decimal:2',
        'expense_budget' => 'decimal:2',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function revisions()
    {
        return $this->hasMany(FinanceBudgetRevision::class, 'project_budget_id');
    }
}

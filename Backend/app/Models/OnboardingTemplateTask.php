<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnboardingTemplateTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'task_key',
        'title',
        'description',
        'assigned_role',
        'is_required',
        'due_days_after_hire',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'due_days_after_hire' => 'integer',
            'order' => 'integer',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(OnboardingTemplate::class, 'template_id');
    }
}

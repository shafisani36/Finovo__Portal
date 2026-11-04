<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskDependency extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'task_id',
        'prerequisite_task_id',
        'dependency_type',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function prerequisiteTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'prerequisite_task_id');
    }
}

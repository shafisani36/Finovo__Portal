<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskStatusHistory extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'task_status_history';

    protected $fillable = [
        'company_id',
        'task_id',
        'from_status',
        'to_status',
        'reason',
        'changed_by_membership_id',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'changed_by_membership_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'task_id',
        'uploaded_by_membership_id',
        'file_name',
        'file_path',
        'file_size',
        'mime_type',
        'is_evidence',
        'visibility',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'is_evidence' => 'boolean',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(CompanyMembership::class, 'uploaded_by_membership_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileUploadSession extends Model
{
    use HasFactory;

    protected $table = 'file_upload_sessions';

    protected $fillable = [
        'session_token',
        'company_id',
        'user_id',
        'folder_id',
        'expected_filename',
        'expected_size_bytes',
        'allowed_mime_types',
        'status',
        'expires_at',
    ];

    protected $casts = [
        'expected_size_bytes' => 'integer',
        'allowed_mime_types' => 'array',
        'expires_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(FileFolder::class, 'folder_id');
    }
}

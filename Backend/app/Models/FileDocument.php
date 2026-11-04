<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class FileDocument extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'files';

    protected $fillable = [
        'uuid',
        'company_id',
        'folder_id',
        'name',
        'original_name',
        'mime_type',
        'extension',
        'file_category',
        'size_bytes',
        'storage_key',
        'storage_disk',
        'cdn_url',
        'status',
        'is_starred',
        'is_public',
        'version_count',
        'current_version_id',
        'security_scan_status',
        'checksum_sha256',
        'metadata',
        'uploaded_by',
        'last_accessed_at',
    ];

    protected $casts = [
        'is_starred' => 'boolean',
        'is_public' => 'boolean',
        'size_bytes' => 'integer',
        'version_count' => 'integer',
        'metadata' => 'array',
        'last_accessed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(FileFolder::class, 'folder_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(FileVersion::class, 'file_id')->orderByDesc('version_number');
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(FileVersion::class, 'current_version_id');
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(FileAuditEvent::class, 'file_id')->orderByDesc('created_at');
    }

    public function shares(): HasMany
    {
        return $this->hasMany(FileShare::class, 'file_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileVersion extends Model
{
    use HasFactory;

    protected $table = 'file_versions';

    protected $fillable = [
        'file_id',
        'version_number',
        'storage_key',
        'size_bytes',
        'checksum_sha256',
        'mime_type',
        'security_scan_status',
        'changelog',
        'created_by',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'size_bytes' => 'integer',
    ];

    public function file(): BelongsTo
    {
        return $this->belongsTo(FileDocument::class, 'file_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

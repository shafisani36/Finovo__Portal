<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileShare extends Model
{
    use HasFactory;

    protected $table = 'file_shares';

    protected $fillable = [
        'company_id',
        'file_id',
        'share_token_hash',
        'recipient_email',
        'permission',
        'max_downloads',
        'download_count',
        'is_revoked',
        'expires_at',
        'created_by',
    ];

    protected $casts = [
        'max_downloads' => 'integer',
        'download_count' => 'integer',
        'is_revoked' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(FileDocument::class, 'file_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

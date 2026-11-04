<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FileFolder extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'file_folders';

    protected $fillable = [
        'company_id',
        'parent_id',
        'name',
        'slug',
        'color',
        'icon',
        'is_starred',
        'is_system',
        'path',
        'items_count',
        'created_by',
    ];

    protected $casts = [
        'is_starred' => 'boolean',
        'is_system' => 'boolean',
        'items_count' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(FileFolder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(FileFolder::class, 'parent_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(FileDocument::class, 'folder_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

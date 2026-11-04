<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'creator_user_id',
        'title',
        'content',
        'audience_type',
        'audience_target_id',
        'status',
        'requires_acknowledgment',
        'is_pinned',
        'published_at',
        'expires_at',
    ];

    protected $casts = [
        'requires_acknowledgment' => 'boolean',
        'is_pinned' => 'boolean',
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_user_id');
    }

    public function acknowledgments(): HasMany
    {
        return $this->hasMany(AnnouncementAcknowledgment::class);
    }
}

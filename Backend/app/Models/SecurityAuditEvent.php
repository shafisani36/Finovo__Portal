<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecurityAuditEvent extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'actor_user_id',
        'company_id',
        'event_type',
        'target_type',
        'target_id',
        'ip_address',
        'user_agent',
        'metadata',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'json',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public static function record(
        string $eventType,
        ?int $actorUserId = null,
        ?int $companyId = null,
        ?string $targetType = null,
        ?string $targetId = null,
        ?array $metadata = null
    ): self {
        return self::create([
            'actor_user_id' => $actorUserId ?? auth()->id(),
            'company_id' => $companyId,
            'event_type' => $eventType,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }

    public static function log(
        int $companyId,
        ?int $userId,
        string $eventType,
        string $status = 'success',
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?array $metadata = []
    ): self {
        return self::create([
            'actor_user_id' => $userId ?? auth()->id(),
            'company_id' => $companyId,
            'event_type' => $eventType,
            'target_type' => null,
            'target_id' => null,
            'ip_address' => $ipAddress ?? request()->ip(),
            'user_agent' => $userAgent ?? request()->userAgent(),
            'metadata' => array_merge($metadata ?? [], ['status' => $status]),
            'created_at' => now(),
        ]);
    }
}

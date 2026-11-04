<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MfaCredential extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'secret',
        'confirmed_at',
        'enabled_at',
        'recovery_codes',
    ];

    protected $hidden = [
        'secret',
        'recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'confirmed_at' => 'datetime',
            'enabled_at' => 'datetime',
            'recovery_codes' => 'encrypted:json',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isConfirmed(): bool
    {
        return $this->confirmed_at !== null && $this->enabled_at !== null;
    }
}

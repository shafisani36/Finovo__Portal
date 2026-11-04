<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringPolicyAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'policy_id',
        'target_type',
        'target_id',
    ];

    protected $casts = [
        'target_id' => 'integer',
    ];

    public function policy(): BelongsTo
    {
        return $this->belongsTo(MonitoringPolicy::class, 'policy_id');
    }
}

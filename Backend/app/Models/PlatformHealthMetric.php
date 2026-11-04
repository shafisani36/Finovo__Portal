<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformHealthMetric extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'metric_name',
        'value',
        'unit',
        'tags',
        'sampled_at',
    ];

    protected $casts = [
        'value' => 'decimal:4',
        'tags' => 'array',
        'sampled_at' => 'datetime',
    ];
}

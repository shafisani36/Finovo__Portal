<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReviewTemplate extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'sections' => 'array',
        'rating_scale' => 'array',
        'is_published' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function cycles()
    {
        return $this->hasMany(PerformanceReviewCycle::class, 'template_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReviewEvidenceLink extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function review()
    {
        return $this->belongsTo(PerformanceReview::class, 'review_id');
    }

    public function linkedBy()
    {
        return $this->belongsTo(User::class, 'linked_by_user_id');
    }
}

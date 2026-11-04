<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerformanceAppeal extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function review()
    {
        return $this->belongsTo(PerformanceReview::class, 'review_id');
    }

    public function employee()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employee_id');
    }

    public function resolver()
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }
}

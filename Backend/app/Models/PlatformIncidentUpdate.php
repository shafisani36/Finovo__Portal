<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformIncidentUpdate extends Model
{
    use HasFactory;

    protected $fillable = [
        'incident_id',
        'admin_user_id',
        'status',
        'message',
        'posted_at',
    ];

    protected $casts = [
        'posted_at' => 'datetime',
    ];

    public function incident()
    {
        return $this->belongsTo(PlatformIncident::class, 'incident_id');
    }

    public function adminUser()
    {
        return $this->belongsTo(PlatformAdminUser::class, 'admin_user_id');
    }
}

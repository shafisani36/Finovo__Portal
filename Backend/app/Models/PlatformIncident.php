<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformIncident extends Model
{
    use HasFactory;

    protected $fillable = [
        'incident_number',
        'title',
        'summary',
        'severity',
        'status',
        'affected_component',
        'lead_admin_id',
        'started_at',
        'resolved_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function leadAdmin()
    {
        return $this->belongsTo(PlatformAdminUser::class, 'lead_admin_id');
    }

    public function updates()
    {
        return $this->hasMany(PlatformIncidentUpdate::class, 'incident_id')->orderBy('posted_at', 'desc');
    }
}

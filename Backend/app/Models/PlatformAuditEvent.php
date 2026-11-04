<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformAuditEvent extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'admin_user_id',
        'company_id',
        'event_type',
        'target_entity_type',
        'target_entity_id',
        'ip_address',
        'user_agent',
        'correlation_id',
        'payload',
        'hash',
        'recorded_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'recorded_at' => 'datetime',
    ];

    public function adminUser()
    {
        return $this->belongsTo(PlatformAdminUser::class, 'admin_user_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}

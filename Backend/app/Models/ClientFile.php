<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_organization_id',
        'project_id',
        'title',
        'file_path',
        'file_name',
        'file_size_bytes',
        'mime_type',
        'classification',
        'uploaded_by_user_id',
        'download_count',
    ];

    protected $casts = [
        'file_size_bytes' => 'integer',
        'download_count' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function clientOrganization(): BelongsTo
    {
        return $this->belongsTo(ClientOrganization::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeDocument extends Model
{
    use HasFactory;

    protected $table = 'employee_documents';

    protected $fillable = [
        'company_id',
        'employment_record_id',
        'document_name',
        'document_type',
        'file_path',
        'file_size',
        'mime_type',
        'visibility',
        'expires_at',
        'uploaded_by_user_id',
    ];

    protected $casts = [
        'expires_at' => 'date',
        'file_size' => 'integer',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function employmentRecord()
    {
        return $this->belongsTo(EmploymentRecord::class, 'employment_record_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}

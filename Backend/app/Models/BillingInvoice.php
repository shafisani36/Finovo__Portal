<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillingInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'subscription_id',
        'invoice_number',
        'provider_invoice_id',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total',
        'currency',
        'status',
        'issued_at',
        'due_at',
        'paid_at',
        'hosted_invoice_url',
        'invoice_pdf_url',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'issued_at' => 'datetime',
        'due_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function subscription()
    {
        return $this->belongsTo(BillingSubscription::class, 'subscription_id');
    }

    public function payments()
    {
        return $this->hasMany(BillingPayment::class, 'invoice_id');
    }
}

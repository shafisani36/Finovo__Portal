<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request, Company $company): JsonResponse
    {
        $events = SecurityAuditEvent::where('company_id', $company->id)
            ->with('actor:id,name,email')
            ->latest('id')
            ->paginate(25);

        return response()->json($events);
    }
}

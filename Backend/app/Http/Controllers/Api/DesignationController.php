<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Designation;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DesignationController extends Controller
{
    public function index(Request $request, Company $company): JsonResponse
    {
        $designations = Designation::where('company_id', $company->id)
            ->withCount('employmentRecords')
            ->orderBy('level')
            ->orderBy('name')
            ->get();

        return response()->json([
            'designations' => $designations,
        ]);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('designations', 'name')->where('company_id', $company->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'level' => ['nullable', 'integer', 'min:1', 'max:20'],
            'description' => ['nullable', 'string'],
        ]);

        $designation = Designation::create([
            'company_id' => $company->id,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'level' => $validated['level'] ?? 1,
            'description' => $validated['description'] ?? null,
            'status' => 'active',
        ]);

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'designation.created',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: ['designation_id' => $designation->id, 'name' => $designation->name]
        );

        return response()->json([
            'message' => 'Designation created successfully',
            'designation' => $designation,
        ], 201);
    }

    public function update(Request $request, Company $company, Designation $designation): JsonResponse
    {
        if ($designation->company_id !== $company->id) {
            return response()->json(['message' => 'Designation not found in this company'], 404);
        }

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('designations', 'name')
                    ->where('company_id', $company->id)
                    ->ignore($designation->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'level' => ['nullable', 'integer', 'min:1', 'max:20'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', Rule::in(['active', 'archived'])],
        ]);

        $designation->update($validated);

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'designation.updated',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: ['designation_id' => $designation->id, 'updates' => array_keys($validated)]
        );

        return response()->json([
            'message' => 'Designation updated successfully',
            'designation' => $designation,
        ]);
    }

    public function destroy(Request $request, Company $company, Designation $designation): JsonResponse
    {
        if ($designation->company_id !== $company->id) {
            return response()->json(['message' => 'Designation not found in this company'], 404);
        }

        if ($designation->employmentRecords()->count() > 0) {
            $designation->update(['status' => 'archived']);

            return response()->json([
                'message' => 'Designation has active assignments. It was archived instead of deleted.',
                'designation' => $designation,
            ]);
        }

        $designation->delete();

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'designation.deleted',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: ['designation_id' => $designation->id, 'name' => $designation->name]
        );

        return response()->json(['message' => 'Designation deleted successfully']);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FileDocument;
use App\Models\Screenshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * Return dynamic sidebar storage statistics for the active company/user.
     */
    public function sidebarStats(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Determine company context
        $companySlug = $request->query('company') ?? $request->header('X-Company-Slug');
        $companyId = $request->query('company_id') ?? $request->header('X-Company-Id');

        $company = null;
        if ($companySlug) {
            $company = Company::where('slug', $companySlug)->first();
        } elseif ($companyId) {
            $company = Company::find($companyId);
        }

        if (!$company) {
            // Find active or first membership
            $membership = CompanyMembership::where('user_id', $user->id)
                ->where('status', 'active')
                ->first();
            if ($membership) {
                $company = $membership->company;
            } else {
                $company = Company::first();
            }
        }

        $allocatedBytes = 50 * 1024 * 1024 * 1024; // 50 GB default allocated storage

        if (!$company) {
            return response()->json([
                'storage_used_bytes' => 0,
                'storage_allocated_bytes' => $allocatedBytes,
                'used_gb' => 0,
                'total_gb' => 50,
                'percentage' => 0,
            ]);
        }

        $totalFileBytes = (int) FileDocument::where('company_id', $company->id)->sum('size_bytes');
        
        // Count approximate screenshot bytes
        $screenshotCount = Screenshot::whereHas('attendanceRecord', function ($q) use ($company) {
            $q->where('company_id', $company->id);
        })->count();
        $screenshotBytes = $screenshotCount * 180 * 1024;

        $totalUsedBytes = $totalFileBytes + $screenshotBytes;

        $usedGb = round($totalUsedBytes / (1024 * 1024 * 1024), 2);
        $totalGb = 50;
        $percentage = $allocatedBytes > 0 ? min(100, round(($totalUsedBytes / $allocatedBytes) * 100, 1)) : 0;

        return response()->json([
            'company_id' => $company->id,
            'company_slug' => $company->slug,
            'storage_used_bytes' => $totalUsedBytes,
            'storage_allocated_bytes' => $allocatedBytes,
            'used_gb' => $usedGb,
            'total_gb' => $totalGb,
            'percentage' => $percentage,
            'total_files' => FileDocument::where('company_id', $company->id)->count(),
            'total_screenshots' => $screenshotCount,
        ]);
    }
}

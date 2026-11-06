<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\FileDocument;
use App\Models\Screenshot;
use App\Services\Billing\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Throwable;

class DashboardController extends Controller
{
    private const BYTES_PER_GB = 1024 * 1024 * 1024;
    private const DEFAULT_STORAGE_GB = 50;

    /**
     * Real storage usage for the sidebar widget.
     *
     * Used bytes = actual size of every file stored for the company (files portal + screenshots).
     * Allocated bytes = the company's plan "storage_gb" entitlement, falling back to the default quota.
     */
    public function sidebarStats(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $company = $this->resolveCompany($request, $user->id);

        if (!$company) {
            return response()->json($this->buildPayload(null, 0, $this->defaultAllocatedBytes(), 0, 0));
        }

        $usedBytes = (int) FileDocument::where('company_id', $company->id)->sum('size_bytes');
        $totalFiles = FileDocument::where('company_id', $company->id)->count();
        $totalScreenshots = Screenshot::whereHas('attendanceRecord', function ($query) use ($company) {
            $query->where('company_id', $company->id);
        })->count();

        return response()->json(
            $this->buildPayload($company, $usedBytes, $this->resolveAllocatedBytes($company), $totalFiles, $totalScreenshots)
        );
    }

    /**
     * Company comes from the scoped route (/companies/{company}/storage-stats, already verified by
     * the company.access middleware) or, for the direct route, from a company the user is an active member of.
     */
    private function resolveCompany(Request $request, int $userId): ?Company
    {
        $scopedCompany = $request->attributes->get('currentCompany');
        if ($scopedCompany instanceof Company) {
            return $scopedCompany;
        }

        $memberships = CompanyMembership::where('user_id', $userId)
            ->where('status', 'active')
            ->whereNull('revoked_at')
            ->with('company');

        $companySlug = $request->query('company') ?? $request->header('X-Company-Slug');
        $companyId = $request->query('company_id') ?? $request->header('X-Company-Id');

        if ($companySlug) {
            $memberships->whereHas('company', fn ($query) => $query->where('slug', $companySlug));
        } elseif ($companyId) {
            $memberships->where('company_id', $companyId);
        }

        return $memberships->first()?->company;
    }

    private function resolveAllocatedBytes(Company $company): int
    {
        try {
            $entitlement = app(EntitlementService::class)->getEntitlement($company, 'storage_gb');
            $limitGb = (int) ($entitlement['limit'] ?? 0);

            if (($entitlement['enabled'] ?? false) && $limitGb > 0) {
                return $limitGb * self::BYTES_PER_GB;
            }
        } catch (Throwable $exception) {
            report($exception);
        }

        return $this->defaultAllocatedBytes();
    }

    private function defaultAllocatedBytes(): int
    {
        return self::DEFAULT_STORAGE_GB * self::BYTES_PER_GB;
    }

    private function buildPayload(?Company $company, int $usedBytes, int $allocatedBytes, int $totalFiles, int $totalScreenshots): array
    {
        $percentage = $allocatedBytes > 0 ? min(100, round(($usedBytes / $allocatedBytes) * 100, 2)) : 0;

        return [
            'company_id'              => $company?->id,
            'company_slug'            => $company?->slug,
            'storage_used_bytes'      => $usedBytes,
            'storage_allocated_bytes' => $allocatedBytes,
            'used_gb'                 => round($usedBytes / self::BYTES_PER_GB, 2),
            'total_gb'                => (int) round($allocatedBytes / self::BYTES_PER_GB),
            'percentage'              => $percentage,
            'total_files'             => $totalFiles,
            'total_screenshots'       => $totalScreenshots,
        ];
    }
}

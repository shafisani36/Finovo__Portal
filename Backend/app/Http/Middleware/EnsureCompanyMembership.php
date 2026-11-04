<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCompanyMembership
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $companyParam = $request->route('company');

        if (! $user) {
            return response()->json(['message' => 'Authentication required.'], 401);
        }

        $company = null;
        if ($companyParam instanceof Company) {
            $company = $companyParam;
        } elseif (is_string($companyParam) || is_numeric($companyParam)) {
            $company = Company::where('slug', (string) $companyParam)
                ->orWhere('id', (string) $companyParam)
                ->first();
        }

        if (! $company) {
            return response()->json(['message' => 'Workspace not found.'], 404);
        }

        if ($company->status !== 'active') {
            return response()->json(['message' => 'Workspace is currently suspended or inactive.'], 403);
        }

        $membership = $company->memberships()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->whereNull('revoked_at')
            ->with(['roles.permissions', 'employeeProfile'])
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Access denied. You are not an active member of this workspace.'], 403);
        }

        $request->attributes->set('currentCompany', $company);
        $request->attributes->set('currentMembership', $membership);

        return $next($request);
    }
}

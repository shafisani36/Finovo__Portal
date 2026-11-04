<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireCompanyPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $membership = $request->attributes->get('currentMembership');

        if (! $membership) {
            return response()->json(['message' => 'Workspace access required.'], 403);
        }

        foreach ($permissions as $permission) {
            if (! $membership->hasPermission($permission)) {
                return response()->json([
                    'message' => 'Forbidden. Insufficient permissions for this action.',
                    'required_permission' => $permission,
                ], 403);
            }
        }

        return $next($request);
    }
}

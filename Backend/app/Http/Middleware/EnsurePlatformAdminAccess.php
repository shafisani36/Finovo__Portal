<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\PlatformAdminUser;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAdminAccess
{
    /**
     * Handle an incoming request.
     * Enforces privileged platform role separation (Section 28).
     */
    public function handle(Request $request, Closure $next, ?string $requiredPermission = null): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'UNAUTHENTICATED',
                'message' => 'Platform administration requires authenticated credentials.',
            ], 401);
        }

        $adminUser = PlatformAdminUser::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('role')
            ->first();

        if (!$adminUser) {
            return response()->json([
                'success' => false,
                'error' => 'PLATFORM_ACCESS_DENIED',
                'message' => 'You do not possess privileged SaaS platform operational authorization.',
            ], 403);
        }

        if ($adminUser->access_expires_at && $adminUser->access_expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'error' => 'ELEVATED_ACCESS_EXPIRED',
                'message' => 'Your elevated platform operational lease has expired.',
            ], 403);
        }

        if ($requiredPermission && !$adminUser->hasPermission($requiredPermission)) {
            return response()->json([
                'success' => false,
                'error' => 'INSUFFICIENT_PLATFORM_PERMISSION',
                'message' => "This platform operation mandates '{$requiredPermission}' capability.",
            ], 403);
        }

        $adminUser->update(['last_active_at' => now()]);
        $request->attributes->set('platform_admin_user', $adminUser);

        return $next($request);
    }
}

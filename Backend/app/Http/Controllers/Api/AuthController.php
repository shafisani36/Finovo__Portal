<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\SecurityAuditEvent;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = DB::transaction(function () use ($validated) {
            return User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'], // Casts attribute hashes automatically
                'status' => 'active',
                'timezone' => 'UTC',
                'locale' => 'en',
            ]);
        });

        event(new Registered($user));

        SecurityAuditEvent::record('auth.registered', $user->id, null, 'user', (string) $user->id, [
            'email' => $user->email,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'email_verified' => $user->hasVerifiedEmail(),
            ],
            'token' => $token,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $throttleKey = 'login:' . Str::lower($request->input('email')) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => "Too many login attempts. Please try again in {$seconds} seconds.",
            ], 429);
        }

        $user = User::where('email', $request->input('email'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            SecurityAuditEvent::record('auth.login.failed', $user?->id, null, 'user', (string) $user?->id, [
                'email' => $request->input('email'),
                'reason' => 'invalid_credentials',
            ]);

            return response()->json([
                'message' => 'The provided credentials do not match our records.',
            ], 422);
        }

        if ($user->status !== 'active') {
            SecurityAuditEvent::record('auth.login.rejected', $user->id, null, 'user', (string) $user->id, [
                'status' => $user->status,
            ]);

            return response()->json([
                'message' => 'Your account is currently inactive or suspended. Please contact support.',
            ], 403);
        }

        RateLimiter::clear($throttleKey);

        // Check if MFA is enabled
        if ($user->isMfaEnabled()) {
            $challengeToken = Str::random(64);
            Cache::put("mfa_challenge:{$challengeToken}", $user->id, now()->addMinutes(5));

            SecurityAuditEvent::record('auth.mfa.challenge_issued', $user->id, null, 'user', (string) $user->id);

            return response()->json([
                'mfa_required' => true,
                'challenge_token' => $challengeToken,
                'message' => 'Multi-factor authentication required.',
            ], 200);
        }

        // Generate token and record login
        $token = $user->createToken('auth-token')->plainTextToken;

        SecurityAuditEvent::record('auth.login.success', $user->id, null, 'user', (string) $user->id);

        return response()->json([
            'message' => 'Login successful.',
            'user' => $this->formatSafeUser($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->currentAccessToken()?->delete();
            SecurityAuditEvent::record('auth.logout', $user->id, null, 'user', (string) $user->id);
        }

        return response()->json([
            'message' => 'Successfully logged out.',
        ]);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->tokens()->delete();
            SecurityAuditEvent::record('auth.logout_all', $user->id, null, 'user', (string) $user->id);
        }

        return response()->json([
            'message' => 'All active sessions have been revoked.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['memberships.company', 'memberships.roles.permissions']);

        return response()->json([
            'user' => $this->formatSafeUser($user),
            'companies' => $user->memberships->map(function ($membership) {
                return [
                    'membership_id' => $membership->id,
                    'status' => $membership->status,
                    'joined_at' => $membership->joined_at,
                    'company' => [
                        'id' => $membership->company->id,
                        'name' => $membership->company->name,
                        'slug' => $membership->company->slug,
                        'status' => $membership->company->status,
                        'timezone' => $membership->company->timezone,
                    ],
                    'roles' => $membership->roles->map(fn ($r) => [
                        'id' => $r->id,
                        'name' => $r->name,
                        'slug' => $r->slug,
                    ]),
                    'permissions' => $membership->roles
                        ->flatMap(fn ($r) => $r->permissions)
                        ->pluck('key')
                        ->unique()
                        ->values(),
                ];
            }),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $throttleKey = 'forgot-pw:' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 3)) {
            return response()->json([
                'message' => 'Too many requests. Please wait before trying again.',
            ], 429);
        }
        RateLimiter::hit($throttleKey, 60);

        Password::sendResetLink($request->only('email'));

        SecurityAuditEvent::record('auth.password_reset_requested', null, null, 'user', null, [
            'email' => $request->input('email'),
        ]);

        return response()->json([
            'message' => 'If an account exists with that email address, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                // Revoke existing tokens on password reset for security
                $user->tokens()->delete();
                SecurityAuditEvent::record('auth.password_reset_completed', $user->id, null, 'user', (string) $user->id);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Your password has been successfully reset. Please sign in.',
            ]);
        }

        return response()->json([
            'message' => 'Unable to reset password. The link may have expired or is invalid.',
        ], 422);
    }

    public function verifyEmail(Request $request, $id, $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return response()->json(['message' => 'Invalid verification link.'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email is already verified.']);
        }

        if ($user->markEmailAsVerified()) {
            event(new \Illuminate\Auth\Events\Verified($user));
            SecurityAuditEvent::record('auth.email_verified', $user->id, null, 'user', (string) $user->id);
        }

        return response()->json(['message' => 'Email successfully verified.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email is already verified.'], 400);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification link sent.']);
    }

    protected function formatSafeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'timezone' => $user->timezone,
            'locale' => $user->locale,
            'profile_photo_url' => $user->profile_photo_path,
            'email_verified' => $user->hasVerifiedEmail(),
            'mfa_enabled' => $user->isMfaEnabled(),
            'created_at' => $user->created_at,
        ];
    }
}

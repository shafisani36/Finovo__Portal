<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MfaCredential;
use App\Models\SecurityAuditEvent;
use App\Models\User;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class MfaController extends Controller
{
    public function __construct(protected MfaService $mfaService)
    {
    }

    public function enroll(Request $request): JsonResponse
    {
        $user = $request->user();

        $secret = $this->mfaService->generateSecret();
        $qrUrl = $this->mfaService->getQrCodeUrl('BITSpark OS', $user->email, $secret);

        MfaCredential::updateOrCreate(
            ['user_id' => $user->id],
            [
                'secret' => $secret,
                'confirmed_at' => null,
                'enabled_at' => null,
            ]
        );

        SecurityAuditEvent::record('auth.mfa.enroll_started', $user->id, null, 'user', (string) $user->id);

        return response()->json([
            'secret' => $secret,
            'qr_code_url' => $qrUrl,
            'message' => 'Scan the QR code or enter the secret in your authenticator app, then verify with a 6-digit code.',
        ]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'min:6', 'max:8'],
        ]);

        $user = $request->user();
        $credential = $user->mfaCredential;

        if (! $credential || empty($credential->secret)) {
            return response()->json([
                'message' => 'No active MFA enrollment found. Please start enrollment first.',
            ], 400);
        }

        if (! $this->mfaService->verifyCode($credential->secret, $request->input('code'))) {
            SecurityAuditEvent::record('auth.mfa.confirm_failed', $user->id, null, 'user', (string) $user->id);

            return response()->json([
                'message' => 'The provided authentication code is invalid or has expired.',
            ], 422);
        }

        $recoveryCodes = $this->mfaService->generateRecoveryCodes(8);

        $credential->update([
            'confirmed_at' => now(),
            'enabled_at' => now(),
            'recovery_codes' => $recoveryCodes['hashed'],
        ]);

        SecurityAuditEvent::record('auth.mfa.enabled', $user->id, null, 'user', (string) $user->id);

        return response()->json([
            'message' => 'Two-factor authentication has been enabled successfully.',
            'recovery_codes' => $recoveryCodes['plain'],
        ]);
    }

    public function challenge(Request $request): JsonResponse
    {
        $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        $challengeToken = $request->input('challenge_token');
        $throttleKey = 'mfa-challenge:' . $request->ip() . '|' . $challengeToken;

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => "Too many verification attempts. Please try again in {$seconds} seconds.",
            ], 429);
        }

        $userId = Cache::get("mfa_challenge:{$challengeToken}");

        if (! $userId) {
            return response()->json([
                'message' => 'The MFA challenge session has expired or is invalid. Please sign in again.',
            ], 401);
        }

        $user = User::find($userId);
        if (! $user || ! $user->isMfaEnabled()) {
            return response()->json([
                'message' => 'Invalid user MFA context.',
            ], 400);
        }

        $credential = $user->mfaCredential;
        $code = $request->input('code');
        $recoveryCode = $request->input('recovery_code');

        $verified = false;

        if ($code) {
            $verified = $this->mfaService->verifyCode($credential->secret, $code);
        } elseif ($recoveryCode) {
            $remaining = $this->mfaService->verifyRecoveryCode((array) $credential->recovery_codes, $recoveryCode);
            if ($remaining !== null) {
                $credential->update(['recovery_codes' => $remaining]);
                $verified = true;
                SecurityAuditEvent::record('auth.mfa.recovery_code_used', $user->id, null, 'user', (string) $user->id);
            }
        }

        if (! $verified) {
            RateLimiter::hit($throttleKey, 300);
            SecurityAuditEvent::record('auth.mfa.challenge_failed', $user->id, null, 'user', (string) $user->id);

            return response()->json([
                'message' => 'The provided MFA code is invalid.',
            ], 422);
        }

        RateLimiter::clear($throttleKey);
        Cache::forget("mfa_challenge:{$challengeToken}");
        $token = $user->createToken('auth-token')->plainTextToken;

        SecurityAuditEvent::record('auth.mfa.challenge_success', $user->id, null, 'user', (string) $user->id);

        return response()->json([
            'message' => 'Verification successful.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'email_verified' => $user->hasVerifiedEmail(),
            ],
            'token' => $token,
        ]);
    }

    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            return response()->json([
                'message' => 'Password confirmation failed.',
            ], 422);
        }

        $user->mfaCredential()?->delete();

        SecurityAuditEvent::record('auth.mfa.disabled', $user->id, null, 'user', (string) $user->id);

        return response()->json([
            'message' => 'Two-factor authentication has been disabled.',
        ]);
    }
}

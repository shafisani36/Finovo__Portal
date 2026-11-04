<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\SendInvitationRequest;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    public function store(SendInvitationRequest $request, Company $company): JsonResponse
    {
        $user = $request->user();

        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (! $membership || ! $membership->hasPermission('members.invite')) {
            return response()->json([
                'message' => 'Unauthorized. You do not have permission to invite members to this company.',
            ], 403);
        }

        $validated = $request->validated();
        $targetEmail = $validated['email'];

        // Verify if user is already a member
        $existingMembership = CompanyMembership::where('company_id', $company->id)
            ->whereHas('user', fn ($q) => $q->where('email', $targetEmail))
            ->where('status', 'active')
            ->first();

        if ($existingMembership) {
            return response()->json([
                'message' => 'This user is already an active member of the company.',
            ], 422);
        }

        $rawToken = Str::random(48);
        $tokenHash = hash('sha256', $rawToken);

        $invitation = Invitation::create([
            'company_id' => $company->id,
            'email' => $targetEmail,
            'token_hash' => $tokenHash,
            'role_id' => $validated['role_id'],
            'invited_by_membership_id' => $membership->id,
            'expires_at' => now()->addDays(7),
        ]);

        SecurityAuditEvent::record('invitation.sent', $user->id, $company->id, 'invitation', (string) $invitation->id, [
            'recipient_email' => $targetEmail,
        ]);

        return response()->json([
            'message' => 'Invitation sent successfully.',
            'invitation_id' => $invitation->id,
            'invitation_token' => $rawToken, // Provided for direct verification / email template
            'expires_at' => $invitation->expires_at,
        ], 201);
    }

    public function show(string $token): JsonResponse
    {
        $tokenHash = hash('sha256', $token);

        $invitation = Invitation::where('token_hash', $tokenHash)
            ->with(['company', 'role'])
            ->first();

        if (! $invitation || ! $invitation->isValid()) {
            return response()->json([
                'message' => 'This invitation is invalid or has expired.',
            ], 404);
        }

        return response()->json([
            'company_name' => $invitation->company->name,
            'company_slug' => $invitation->company->slug,
            'role_name' => $invitation->role->name,
            'email' => $invitation->email,
            'expires_at' => $invitation->expires_at,
        ]);
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $user = $request->user();
        $tokenHash = hash('sha256', $token);

        return DB::transaction(function () use ($user, $tokenHash) {
            $invitation = Invitation::where('token_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if (! $invitation || ! $invitation->isValid()) {
                return response()->json([
                    'message' => 'This invitation is invalid, expired, or has already been used.',
                ], 422);
            }

            // Ensure email matches authenticated identity
            if (strtolower($user->email) !== strtolower($invitation->email)) {
                return response()->json([
                    'message' => 'Your authenticated email does not match the invitation email.',
                ], 403);
            }

            // Check duplicate membership
            $membership = CompanyMembership::firstOrCreate(
                ['company_id' => $invitation->company_id, 'user_id' => $user->id],
                ['status' => 'active', 'joined_at' => now()]
            );

            $membership->update(['status' => 'active', 'revoked_at' => null]);
            $membership->roles()->syncWithoutDetaching([$invitation->role_id]);

            $invitation->update(['accepted_at' => now()]);

            SecurityAuditEvent::record('invitation.accepted', $user->id, $invitation->company_id, 'invitation', (string) $invitation->id);

            return response()->json([
                'message' => 'Invitation accepted successfully.',
                'company_slug' => $invitation->company->slug,
            ]);
        });
    }
}

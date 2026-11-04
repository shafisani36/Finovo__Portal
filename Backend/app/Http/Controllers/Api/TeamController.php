<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\EmploymentRecord;
use App\Models\SecurityAuditEvent;
use App\Models\Team;
use App\Models\TeamMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    public function index(Request $request, Company $company): JsonResponse
    {
        $teams = Team::where('company_id', $company->id)
            ->with(['department:id,name', 'teamLead.user:id,name,email', 'activeMemberships.employmentRecord.user'])
            ->withCount('activeMemberships')
            ->orderBy('name')
            ->get();

        return response()->json([
            'teams' => $teams,
        ]);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('teams', 'name')->where('company_id', $company->id),
            ],
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'team_lead_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
        ]);

        $team = Team::create([
            'company_id' => $company->id,
            'department_id' => $validated['department_id'] ?? null,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'team_lead_membership_id' => $validated['team_lead_membership_id'] ?? null,
            'status' => 'active',
        ]);

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'team.created',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: ['team_id' => $team->id, 'name' => $team->name]
        );

        return response()->json([
            'message' => 'Team created successfully',
            'team' => $team->load(['department:id,name', 'teamLead.user:id,name,email']),
        ], 201);
    }

    public function show(Request $request, Company $company, Team $team): JsonResponse
    {
        if ($team->company_id !== $company->id) {
            return response()->json(['message' => 'Team not found in this company'], 404);
        }

        $team->load([
            'department:id,name',
            'teamLead.user:id,name,email',
            'activeMemberships.employmentRecord.user:id,name,email',
            'activeMemberships.employmentRecord.designation:id,name',
        ]);

        return response()->json(['team' => $team]);
    }

    public function update(Request $request, Company $company, Team $team): JsonResponse
    {
        if ($team->company_id !== $company->id) {
            return response()->json(['message' => 'Team not found in this company'], 404);
        }

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('teams', 'name')->where('company_id', $company->id)->ignore($team->id),
            ],
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('company_id', $company->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'team_lead_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'status' => ['nullable', 'string', Rule::in(['active', 'archived'])],
        ]);

        $team->update($validated);

        return response()->json([
            'message' => 'Team updated successfully',
            'team' => $team->fresh(['department:id,name', 'teamLead.user:id,name,email']),
        ]);
    }

    public function destroy(Request $request, Company $company, Team $team): JsonResponse
    {
        if ($team->company_id !== $company->id) {
            return response()->json(['message' => 'Team not found in this company'], 404);
        }

        if ($team->activeMemberships()->count() > 0) {
            $team->update(['status' => 'archived']);

            return response()->json([
                'message' => 'Team has active members. It was archived instead of deleted.',
                'team' => $team,
            ]);
        }

        $team->delete();

        return response()->json(['message' => 'Team deleted successfully']);
    }

    public function addMember(Request $request, Company $company, Team $team): JsonResponse
    {
        if ($team->company_id !== $company->id) {
            return response()->json(['message' => 'Team not found in this company'], 404);
        }

        $validated = $request->validate([
            'employment_record_id' => [
                'required',
                'integer',
                Rule::exists('employment_records', 'id')->where('company_id', $company->id),
            ],
            'membership_type' => ['nullable', 'string', Rule::in(['primary', 'secondary', 'cross_functional'])],
            'effective_from' => ['nullable', 'date'],
        ]);

        // Check if already an active member of this team
        $existing = TeamMembership::where('team_id', $team->id)
            ->where('employment_record_id', $validated['employment_record_id'])
            ->whereNull('effective_to')
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Employee is already an active member of this team'], 422);
        }

        $membership = TeamMembership::create([
            'company_id' => $company->id,
            'team_id' => $team->id,
            'employment_record_id' => $validated['employment_record_id'],
            'membership_type' => $validated['membership_type'] ?? 'primary',
            'effective_from' => $validated['effective_from'] ?? now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Member added to team successfully',
            'membership' => $membership->load('employmentRecord.user:id,name,email'),
        ], 201);
    }

    public function removeMember(Request $request, Company $company, Team $team, TeamMembership $membership): JsonResponse
    {
        if ($team->company_id !== $company->id || $membership->team_id !== $team->id) {
            return response()->json(['message' => 'Membership not found in this team'], 404);
        }

        // Close effective period rather than destroying history
        $membership->update([
            'effective_to' => now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Team membership ended successfully',
        ]);
    }
}

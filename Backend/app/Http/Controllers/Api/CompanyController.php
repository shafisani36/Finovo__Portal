<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\CreateCompanyRequest;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompanySettings;
use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompanyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $companies = $user->companies()
            ->wherePivot('status', 'active')
            ->wherePivotNull('revoked_at')
            ->get();

        return response()->json([
            'companies' => $companies,
        ]);
    }

    public function store(CreateCompanyRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $company = DB::transaction(function () use ($user, $validated) {
            $company = Company::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'status' => 'active',
                'timezone' => $validated['timezone'] ?? 'UTC',
                'locale' => $validated['locale'] ?? 'en',
            ]);

            $membership = CompanyMembership::create([
                'company_id' => $company->id,
                'user_id' => $user->id,
                'status' => 'active',
                'joined_at' => now(),
            ]);

            // Ensure owner and admin system roles exist
            $ownerRole = Role::firstOrCreate(
                ['slug' => 'company-owner', 'company_id' => null],
                ['name' => 'Company Owner', 'description' => 'Full administrative access and company ownership', 'is_system' => true]
            );

            $adminRole = Role::firstOrCreate(
                ['slug' => 'company-admin', 'company_id' => null],
                ['name' => 'Company Administrator', 'description' => 'Administrative control across organizational features', 'is_system' => true]
            );

            // Ensure system permissions exist and are attached to owner & admin
            $allPermissions = Permission::pluck('id');
            if ($allPermissions->isNotEmpty()) {
                if ($ownerRole->permissions()->count() === 0) {
                    $ownerRole->permissions()->sync($allPermissions);
                }
                if ($adminRole->permissions()->count() === 0) {
                    $adminRole->permissions()->sync($allPermissions);
                }
            }

            // Grant both owner and company-admin roles to workspace creator
            $membership->roles()->syncWithoutDetaching([$ownerRole->id, $adminRole->id]);

            CompanySettings::create([
                'company_id' => $company->id,
                'working_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                'fiscal_year_start' => '01-01',
                'allow_employee_invites' => false,
                'enforce_mfa' => false,
                'session_timeout_minutes' => 1440,
                'date_format' => 'YYYY-MM-DD',
                'time_format' => '12h',
            ]);

            EmployeeProfile::create([
                'membership_id' => $membership->id,
                'designation' => 'Founder & Owner',
            ]);

            SecurityAuditEvent::record('company.created', $user->id, $company->id, 'company', (string) $company->id, [
                'name' => $company->name,
                'slug' => $company->slug,
            ]);

            return $company;
        });

        return response()->json([
            'message' => 'Company workspace created successfully.',
            'company' => $company,
        ], 201);
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $membership = $request->attributes->get('currentMembership')
            ?? CompanyMembership::where('company_id', $company->id)
                ->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->whereNull('revoked_at')
                ->first();

        if (! $membership) {
            return response()->json([
                'message' => 'Unauthorized. You are not an active member of this company.',
            ], 403);
        }

        $membership->load(['roles.permissions', 'employeeProfile.department']);

        $employeeCount = CompanyMembership::where('company_id', $company->id)
            ->where('status', 'active')
            ->count();

        $departmentCount = Department::where('company_id', $company->id)
            ->where('status', 'active')
            ->count();

        $pendingInvites = Invitation::where('company_id', $company->id)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->count();

        $recentAudits = SecurityAuditEvent::where('company_id', $company->id)
            ->latest('id')
            ->take(5)
            ->get();

        return response()->json([
            'company' => $company,
            'stats' => [
                'employee_count' => $employeeCount,
                'department_count' => $departmentCount,
                'pending_invitations' => $pendingInvites,
            ],
            'recent_activity' => $recentAudits,
            'membership' => [
                'id' => $membership->id,
                'status' => $membership->status,
                'roles' => $membership->roles,
                'permissions' => $membership->roles->flatMap(fn ($r) => $r->permissions)->pluck('key')->unique()->values(),
                'profile' => $membership->employeeProfile,
            ],
        ]);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:50', 'timezone:all'],
            'locale' => ['sometimes', 'string', 'max:10'],
            'logo_path' => ['nullable', 'string', 'max:255'],
        ]);

        $company->update($validated);

        SecurityAuditEvent::record('company.updated', $request->user()->id, $company->id, 'company', (string) $company->id, $validated);

        return response()->json([
            'message' => 'Workspace settings updated successfully.',
            'company' => $company,
        ]);
    }
}

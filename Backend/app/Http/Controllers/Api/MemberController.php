<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmployeeProfile;
use App\Models\Role;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberController extends Controller
{
    public function index(Request $request, Company $company): JsonResponse
    {
        $query = CompanyMembership::where('company_id', $company->id)
            ->with(['user', 'roles', 'employeeProfile.department']);

        // Search by name or email
        if ($search = $request->query('search')) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Filter by role
        if ($roleId = $request->query('role_id')) {
            $query->whereHas('roles', fn ($q) => $q->where('roles.id', $roleId));
        }

        // Filter by department
        if ($departmentId = $request->query('department_id')) {
            $query->whereHas('employeeProfile', fn ($q) => $q->where('department_id', $departmentId));
        }

        $perPage = min((int) ($request->query('per_page', 15)), 100);
        $members = $query->latest('id')->paginate($perPage);

        return response()->json($members);
    }

    public function show(Request $request, Company $company, CompanyMembership $member): JsonResponse
    {
        if ($member->company_id !== $company->id) {
            return response()->json(['message' => 'Member does not belong to this company.'], 404);
        }

        $member->load(['user', 'roles', 'employeeProfile.department']);

        return response()->json(['member' => $member]);
    }

    public function update(Request $request, Company $company, CompanyMembership $member): JsonResponse
    {
        if ($member->company_id !== $company->id) {
            return response()->json(['message' => 'Member does not belong to this company.'], 404);
        }

        $validated = $request->validate([
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'designation' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'employee_id_number' => ['nullable', 'string', 'max:50'],
        ]);

        DB::transaction(function () use ($company, $member, $validated, $request) {
            // Role update with last-owner protection
            if (isset($validated['role_id'])) {
                $newRole = Role::findOrFail($validated['role_id']);
                $isCurrentlyOwner = $member->hasRole('company-owner');
                $isChangingAwayFromOwner = $isCurrentlyOwner && $newRole->slug !== 'company-owner';

                if ($isChangingAwayFromOwner) {
                    $activeOwnerCount = CompanyMembership::where('company_id', $company->id)
                        ->where('status', 'active')
                        ->whereNull('revoked_at')
                        ->whereHas('roles', fn ($q) => $q->where('slug', 'company-owner'))
                        ->count();

                    if ($activeOwnerCount <= 1) {
                        abort(422, 'Cannot demote the last remaining owner of this company.');
                    }
                }

                $member->roles()->sync([$validated['role_id']]);
            }

            // Employee profile update or creation
            $profile = $member->employeeProfile ?? new EmployeeProfile(['membership_id' => $member->id]);
            if (array_key_exists('designation', $validated)) {
                $profile->designation = $validated['designation'];
            }
            if (array_key_exists('department_id', $validated)) {
                $profile->department_id = $validated['department_id'];
            }
            if (array_key_exists('phone_number', $validated)) {
                $profile->phone_number = $validated['phone_number'];
            }
            if (array_key_exists('employee_id_number', $validated)) {
                $profile->employee_id_number = $validated['employee_id_number'];
            }
            $profile->save();

            SecurityAuditEvent::record('member.updated', $request->user()->id, $company->id, 'company_membership', (string) $member->id, [
                'target_user_id' => $member->user_id,
            ]);
        });

        $member->load(['user', 'roles', 'employeeProfile.department']);

        return response()->json([
            'message' => 'Member details updated successfully.',
            'member' => $member,
        ]);
    }

    public function suspend(Request $request, Company $company, CompanyMembership $member): JsonResponse
    {
        if ($member->company_id !== $company->id) {
            return response()->json(['message' => 'Member does not belong to this company.'], 404);
        }

        // Last owner check
        if ($member->hasRole('company-owner')) {
            $activeOwnerCount = CompanyMembership::where('company_id', $company->id)
                ->where('status', 'active')
                ->whereNull('revoked_at')
                ->whereHas('roles', fn ($q) => $q->where('slug', 'company-owner'))
                ->count();

            if ($activeOwnerCount <= 1) {
                return response()->json([
                    'message' => 'Cannot suspend the last remaining owner of this company.',
                ], 422);
            }
        }

        $member->update(['status' => 'suspended']);

        SecurityAuditEvent::record('member.suspended', $request->user()->id, $company->id, 'company_membership', (string) $member->id, [
            'target_user_id' => $member->user_id,
        ]);

        return response()->json([
            'message' => 'Member access has been suspended.',
            'member' => $member->fresh(['user', 'roles', 'employeeProfile']),
        ]);
    }

    public function reactivate(Request $request, Company $company, CompanyMembership $member): JsonResponse
    {
        if ($member->company_id !== $company->id) {
            return response()->json(['message' => 'Member does not belong to this company.'], 404);
        }

        $member->update([
            'status' => 'active',
            'revoked_at' => null,
        ]);

        SecurityAuditEvent::record('member.reactivated', $request->user()->id, $company->id, 'company_membership', (string) $member->id, [
            'target_user_id' => $member->user_id,
        ]);

        return response()->json([
            'message' => 'Member access has been reactivated.',
            'member' => $member->fresh(['user', 'roles', 'employeeProfile']),
        ]);
    }

    public function destroy(Request $request, Company $company, CompanyMembership $member): JsonResponse
    {
        if ($member->company_id !== $company->id) {
            return response()->json(['message' => 'Member does not belong to this company.'], 404);
        }

        // Last owner check
        if ($member->hasRole('company-owner')) {
            $activeOwnerCount = CompanyMembership::where('company_id', $company->id)
                ->where('status', 'active')
                ->whereNull('revoked_at')
                ->whereHas('roles', fn ($q) => $q->where('slug', 'company-owner'))
                ->count();

            if ($activeOwnerCount <= 1) {
                return response()->json([
                    'message' => 'Cannot remove the last remaining owner of this company.',
                ], 422);
            }
        }

        $member->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        SecurityAuditEvent::record('member.revoked', $request->user()->id, $company->id, 'company_membership', (string) $member->id, [
            'target_user_id' => $member->user_id,
        ]);

        return response()->json([
            'message' => 'Member access has been revoked from this company.',
        ]);
    }
}

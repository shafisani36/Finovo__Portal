<?php

namespace App\Domain\Lifecycle\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Lifecycle\Services\LifecycleDagEngine;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Http\Controllers\Controller;
use App\Models\AccessRevocationRequest;
use App\Models\EmployeeAssetAllocation;
use App\Models\LifecycleInstance;
use App\Models\LifecycleTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LifecycleController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected LifecycleDagEngine $dagEngine
    ) {}

    /**
     * List onboarding & offboarding lifecycle instances
     */
    public function indexInstances(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'lifecycle.onboarding.manage');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $instances = LifecycleInstance::where('company_id', $company->id)
            ->with(['employmentRecord.membership.user', 'employmentRecord.department', 'tasks'])
            ->withCount(['tasks as completed_tasks_count' => fn($q) => $q->where('status', 'completed')])
            ->withCount('tasks')
            ->orderByDesc('id')
            ->get();

        return response()->json(['success' => true, 'data' => $instances]);
    }

    /**
     * Show lifecycle instance with full DAG state & dependencies
     */
    public function showInstance(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $instance = LifecycleInstance::where('company_id', $company->id)
            ->where('id', $id)
            ->with(['employmentRecord.membership.user', 'employmentRecord.department', 'tasks.completedBy', 'revocationRequests'])
            ->firstOrFail();

        return response()->json(['success' => true, 'data' => $instance]);
    }

    /**
     * Complete a DAG task with strict prerequisite dependency checking
     */
    public function completeTask(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $task = LifecycleTask::where('company_id', $company->id)->where('id', $id)->firstOrFail();

        try {
            $updated = $this->dagEngine->completeTask(
                $task,
                $request->user()->id,
                $request->input('notes')
            );

            return response()->json([
                'success' => true,
                'message' => "Task '{$task->title}' completed. Successor tasks evaluated.",
                'data' => $updated,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Allocate hardware / asset to an employee
     */
    public function allocateAsset(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $validated = $request->validate([
            'employment_record_id' => 'required|integer|exists:employment_records,id',
            'asset_name' => 'required|string|max:150',
            'asset_tag' => 'nullable|string|max:60',
            'serial_number' => 'nullable|string|max:100',
            'category' => 'nullable|string|in:hardware,peripheral,security_key,mobile,badge',
            'notes' => 'nullable|string',
        ]);

        $asset = EmployeeAssetAllocation::create([
            'company_id' => $company->id,
            'employment_record_id' => $validated['employment_record_id'],
            'asset_name' => $validated['asset_name'],
            'asset_tag' => $validated['asset_tag'] ?? null,
            'serial_number' => $validated['serial_number'] ?? null,
            'category' => $validated['category'] ?? 'hardware',
            'allocated_at' => now(),
            'status' => 'allocated',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $asset], 201);
    }

    /**
     * Trigger IT Access Revocation (Immediate Kill Switch / Scheduled)
     */
    public function revokeAccess(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'lifecycle.revocation.execute');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $validated = $request->validate([
            'employment_record_id' => 'required|integer|exists:employment_records,id',
            'system_identifier' => 'required|string|max:100',
            'revocation_type' => 'nullable|string|in:immediate_kill_switch,scheduled_at_exit,soft_deprovision',
            'lifecycle_instance_id' => 'nullable|integer|exists:lifecycle_instances,id',
        ]);

        $revocation = DB::transaction(function () use ($company, $validated, $request) {
            $req = AccessRevocationRequest::create([
                'company_id' => $company->id,
                'lifecycle_instance_id' => $validated['lifecycle_instance_id'] ?? null,
                'employment_record_id' => $validated['employment_record_id'],
                'system_identifier' => $validated['system_identifier'],
                'revocation_type' => $validated['revocation_type'] ?? 'immediate_kill_switch',
                'status' => 'completed',
                'requested_by_user_id' => $request->user()->id,
                'executed_by_user_id' => $request->user()->id,
                'executed_at' => now(),
                'audit_log' => [
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'action' => 'CREDENTIALS_INVALIDATED',
                    'timestamp' => now()->toIso8601String(),
                ],
            ]);

            // Emit Outbox event
            DB::table('domain_event_outbox')->insert([
                'event_id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'event_type' => 'lifecycle.access_revoked',
                'schema_version' => 1,
                'producer' => 'finovo_m06_lifecycle',
                'payload' => json_encode([
                    'revocation_id' => $req->id,
                    'employment_record_id' => $req->employment_record_id,
                    'system_identifier' => $req->system_identifier,
                    'executed_by_user_id' => $request->user()->id,
                ]),
                'status' => 'pending',
                'occurred_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $req;
        });

        return response()->json([
            'success' => true,
            'message' => "Access to '{$revocation->system_identifier}' successfully revoked.",
            'data' => $revocation,
        ]);
    }
}

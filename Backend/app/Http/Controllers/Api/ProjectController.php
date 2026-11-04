<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\ProjectChangeRequest;
use App\Models\ProjectDecision;
use App\Models\ProjectDeliverable;
use App\Models\ProjectDocument;
use App\Models\ProjectMember;
use App\Models\ProjectMilestone;
use App\Models\ProjectMilestoneDependency;
use App\Models\ProjectRisk;
use App\Models\ProjectScopeRevision;
use App\Models\SecurityAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    /**
     * FR-01: Project Directory and Discovery
     */
    public function index(Request $request, Company $company): JsonResponse
    {
        $query = Project::where('company_id', $company->id)
            ->with([
                'manager.user:id,name,email,profile_photo_path',
                'members.membership.user:id,name,email',
            ])
            ->withCount(['milestones', 'members', 'risks']);

        // Search by name, project code, or client
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('project_code', 'like', "%{$search}%")
                    ->orWhere('client_name', 'like', "%{$search}%");
            });
        }

        // Filters
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($health = $request->query('health_status')) {
            $query->where('health_status', $health);
        }

        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }

        if ($type = $request->query('project_type')) {
            $query->where('project_type', $type);
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortDirection = $request->query('sort_direction', 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sortBy, ['name', 'project_code', 'start_date', 'target_end_date', 'progress_percent', 'budget_amount', 'created_at'])) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->latest();
        }

        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $projects = $query->paginate($perPage);

        // Fast company-wide portfolio stats
        $stats = Project::where('company_id', $company->id)
            ->selectRaw("
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning,
                COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status IN ('closed', 'archived') THEN 1 END) as archived,
                COUNT(CASE WHEN health_status IN ('at_risk', 'critical') THEN 1 END) as at_risk,
                COUNT(CASE WHEN priority IN ('high', 'critical') THEN 1 END) as priority_high,
                COUNT(CASE WHEN priority = 'medium' THEN 1 END) as priority_medium,
                COUNT(CASE WHEN priority = 'low' THEN 1 END) as priority_low
            ")
            ->first();

        return response()->json([
            'projects' => $projects,
            'data' => $projects->items(),
            'total' => $projects->total(),
            'stats' => [
                'total' => (int) ($stats->total ?? 0),
                'active' => (int) ($stats->active ?? 0),
                'planning' => (int) ($stats->planning ?? 0),
                'on_hold' => (int) ($stats->on_hold ?? 0),
                'completed' => (int) ($stats->completed ?? 0),
                'archived' => (int) ($stats->archived ?? 0),
                'at_risk' => (int) ($stats->at_risk ?? 0),
                'priority_high' => (int) ($stats->priority_high ?? 0),
                'priority_medium' => (int) ($stats->priority_medium ?? 0),
                'priority_low' => (int) ($stats->priority_low ?? 0),
            ],
            'current_page' => $projects->currentPage(),
            'last_page' => $projects->lastPage(),
        ]);
    }

    /**
     * FR-02: Safe Project Creation with unique project code and baseline
     */
    public function store(Request $request, Company $company): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'project_code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('projects', 'project_code')->where('company_id', $company->id),
            ],
            'client_name' => ['nullable', 'string', 'max:255'],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'project_type' => ['nullable', 'string', Rule::in(['web_application', 'mobile_app', 'saas', 'maintenance', 'internal'])],
            'priority' => ['nullable', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['nullable', 'string', Rule::in(['draft', 'planning', 'active'])],
            'billing_model' => ['nullable', 'string', Rule::in(['fixed_price', 'time_and_materials', 'internal'])],
            'budget_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'description' => ['nullable', 'string'],
            'scope_overview' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'target_end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $project = DB::transaction(function () use ($validated, $company, $request) {
            // Concurrency-safe project code generation
            $code = $validated['project_code'] ?? null;
            if (!$code) {
                $count = Project::where('company_id', $company->id)->lockForUpdate()->count() + 1;
                $prefix = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $validated['name']), 0, 3));
                if (strlen($prefix) < 2) {
                    $prefix = 'PRJ';
                }
                $code = $prefix . '-' . str_pad((string) $count, 3, '0', STR_PAD_LEFT);
            }

            $record = Project::create([
                'company_id' => $company->id,
                'project_code' => $code,
                'name' => $validated['name'],
                'client_name' => $validated['client_name'] ?? null,
                'manager_membership_id' => $validated['manager_membership_id'] ?? null,
                'project_type' => $validated['project_type'] ?? 'web_application',
                'priority' => $validated['priority'] ?? 'medium',
                'status' => $validated['status'] ?? 'planning',
                'health_status' => 'healthy',
                'billing_model' => $validated['billing_model'] ?? 'fixed_price',
                'budget_amount' => $validated['budget_amount'] ?? null,
                'currency' => $validated['currency'] ?? 'USD',
                'description' => $validated['description'] ?? null,
                'scope_overview' => $validated['scope_overview'] ?? null,
                'start_date' => $validated['start_date'] ?? now()->toDateString(),
                'target_end_date' => $validated['target_end_date'] ?? now()->addMonths(3)->toDateString(),
            ]);

            // Assign project manager to project_members if selected
            if (!empty($validated['manager_membership_id'])) {
                ProjectMember::create([
                    'company_id' => $company->id,
                    'project_id' => $record->id,
                    'membership_id' => $validated['manager_membership_id'],
                    'project_role' => 'project_manager',
                    'allocation_percent' => 100,
                    'joined_at' => now(),
                ]);
            }

            // Create Initial Scope Revision Baseline
            ProjectScopeRevision::create([
                'company_id' => $company->id,
                'project_id' => $record->id,
                'revision_number' => 1,
                'business_objective' => $validated['description'] ?? 'Initial project scope baseline',
                'in_scope' => $validated['scope_overview'] ?? 'Agreed project objectives and deliverables',
                'out_of_scope' => 'Items not explicitly documented in agreed specification',
                'status' => 'approved',
                'approved_at' => now(),
                'change_summary' => 'Initial scope baseline approved at project inception',
            ]);

            // Initial Milestones (Standard Delivery Gates)
            $defaultMilestones = [
                ['name' => 'Kickoff & Requirements Discovery', 'weight' => 1.0, 'days' => 14],
                ['name' => 'Architecture & Core Development', 'weight' => 3.0, 'days' => 45],
                ['name' => 'QA Testing & Client Review', 'weight' => 2.0, 'days' => 75],
                ['name' => 'Final Deployment & Handover', 'weight' => 1.0, 'days' => 90],
            ];

            foreach ($defaultMilestones as $idx => $mDef) {
                ProjectMilestone::create([
                    'company_id' => $company->id,
                    'project_id' => $record->id,
                    'name' => $mDef['name'],
                    'status' => $idx === 0 ? 'in_progress' : 'planned',
                    'weight' => $mDef['weight'],
                    'baseline_due_date' => now()->addDays($mDef['days'])->toDateString(),
                    'forecast_due_date' => now()->addDays($mDef['days'])->toDateString(),
                    'order' => $idx,
                ]);
            }

            $record->calculateProgress();

            SecurityAuditEvent::log(
                companyId: $company->id,
                userId: $request->user()->id,
                eventType: 'project.created',
                status: 'success',
                ipAddress: $request->ip(),
                userAgent: $request->userAgent(),
                metadata: [
                    'project_id' => $record->id,
                    'project_code' => $record->project_code,
                    'name' => $record->name,
                ]
            );

            return $record;
        });

        return response()->json([
            'message' => 'Project created successfully with initial baseline and milestones',
            'project' => $project->load([
                'manager.user:id,name,email',
                'members.membership.user:id,name,email',
                'milestones',
                'scopeRevisions',
            ]),
        ], 201);
    }

    /**
     * Show full project details
     */
    public function show(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $project->load([
            'manager.user:id,name,email,profile_photo_path',
            'members.membership.user:id,name,email',
            'milestones.deliverables',
            'milestones.predecessors',
            'deliverables',
            'scopeRevisions.approvedBy.user:id,name',
            'changeRequests.requester:id,name',
            'changeRequests.reviewer:id,name',
            'risks.owner.user:id,name',
            'decisions.decidedBy.user:id,name',
            'documents.uploader:id,name',
        ]);

        $healthData = $project->evaluateHealth();

        return response()->json([
            'project' => $project,
            'health_details' => $healthData,
        ]);
    }

    /**
     * Update project metadata
     */
    public function update(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'manager_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'priority' => ['nullable', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'billing_model' => ['nullable', 'string', Rule::in(['fixed_price', 'time_and_materials', 'internal'])],
            'budget_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'description' => ['nullable', 'string'],
            'scope_overview' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'target_end_date' => ['nullable', 'date'],
        ]);

        $project->update($validated);

        return response()->json([
            'message' => 'Project updated successfully',
            'project' => $project->fresh(['manager.user:id,name,email']),
        ]);
    }

    /**
     * FR-03: Project Lifecycle State Machine
     */
    public function transitionStatus(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $targetStatus = $request->input('target_status', $request->input('status'));
        $reason = $request->input('reason') ?: 'Status transition executed by project manager';

        $v = \Illuminate\Support\Facades\Validator::make([
            'target_status' => $targetStatus,
            'reason' => $reason,
        ], [
            'target_status' => [
                'required',
                'string',
                Rule::in(['draft', 'planning', 'active', 'on_hold', 'completed', 'closed', 'archived', 'cancelled']),
            ],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($v->fails()) {
            return response()->json(['message' => $v->errors()->first()], 422);
        }

        $validated = ['target_status' => $targetStatus, 'reason' => $reason];

        $currentStatus = $project->status;

        if ($currentStatus === $targetStatus) {
            return response()->json(['message' => 'Project is already in this status'], 422);
        }

        // Permitted transitions
        $allowed = [
            'draft' => ['planning', 'active', 'cancelled'],
            'planning' => ['active', 'on_hold', 'cancelled'],
            'active' => ['on_hold', 'completed', 'cancelled'],
            'on_hold' => ['active', 'cancelled'],
            'completed' => ['closed', 'active'], // Reopening supported
            'closed' => ['archived', 'completed'],
            'cancelled' => ['draft', 'planning'],
            'archived' => [],
        ];

        if (!in_array($targetStatus, $allowed[$currentStatus] ?? [])) {
            return response()->json([
                'message' => "Transition from {$currentStatus} to {$targetStatus} is prohibited by project lifecycle policy.",
            ], 422);
        }

        // Closure gates: require no unresolved blockers
        if ($targetStatus === 'closed' || $targetStatus === 'completed') {
            $openBlockers = $project->risks()->where('type', 'blocker')->whereIn('status', ['open', 'in_progress'])->count();
            if ($openBlockers > 0) {
                return response()->json([
                    'message' => "Cannot complete or close project: {$openBlockers} critical blocker(s) remain unresolved.",
                ], 422);
            }
        }

        $project->update([
            'status' => $targetStatus,
            'closure_notes' => in_array($targetStatus, ['completed', 'closed', 'cancelled']) ? $validated['reason'] : $project->closure_notes,
            'actual_completion_date' => $targetStatus === 'completed' ? now()->toDateString() : $project->actual_completion_date,
        ]);

        SecurityAuditEvent::log(
            companyId: $company->id,
            userId: $request->user()->id,
            eventType: 'project.status_transition',
            status: 'success',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            metadata: [
                'project_id' => $project->id,
                'from' => $currentStatus,
                'to' => $targetStatus,
                'reason' => $validated['reason'],
            ]
        );

        return response()->json([
            'message' => "Project status transitioned to {$targetStatus}",
            'project' => $project->fresh(),
        ]);
    }

    /**
     * FR-05: Project Team Management
     */
    public function addMember(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'membership_id' => [
                'required',
                'integer',
                Rule::exists('company_memberships', 'id')
                    ->where('company_id', $company->id)
                    ->where('status', 'active'),
            ],
            'project_role' => ['nullable', 'string', Rule::in(['project_manager', 'tech_lead', 'qa_lead', 'designer', 'developer', 'client_guest'])],
            'allocation_percent' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $existing = ProjectMember::where('project_id', $project->id)
            ->where('membership_id', $validated['membership_id'])
            ->first();

        if ($existing) {
            $existing->update([
                'project_role' => $validated['project_role'] ?? $existing->project_role,
                'allocation_percent' => $validated['allocation_percent'] ?? $existing->allocation_percent,
                'left_at' => null,
            ]);

            return response()->json([
                'message' => 'Member allocation updated',
                'member' => $existing->load('membership.user:id,name,email'),
            ]);
        }

        $member = ProjectMember::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'membership_id' => $validated['membership_id'],
            'project_role' => $validated['project_role'] ?? 'developer',
            'allocation_percent' => $validated['allocation_percent'] ?? 100,
            'joined_at' => now(),
        ]);

        return response()->json([
            'message' => 'Member assigned to project successfully',
            'member' => $member->load('membership.user:id,name,email'),
        ], 201);
    }

    public function removeMember(Request $request, Company $company, Project $project, ProjectMember $member): JsonResponse
    {
        if ($project->company_id !== $company->id || $member->project_id !== $project->id) {
            return response()->json(['message' => 'Project member not found in this project'], 404);
        }

        // Close participation rather than destructive deletion
        $member->update(['left_at' => now()]);

        return response()->json(['message' => 'Member removed from project']);
    }

    /**
     * FR-06 & Algorithm D: Milestones with DAG Cycle Prevention
     */
    public function storeMilestone(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'owner_membership_id' => [
                'nullable',
                'integer',
                Rule::exists('company_memberships', 'id')->where('company_id', $company->id),
            ],
            'weight' => ['nullable', 'numeric', 'min:0.1', 'max:100.0'],
            'baseline_due_date' => ['nullable', 'date'],
            'forecast_due_date' => ['nullable', 'date'],
            'acceptance_criteria' => ['nullable', 'string'],
        ]);

        $milestone = ProjectMilestone::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'owner_membership_id' => $validated['owner_membership_id'] ?? null,
            'status' => 'planned',
            'weight' => $validated['weight'] ?? 1.0,
            'baseline_due_date' => $validated['baseline_due_date'] ?? now()->addDays(30)->toDateString(),
            'forecast_due_date' => $validated['forecast_due_date'] ?? $validated['baseline_due_date'] ?? now()->addDays(30)->toDateString(),
            'acceptance_criteria' => $validated['acceptance_criteria'] ?? null,
            'order' => $project->milestones()->count(),
        ]);

        $project->calculateProgress();

        return response()->json([
            'message' => 'Milestone created successfully',
            'milestone' => $milestone,
        ], 201);
    }

    public function completeMilestone(Request $request, Company $company, Project $project, ProjectMilestone $milestone): JsonResponse
    {
        if ($project->company_id !== $company->id || $milestone->project_id !== $project->id) {
            return response()->json(['message' => 'Milestone not found in this project'], 404);
        }

        $milestone->update([
            'status' => 'completed',
            'actual_completed_at' => now(),
        ]);

        $progress = $project->calculateProgress();

        return response()->json([
            'message' => 'Milestone marked as completed',
            'milestone' => $milestone,
            'project_progress' => $progress,
        ]);
    }

    public function addMilestoneDependency(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'predecessor_milestone_id' => [
                'required',
                'integer',
                Rule::exists('project_milestones', 'id')->where('project_id', $project->id),
            ],
            'successor_milestone_id' => [
                'required',
                'integer',
                Rule::exists('project_milestones', 'id')->where('project_id', $project->id),
            ],
        ]);

        $predecessor = ProjectMilestone::findOrFail($validated['predecessor_milestone_id']);
        $successorId = (int) $validated['successor_milestone_id'];

        // DAG circular dependency prevention
        if ($predecessor->createsCircularDependency($successorId)) {
            return response()->json([
                'message' => 'Cannot add dependency: circular milestone dependency detected.',
            ], 422);
        }

        ProjectMilestoneDependency::firstOrCreate([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'predecessor_milestone_id' => $predecessor->id,
            'successor_milestone_id' => $successorId,
        ]);

        return response()->json(['message' => 'Milestone dependency linked successfully']);
    }

    /**
     * FR-09: Risks, Issues & Blockers
     */
    public function storeRisk(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(['risk', 'issue', 'blocker', 'dependency'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'severity' => ['nullable', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'probability' => ['nullable', 'string', Rule::in(['low', 'medium', 'high'])],
            'mitigation_plan' => ['nullable', 'string'],
            'target_resolution_date' => ['nullable', 'date'],
        ]);

        $risk = ProjectRisk::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'type' => $validated['type'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'severity' => $validated['severity'] ?? 'medium',
            'probability' => $validated['probability'] ?? 'medium',
            'status' => 'open',
            'mitigation_plan' => $validated['mitigation_plan'] ?? null,
            'target_resolution_date' => $validated['target_resolution_date'] ?? null,
        ]);

        $project->evaluateHealth();

        return response()->json([
            'message' => 'Risk/Blocker recorded successfully',
            'risk' => $risk,
        ], 201);
    }

    public function resolveRisk(Request $request, Company $company, Project $project, ProjectRisk $risk): JsonResponse
    {
        if ($project->company_id !== $company->id || $risk->project_id !== $project->id) {
            return response()->json(['message' => 'Risk not found in this project'], 404);
        }

        $risk->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        $project->evaluateHealth();

        return response()->json([
            'message' => 'Risk/Blocker resolved successfully',
            'risk' => $risk,
        ]);
    }

    /**
     * FR-07: Change Requests (Scope, Schedule, Budget)
     */
    public function storeChangeRequest(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'request_type' => ['required', 'string', Rule::in(['scope', 'schedule', 'budget', 'scope_change', 'schedule_change', 'budget_change'])],
            'title' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
            'impact_summary' => ['nullable', 'string'],
            'proposed_payload' => ['nullable', 'array'],
        ]);

        $normalizedType = str_contains($validated['request_type'], '_') 
            ? $validated['request_type'] 
            : $validated['request_type'] . '_change';

        $cr = ProjectChangeRequest::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'request_type' => $normalizedType,
            'title' => $validated['title'],
            'reason' => $validated['reason'],
            'impact_summary' => $validated['impact_summary'] ?? null,
            'proposed_payload' => $validated['proposed_payload'] ?? [],
            'status' => 'submitted',
            'requested_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Change request submitted successfully',
            'change_request' => $cr->load('requester:id,name'),
        ], 201);
    }

    public function reviewChangeRequest(Request $request, Company $company, Project $project, ProjectChangeRequest $changeRequest): JsonResponse
    {
        if ($project->company_id !== $company->id || $changeRequest->project_id !== $project->id) {
            return response()->json(['message' => 'Change request not found in this project'], 404);
        }

        $action = $request->input('action');
        if (!$action && $request->has('status')) {
            $action = $request->input('status') === 'approved' ? 'approve' : 'reject';
        }

        $v = \Illuminate\Support\Facades\Validator::make([
            'action' => $action,
            'review_notes' => $request->input('review_notes'),
        ], [
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'review_notes' => ['nullable', 'string'],
        ]);

        if ($v->fails()) {
            return response()->json(['message' => $v->errors()->first()], 422);
        }

        $validated = ['action' => $action, 'review_notes' => $request->input('review_notes')];

        $isApproved = $validated['action'] === 'approve';

        DB::transaction(function () use ($changeRequest, $project, $isApproved, $validated, $request) {
            $changeRequest->update([
                'status' => $isApproved ? 'approved' : 'rejected',
                'reviewed_by_user_id' => $request->user()->id,
                'reviewed_at' => now(),
                'review_notes' => $validated['review_notes'] ?? null,
            ]);

            if ($isApproved) {
                $payload = $changeRequest->proposed_payload;
                if ($changeRequest->request_type === 'scope_change') {
                    $nextRev = $project->scopeRevisions()->count() + 1;
                    ProjectScopeRevision::create([
                        'company_id' => $project->company_id,
                        'project_id' => $project->id,
                        'revision_number' => $nextRev,
                        'business_objective' => $payload['business_objective'] ?? $project->description,
                        'in_scope' => $payload['in_scope'] ?? null,
                        'out_of_scope' => $payload['out_of_scope'] ?? null,
                        'status' => 'approved',
                        'approved_at' => now(),
                        'change_summary' => 'Approved change request #' . $changeRequest->id . ': ' . $changeRequest->title,
                    ]);
                } elseif ($changeRequest->request_type === 'budget_change' && isset($payload['budget_amount'])) {
                    $project->update(['budget_amount' => $payload['budget_amount']]);
                } elseif ($changeRequest->request_type === 'schedule_change' && isset($payload['target_end_date'])) {
                    $project->update(['target_end_date' => $payload['target_end_date']]);
                }
            }
        });

        return response()->json([
            'message' => 'Change request ' . ($isApproved ? 'approved and applied' : 'rejected'),
            'change_request' => $changeRequest->fresh(['requester:id,name', 'reviewer:id,name']),
        ]);
    }

    /**
     * FR-08: Decision Register
     */
    public function storeDecision(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'decision' => ['required', 'string'],
            'rationale' => ['nullable', 'string'],
            'decided_at' => ['nullable', 'date'],
        ]);

        $decision = ProjectDecision::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'title' => $validated['title'],
            'decision' => $validated['decision'],
            'rationale' => $validated['rationale'] ?? null,
            'decided_at' => $validated['decided_at'] ?? now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Decision logged successfully',
            'decision' => $decision,
        ], 201);
    }

    /**
     * FR-10: Documents Metadata
     */
    public function storeDocument(Request $request, Company $company, Project $project): JsonResponse
    {
        if ($project->company_id !== $company->id) {
            return response()->json(['message' => 'Project not found in this company'], 404);
        }

        $validated = $request->validate([
            'document_name' => ['required', 'string', 'max:255'],
            'document_type' => ['nullable', 'string', Rule::in(['specification', 'architecture', 'contract', 'meeting_notes', 'deliverable_evidence'])],
            'file_path' => ['required', 'string'],
            'visibility' => ['nullable', 'string', Rule::in(['internal', 'team_only', 'client_visible'])],
        ]);

        $doc = ProjectDocument::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'document_name' => $validated['document_name'],
            'document_type' => $validated['document_type'] ?? 'specification',
            'file_path' => $validated['file_path'],
            'visibility' => $validated['visibility'] ?? 'internal',
            'uploaded_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Document saved successfully',
            'document' => $doc->load('uploader:id,name'),
        ], 201);
    }

    /**
     * CSV Export of Company Projects
     */
    public function export(Request $request, Company $company)
    {
        $projects = Project::where('company_id', $company->id)
            ->with(['manager.user'])
            ->latest()
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="projects_' . now()->format('Y-m-d') . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($projects) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Project Code',
                'Name',
                'Client',
                'Status',
                'Health',
                'Priority',
                'Progress %',
                'Manager',
                'Start Date',
                'Target End Date',
                'Budget',
            ]);

            foreach ($projects as $p) {
                fputcsv($handle, [
                    $p->project_code,
                    $p->name,
                    $p->client_name ?? 'Internal',
                    $p->status,
                    $p->health_status,
                    $p->priority,
                    $p->progress_percent,
                    $p->manager?->user?->name ?? 'None',
                    $p->start_date?->format('Y-m-d') ?? '',
                    $p->target_end_date?->format('Y-m-d') ?? '',
                    $p->budget_amount ? ($p->currency . ' ' . $p->budget_amount) : 'N/A',
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }
}

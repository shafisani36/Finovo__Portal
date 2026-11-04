<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientContact;
use App\Models\ClientContract;
use App\Models\ClientDecision;
use App\Models\ClientDeliverableReview;
use App\Models\ClientFile;
use App\Models\ClientInvitation;
use App\Models\ClientMembership;
use App\Models\ClientOnboardingRun;
use App\Models\ClientOrganization;
use App\Models\ClientProjectEngagement;
use App\Models\ClientRequest;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\ProjectDeliverable;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    // =========================================================================
    // 1. CLIENT ORGANIZATIONS & DUPLICATE DETECTION (FR-01, Alg 7.1)
    // =========================================================================

    public function index(Request $request, Company $company): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = ClientOrganization::where('company_id', $company->id)
            ->with(['accountManager.user:id,name,email', 'contacts'])
            ->withCount(['engagements', 'memberships', 'decisions']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('reference_code', 'like', "%{$s}%")
                  ->orWhere('industry', 'like', "%{$s}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', '!=', 'archived');
        }

        $clients = $query->latest()->paginate($request->input('per_page', 20));

        return response()->json($clients);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'industry' => 'nullable|string|max:100',
            'business_description' => 'nullable|string',
            'billing_address' => 'nullable|string',
            'country' => 'nullable|string|max:100',
            'timezone' => 'nullable|string|max:50',
            'account_manager_membership_id' => 'nullable|exists:company_memberships,id',
            'custom_fields' => 'nullable|array',
        ]);

        // Duplicate client detection algorithm (Alg 7.1)
        $normalizedName = strtolower(trim($validated['name']));
        $existing = ClientOrganization::where('company_id', $company->id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])
            ->first();

        if ($existing && !$request->boolean('confirm_duplicate')) {
            return response()->json([
                'message' => 'Potential duplicate organization detected with the same name.',
                'duplicate_found' => true,
                'existing_client' => [
                    'id' => $existing->id,
                    'reference_code' => $existing->reference_code,
                    'name' => $existing->name,
                    'status' => $existing->status,
                ],
            ], 409);
        }

        // Generate tenant-scoped reference code CLT-001, CLT-002...
        $count = ClientOrganization::where('company_id', $company->id)->count() + 1;
        $referenceCode = 'CLT-' . str_pad((string)$count, 3, '0', STR_PAD_LEFT);

        $client = DB::transaction(function () use ($company, $membership, $validated, $referenceCode) {
            $org = ClientOrganization::create([
                'company_id' => $company->id,
                'reference_code' => $referenceCode,
                'name' => $validated['name'],
                'status' => 'active',
                'industry' => $validated['industry'] ?? null,
                'business_description' => $validated['business_description'] ?? null,
                'billing_address' => $validated['billing_address'] ?? null,
                'country' => $validated['country'] ?? 'United States',
                'timezone' => $validated['timezone'] ?? 'UTC',
                'account_manager_membership_id' => $validated['account_manager_membership_id'] ?? $membership->id,
                'portal_enabled' => true,
                'custom_fields' => $validated['custom_fields'] ?? null,
                'health_status' => 'healthy',
            ]);

            // Provision standard onboarding blueprint run
            ClientOnboardingRun::create([
                'company_id' => $company->id,
                'client_organization_id' => $org->id,
                'template_name' => 'Standard Software House Client Onboarding',
                'status' => 'in_progress',
                'completed_items_count' => 1,
                'total_items_count' => 5,
                'checklist_items' => [
                    ['key' => 'org_created', 'label' => 'Create Client Workspace & Profile', 'done' => true],
                    ['key' => 'contacts_added', 'label' => 'Add Primary & Billing Contacts', 'done' => false],
                    ['key' => 'portal_invite', 'label' => 'Send Client Portal Invitation', 'done' => false],
                    ['key' => 'project_linked', 'label' => 'Link Initial Project & Scope', 'done' => false],
                    ['key' => 'kickoff_decision', 'label' => 'Issue Kickoff Approval Decision', 'done' => false],
                ],
            ]);

            return $org;
        });

        return response()->json([
            'message' => 'Client organization created successfully.',
            'client' => $client->load(['accountManager.user:id,name,email']),
        ], 201);
    }

    public function show(Request $request, Company $company, $id): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $id)
            ->with([
                'accountManager.user:id,name,email',
                'contacts',
                'memberships.user:id,name,email',
                'engagements.project:id,project_code,name,status,health_status',
                'contracts',
                'decisions' => fn ($q) => $q->latest()->limit(5),
                'requests' => fn ($q) => $q->latest()->limit(5),
                'onboardingRuns',
            ])
            ->firstOrFail();

        return response()->json(['client' => $client]);
    }

    public function update(Request $request, Company $company, $id): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'industry' => 'nullable|string|max:100',
            'business_description' => 'nullable|string',
            'billing_address' => 'nullable|string',
            'country' => 'nullable|string|max:100',
            'timezone' => 'nullable|string|max:50',
            'status' => 'sometimes|in:active,prospect,onboarding,on_hold,archived',
            'account_manager_membership_id' => 'nullable|exists:company_memberships,id',
            'portal_enabled' => 'boolean',
            'custom_fields' => 'nullable|array',
        ]);

        $client->update($validated);

        return response()->json([
            'message' => 'Client organization updated successfully.',
            'client' => $client,
        ]);
    }

    public function archive(Request $request, Company $company, $id): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $id)
            ->firstOrFail();

        $client->update([
            'status' => 'archived',
            'archived_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => "Client organization '{$client->name}' has been archived safely without modifying historical contracts or projects.",
            'client' => $client,
        ]);
    }

    // =========================================================================
    // 2. CONTACTS & PEOPLE (FR-02)
    // =========================================================================

    public function storeContact(Request $request, Company $company, $clientId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:150',
            'phone' => 'nullable|string|max:50',
            'job_title' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
            'contact_role' => 'required|in:primary,billing,technical,decision_maker,reviewer,stakeholder',
            'is_primary' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        if (!empty($validated['is_primary'])) {
            ClientContact::where('client_organization_id', $client->id)->update(['is_primary' => false]);
        }

        $contact = ClientContact::create([
            'company_id' => $company->id,
            'client_organization_id' => $client->id,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'job_title' => $validated['job_title'] ?? null,
            'department' => $validated['department'] ?? null,
            'contact_role' => $validated['contact_role'],
            'is_primary' => $validated['is_primary'] ?? false,
            'status' => 'active',
            'notes' => $validated['notes'] ?? null,
        ]);

        // Update onboarding checklist item if applicable
        $this->markOnboardingItemDone($client, 'contacts_added');

        return response()->json([
            'message' => 'Client contact created successfully.',
            'contact' => $contact,
        ], 201);
    }

    public function updateContact(Request $request, Company $company, $clientId, $contactId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $contact = ClientContact::where('company_id', $company->id)
            ->where('client_organization_id', $clientId)
            ->where('id', $contactId)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'email' => 'sometimes|email|max:150',
            'phone' => 'nullable|string|max:50',
            'job_title' => 'nullable|string|max:100',
            'contact_role' => 'sometimes|in:primary,billing,technical,decision_maker,reviewer,stakeholder',
            'is_primary' => 'boolean',
            'status' => 'sometimes|in:active,inactive,invited',
            'notes' => 'nullable|string',
        ]);

        if (!empty($validated['is_primary'])) {
            ClientContact::where('client_organization_id', $clientId)->where('id', '!=', $contact->id)->update(['is_primary' => false]);
        }

        $contact->update($validated);

        return response()->json([
            'message' => 'Client contact updated successfully.',
            'contact' => $contact,
        ]);
    }

    // =========================================================================
    // 3. CLIENT PORTAL INVITATIONS & MEMBERSHIP (FR-03, FR-04, Alg 7.3)
    // =========================================================================

    public function inviteClientUser(Request $request, Company $company, $clientId): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'email' => 'required|email|max:150',
            'contact_id' => 'nullable|exists:client_contacts,id',
            'portal_role' => 'required|in:admin,reviewer,billing,viewer',
        ]);

        // Cryptographically secure token
        $rawToken = Str::random(40);
        $tokenHash = hash('sha256', $rawToken);

        $invitation = ClientInvitation::create([
            'company_id' => $company->id,
            'client_organization_id' => $client->id,
            'contact_id' => $validated['contact_id'] ?? null,
            'email' => strtolower(trim($validated['email'])),
            'token_hash' => $tokenHash,
            'portal_role' => $validated['portal_role'],
            'status' => 'pending',
            'expires_at' => Carbon::now('UTC')->addDays(7),
            'invited_by_membership_id' => $membership->id,
        ]);

        $this->markOnboardingItemDone($client, 'portal_invite');

        return response()->json([
            'message' => 'Client portal invitation generated successfully.',
            'invitation' => $invitation,
            'invitation_token' => $rawToken, // Sent to client user via email/M10
            'invitation_url' => url("/portal/accept-invite?token={$rawToken}"),
        ], 201);
    }

    public function acceptInvitation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $tokenHash = hash('sha256', $validated['token']);

        $invitation = ClientInvitation::where('token_hash', $tokenHash)
            ->where('status', 'pending')
            ->first();

        if (!$invitation) {
            return response()->json(['message' => 'Invalid or expired invitation token.'], 404);
        }

        if (Carbon::now('UTC')->gt($invitation->expires_at)) {
            $invitation->update(['status' => 'expired']);
            return response()->json(['message' => 'This client portal invitation has expired.'], 410);
        }

        $user = $request->user();

        // Transactional membership activation (Alg 7.3)
        $clientMembership = DB::transaction(function () use ($invitation, $user) {
            $membership = ClientMembership::updateOrCreate(
                [
                    'company_id' => $invitation->company_id,
                    'client_organization_id' => $invitation->client_organization_id,
                    'user_id' => $user->id,
                ],
                [
                    'portal_role' => $invitation->portal_role,
                    'status' => 'active',
                    'invited_by_membership_id' => $invitation->invited_by_membership_id,
                    'last_active_at' => Carbon::now('UTC'),
                ]
            );

            $invitation->update([
                'status' => 'accepted',
                'accepted_at' => Carbon::now('UTC'),
                'accepted_user_id' => $user->id,
            ]);

            return $membership;
        });

        return response()->json([
            'message' => 'Client portal invitation accepted. Workspace access granted.',
            'membership' => $clientMembership->load('clientOrganization'),
        ]);
    }

    public function revokeMembership(Request $request, Company $company, $clientId, $membershipId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $membership = ClientMembership::where('company_id', $company->id)
            ->where('client_organization_id', $clientId)
            ->where('id', $membershipId)
            ->firstOrFail();

        $membership->update(['status' => 'revoked']);

        return response()->json([
            'message' => 'Client portal membership revoked successfully.',
            'membership' => $membership,
        ]);
    }

    // =========================================================================
    // 4. PROJECT ENGAGEMENTS & VISIBILITY CONFIGURATION (FR-05)
    // =========================================================================

    public function associateProject(Request $request, Company $company, $clientId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'client_project_name' => 'nullable|string|max:150',
            'visibility_mode' => 'nullable|in:minimal,standard,full_transparency',
            'show_milestones' => 'boolean',
            'show_deliverables' => 'boolean',
            'show_financials' => 'boolean',
        ]);

        $project = Project::where('company_id', $company->id)
            ->where('id', $validated['project_id'])
            ->firstOrFail();

        $engagement = ClientProjectEngagement::updateOrCreate(
            [
                'client_organization_id' => $client->id,
                'project_id' => $project->id,
            ],
            [
                'company_id' => $company->id,
                'client_project_name' => $validated['client_project_name'] ?? $project->name,
                'visibility_mode' => $validated['visibility_mode'] ?? 'standard',
                'show_milestones' => $validated['show_milestones'] ?? true,
                'show_deliverables' => $validated['show_deliverables'] ?? true,
                'show_financials' => $validated['show_financials'] ?? false,
                'status' => 'active',
            ]
        );

        $this->markOnboardingItemDone($client, 'project_linked');

        return response()->json([
            'message' => 'Project associated with client organization successfully.',
            'engagement' => $engagement->load('project'),
        ], 201);
    }

    // =========================================================================
    // 5. VERSION-LOCKED DELIVERABLE SUBMISSION (FR-06, Feature 2)
    // =========================================================================

    public function submitDeliverableForReview(Request $request, Company $company, $clientId): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'project_deliverable_id' => 'required|exists:project_deliverables,id',
            'version_label' => 'required|string|max:50',
            'title' => 'required|string|max:150',
            'description' => 'nullable|string',
            'file_url' => 'nullable|string|max:255',
            'file_size_bytes' => 'nullable|integer',
            'due_date' => 'nullable|date',
        ]);

        // Generate immutable version hash
        $versionPayload = $validated['title'] . $validated['version_label'] . ($validated['file_url'] ?? '') . Carbon::now('UTC')->toIso8601String();
        $versionHash = hash('sha256', $versionPayload);

        $review = ClientDeliverableReview::create([
            'company_id' => $company->id,
            'client_organization_id' => $client->id,
            'project_id' => $validated['project_id'],
            'project_deliverable_id' => $validated['project_deliverable_id'],
            'version_label' => $validated['version_label'],
            'version_hash' => $versionHash,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'file_url' => $validated['file_url'] ?? null,
            'file_size_bytes' => $validated['file_size_bytes'] ?? null,
            'submitted_by_membership_id' => $membership->id,
            'submitted_at' => Carbon::now('UTC'),
            'due_date' => isset($validated['due_date']) ? Carbon::parse($validated['due_date']) : Carbon::now('UTC')->addDays(5),
            'review_status' => 'submitted',
        ]);

        return response()->json([
            'message' => 'Deliverable version published for client review.',
            'deliverable_review' => $review->load(['project:id,name', 'deliverable:id,name']),
        ], 201);
    }

    // =========================================================================
    // 6. CLIENT DECISION LEDGER (FR-08, Feature 1)
    // =========================================================================

    public function createDecisionRequest(Request $request, Company $company, $clientId): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'milestone_id' => 'nullable|exists:project_milestones,id',
            'title' => 'required|string|max:200',
            'context_description' => 'required|string',
            'assigned_contact_id' => 'nullable|exists:client_contacts,id',
            'due_date' => 'required|date',
            'impact_summary' => 'nullable|string',
        ]);

        $count = ClientDecision::where('company_id', $company->id)->count() + 1;
        $decisionCode = 'DEC-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);

        $decision = ClientDecision::create([
            'company_id' => $company->id,
            'client_organization_id' => $client->id,
            'project_id' => $validated['project_id'],
            'milestone_id' => $validated['milestone_id'] ?? null,
            'decision_code' => $decisionCode,
            'title' => $validated['title'],
            'context_description' => $validated['context_description'],
            'requested_by_membership_id' => $membership->id,
            'assigned_contact_id' => $validated['assigned_contact_id'] ?? null,
            'due_date' => Carbon::parse($validated['due_date']),
            'status' => 'requested',
            'impact_summary' => $validated['impact_summary'] ?? null,
        ]);

        $this->markOnboardingItemDone($client, 'kickoff_decision');

        return response()->json([
            'message' => 'Decision item created in Client Decision Ledger.',
            'decision' => $decision->load(['project:id,name', 'milestone:id,name', 'assignedContact']),
        ], 201);
    }

    // =========================================================================
    // 7. CLIENT REQUESTS & TASK CONVERSION (FR-10, Feature 6)
    // =========================================================================

    public function triageRequest(Request $request, Company $company, $clientId, $requestId): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);

        $clientRequest = ClientRequest::where('company_id', $company->id)
            ->where('client_organization_id', $clientId)
            ->where('id', $requestId)
            ->firstOrFail();

        $validated = $request->validate([
            'action' => 'required|in:accept,convert_to_task,decline',
            'estimated_cost_hours' => 'nullable|numeric',
            'estimated_budget_amount' => 'nullable|numeric',
            'convert_task_title' => 'nullable|string|max:150',
            'priority' => 'nullable|in:low,medium,high,urgent',
        ]);

        DB::transaction(function () use ($company, $membership, $clientRequest, $validated) {
            if ($validated['action'] === 'convert_to_task') {
                $taskCount = Task::where('company_id', $company->id)->count() + 1;
                $taskCode = 'TSK-' . str_pad((string)$taskCount, 4, '0', STR_PAD_LEFT);

                $task = Task::create([
                    'company_id' => $company->id,
                    'project_id' => $clientRequest->project_id,
                    'task_code' => $taskCode,
                    'title' => $validated['convert_task_title'] ?? $clientRequest->title,
                    'description' => $clientRequest->description,
                    'task_type' => $clientRequest->category === 'support_issue' ? 'bug' : 'feature',
                    'status' => 'open',
                    'priority' => $validated['priority'] ?? $clientRequest->priority,
                    'visibility' => 'client_visible',
                    'creator_membership_id' => $membership->id,
                    'estimated_minutes' => isset($validated['estimated_cost_hours']) ? (int)($validated['estimated_cost_hours'] * 60) : 0,
                ]);

                $clientRequest->update([
                    'task_id' => $task->id,
                    'client_status' => 'in_progress',
                    'internal_status' => 'converted_to_task',
                    'estimated_cost_hours' => $validated['estimated_cost_hours'] ?? null,
                    'estimated_budget_amount' => $validated['estimated_budget_amount'] ?? null,
                    'triaged_by_membership_id' => $membership->id,
                ]);
            } elseif ($validated['action'] === 'accept') {
                $clientRequest->update([
                    'client_status' => 'accepted',
                    'internal_status' => 'triaged',
                    'estimated_cost_hours' => $validated['estimated_cost_hours'] ?? null,
                    'estimated_budget_amount' => $validated['estimated_budget_amount'] ?? null,
                    'triaged_by_membership_id' => $membership->id,
                ]);
            } else {
                $clientRequest->update([
                    'client_status' => 'declined',
                    'internal_status' => 'rejected',
                    'triaged_by_membership_id' => $membership->id,
                ]);
            }
        });

        return response()->json([
            'message' => 'Client request triaged successfully.',
            'request' => $clientRequest->load(['task:id,task_code,title,status']),
        ]);
    }

    // =========================================================================
    // 8. CONTRACTS & ENGAGEMENT METADATA (FR-09)
    // =========================================================================

    public function storeContract(Request $request, Company $company, $clientId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'contract_type' => 'required|in:msa,sow,sla,nda,retainer',
            'status' => 'required|in:draft,pending_signature,active,expiring_soon,expired,terminated',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date',
            'contract_value' => 'nullable|numeric',
            'currency' => 'nullable|string|max:10',
            'document_url' => 'nullable|string|max:255',
            'client_visible' => 'boolean',
        ]);

        $count = ClientContract::where('company_id', $company->id)->count() + 1;
        $contractCode = 'CTR-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);

        $contract = ClientContract::create([
            'company_id' => $company->id,
            'client_organization_id' => $client->id,
            'contract_code' => $contractCode,
            'title' => $validated['title'],
            'contract_type' => $validated['contract_type'],
            'status' => $validated['status'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'] ?? null,
            'contract_value' => $validated['contract_value'] ?? null,
            'currency' => $validated['currency'] ?? 'USD',
            'document_url' => $validated['document_url'] ?? null,
            'client_visible' => $validated['client_visible'] ?? true,
        ]);

        return response()->json([
            'message' => 'Contract reference recorded successfully.',
            'contract' => $contract,
        ], 201);
    }

    // =========================================================================
    // 9. EXPLAINABLE CLIENT HEALTH ENGINE (Feature 3, Alg 7.6)
    // =========================================================================

    public function getHealthIndicators(Request $request, Company $company, $clientId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $now = Carbon::now('UTC');

        // 1. Overdue decisions
        $overdueDecisions = ClientDecision::where('client_organization_id', $client->id)
            ->where('status', 'requested')
            ->where('due_date', '<', $now)
            ->get();

        // 2. Pending deliverable reviews awaiting client
        $pendingDeliverables = ClientDeliverableReview::where('client_organization_id', $client->id)
            ->where('review_status', 'submitted')
            ->get();

        // 3. Stalled requests
        $stalledRequests = ClientRequest::where('client_organization_id', $client->id)
            ->where('client_status', 'submitted')
            ->where('created_at', '<', $now->copy()->subDays(3))
            ->get();

        // 4. Contracts expiring soon (within 30 days)
        $expiringContracts = ClientContract::where('client_organization_id', $client->id)
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->where('end_date', '<=', $now->copy()->addDays(30)->toDateString())
            ->get();

        $indicators = [];

        if ($overdueDecisions->isNotEmpty()) {
            $indicators[] = [
                'type' => 'overdue_decisions',
                'severity' => 'critical',
                'title' => "{$overdueDecisions->count()} Overdue Client Decision(s)",
                'explanation' => 'Unanswered decisions in the Decision Ledger may block upcoming milestone deadlines.',
                'action_recommendation' => 'Prompt the designated client reviewer to resolve pending decisions.',
                'records_count' => $overdueDecisions->count(),
            ];
        }

        if ($pendingDeliverables->isNotEmpty()) {
            $indicators[] = [
                'type' => 'pending_deliverables',
                'severity' => 'warning',
                'title' => "{$pendingDeliverables->count()} Deliverable(s) Awaiting Review",
                'explanation' => 'Version-locked deliverable submissions published but not yet approved or returned.',
                'action_recommendation' => 'Check in with the client review team to prevent delivery delays.',
                'records_count' => $pendingDeliverables->count(),
            ];
        }

        if ($expiringContracts->isNotEmpty()) {
            $indicators[] = [
                'type' => 'contract_expiring',
                'severity' => 'attention_required',
                'title' => "Contract Renewal Approaching",
                'explanation' => "Contract '{$expiringContracts->first()->title}' expires in less than 30 days.",
                'action_recommendation' => 'Schedule renewal consultation with client executive stakeholders.',
                'records_count' => $expiringContracts->count(),
            ];
        }

        $overallHealth = 'healthy';
        if ($overdueDecisions->isNotEmpty()) {
            $overallHealth = 'critical';
        } elseif ($pendingDeliverables->isNotEmpty() || $stalledRequests->isNotEmpty()) {
            $overallHealth = 'attention_required';
        }

        $client->update(['health_status' => $overallHealth]);

        return response()->json([
            'client_id' => $client->id,
            'client_name' => $client->name,
            'health_status' => $overallHealth,
            'indicators' => $indicators,
            'summary' => [
                'overdue_decisions_count' => $overdueDecisions->count(),
                'pending_deliverables_count' => $pendingDeliverables->count(),
                'stalled_requests_count' => $stalledRequests->count(),
                'expiring_contracts_count' => $expiringContracts->count(),
            ],
        ]);
    }

    // =========================================================================
    // 10. CLIENT ACCESS BOUNDARY SIMULATOR (Feature 4)
    // =========================================================================

    public function simulateAccessBoundary(Request $request, Company $company, $clientId): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $client = ClientOrganization::where('company_id', $company->id)
            ->where('id', $clientId)
            ->firstOrFail();

        $engagements = ClientProjectEngagement::where('client_organization_id', $client->id)
            ->with(['project.milestones', 'project.deliverables'])
            ->get();

        $simulation = [
            'client_organization' => $client->name,
            'portal_status' => $client->portal_enabled ? 'Enabled' : 'Disabled',
            'visible_projects' => $engagements->map(function ($e) {
                return [
                    'project_id' => $e->project_id,
                    'client_project_name' => $e->client_project_name,
                    'visibility_mode' => $e->visibility_mode,
                    'visible_milestones_count' => $e->show_milestones ? $e->project->milestones->count() : 0,
                    'visible_deliverables_count' => $e->show_deliverables ? $e->project->deliverables->count() : 0,
                    'financial_visibility' => $e->show_financials ? 'Visible' : 'Strictly Hidden',
                    'internal_safeguards' => [
                        'm06_timesheets_visible' => false,
                        'm08_desktop_monitoring_visible' => false,
                        'internal_comments_visible' => false,
                        'confidential_tasks_visible' => false,
                    ],
                ];
            }),
            'active_portal_users' => ClientMembership::where('client_organization_id', $client->id)->count(),
            'governance_compliance' => 'All internal employee operational data is isolated from client portal views.',
        ];

        return response()->json(['simulation' => $simulation]);
    }

    // =========================================================================
    // 11. EXPORT CLIENT DATA (FR-12)
    // =========================================================================

    public function exportClients(Request $request, Company $company): StreamedResponse
    {
        $this->resolveMembership($company, $request);

        $clients = ClientOrganization::where('company_id', $company->id)
            ->with(['accountManager.user:id,name', 'contacts'])
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="finovo-clients-' . date('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($clients) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID', 'Reference Code', 'Organization Name', 'Status', 'Industry', 'Country', 'Timezone',
                'Account Manager', 'Primary Contact', 'Health Status', 'Created At'
            ]);

            foreach ($clients as $c) {
                $primaryContact = $c->contacts->firstWhere('is_primary', true) ?: $c->contacts->first();
                fputcsv($handle, [
                    $c->id,
                    $c->reference_code,
                    $c->name,
                    $c->status,
                    $c->industry ?? 'N/A',
                    $c->country ?? 'N/A',
                    $c->timezone,
                    $c->accountManager->user->name ?? 'Unassigned',
                    $primaryContact ? "{$primaryContact->name} ({$primaryContact->email})" : 'None',
                    $c->health_status,
                    $c->created_at->toIso8601String(),
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    private function markOnboardingItemDone(ClientOrganization $client, string $itemKey): void
    {
        $run = ClientOnboardingRun::where('client_organization_id', $client->id)
            ->where('status', 'in_progress')
            ->first();

        if (!$run || empty($run->checklist_items)) return;

        $items = $run->checklist_items;
        $modified = false;
        $doneCount = 0;

        foreach ($items as &$it) {
            if ($it['key'] === $itemKey && !$it['done']) {
                $it['done'] = true;
                $modified = true;
            }
            if (!empty($it['done'])) {
                $doneCount++;
            }
        }

        if ($modified) {
            $isCompleted = ($doneCount >= count($items));
            $run->update([
                'checklist_items' => $items,
                'completed_items_count' => $doneCount,
                'status' => $isCompleted ? 'completed' : 'in_progress',
                'completed_at' => $isCompleted ? Carbon::now('UTC') : null,
            ]);
        }
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientContract;
use App\Models\ClientDecision;
use App\Models\ClientDeliverableReview;
use App\Models\ClientFile;
use App\Models\ClientMembership;
use App\Models\ClientOrganization;
use App\Models\ClientProjectEngagement;
use App\Models\ClientRequest;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ClientPortalController extends Controller
{
    private function resolveClientMembership(Request $request, $clientId): ClientMembership
    {
        return ClientMembership::where('client_organization_id', $clientId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    public function getMyWorkspaces(Request $request): JsonResponse
    {
        $memberships = ClientMembership::where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->with(['clientOrganization.company:id,name,slug'])
            ->get();

        return response()->json(['workspaces' => $memberships]);
    }

    public function getPortalOverview(Request $request, $clientId): JsonResponse
    {
        $membership = $this->resolveClientMembership($request, $clientId);
        $client = $membership->clientOrganization;

        // 1. Visible projects
        $engagements = ClientProjectEngagement::where('client_organization_id', $client->id)
            ->where('status', 'active')
            ->with(['project:id,project_code,name,status,health_status,start_date,target_end_date,progress_percent'])
            ->get();

        // 2. Pending deliverable reviews
        $pendingReviews = ClientDeliverableReview::where('client_organization_id', $client->id)
            ->where('review_status', 'submitted')
            ->with(['project:id,name,project_code', 'deliverable:id,name'])
            ->latest('submitted_at')
            ->get();

        // 3. Pending decisions
        $pendingDecisions = ClientDecision::where('client_organization_id', $client->id)
            ->where('status', 'requested')
            ->with(['project:id,name,project_code', 'milestone:id,name'])
            ->orderBy('due_date')
            ->get();

        // 4. Open requests
        $openRequests = ClientRequest::where('client_organization_id', $client->id)
            ->whereNotIn('client_status', ['completed', 'declined'])
            ->with(['project:id,name,project_code'])
            ->latest()
            ->get();

        // 5. Active contracts
        $contracts = ClientContract::where('client_organization_id', $client->id)
            ->where('client_visible', true)
            ->where('status', 'active')
            ->get();

        return response()->json([
            'client_organization' => [
                'id' => $client->id,
                'name' => $client->name,
                'reference_code' => $client->reference_code,
                'portal_role' => $membership->portal_role,
            ],
            'projects' => $engagements,
            'pending_deliverables' => $pendingReviews,
            'pending_decisions' => $pendingDecisions,
            'open_requests' => $openRequests,
            'contracts' => $contracts,
        ]);
    }

    public function getClientProjects(Request $request, $clientId): JsonResponse
    {
        $membership = $this->resolveClientMembership($request, $clientId);

        $engagements = ClientProjectEngagement::where('client_organization_id', $clientId)
            ->where('status', 'active')
            ->with([
                'project.milestones' => fn ($q) => $q->orderBy('order'),
                'project.deliverables',
            ])
            ->get();

        return response()->json(['projects' => $engagements]);
    }

    public function getClientDeliverables(Request $request, $clientId): JsonResponse
    {
        $this->resolveClientMembership($request, $clientId);

        $reviews = ClientDeliverableReview::where('client_organization_id', $clientId)
            ->with(['project:id,name,project_code', 'deliverable:id,name', 'submittedBy.user:id,name', 'decisionBy:id,name'])
            ->latest('submitted_at')
            ->get();

        return response()->json(['deliverable_reviews' => $reviews]);
    }

    public function submitDeliverableDecision(Request $request, $clientId, $reviewId): JsonResponse
    {
        $membership = $this->resolveClientMembership($request, $clientId);

        $review = ClientDeliverableReview::where('client_organization_id', $clientId)
            ->where('id', $reviewId)
            ->firstOrFail();

        if (in_array($review->review_status, ['approved', 'rejected', 'superseded'])) {
            return response()->json([
                'message' => 'This deliverable version review has already been concluded.',
                'current_status' => $review->review_status,
            ], 422);
        }

        $validated = $request->validate([
            'decision' => 'required|in:approved,changes_requested,rejected',
            'comment' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        $review->update([
            'review_status' => $validated['decision'],
            'decision_by_user_id' => $user->id,
            'decision_at' => Carbon::now('UTC'),
            'decision_comment' => $validated['comment'] ?? null,
        ]);

        return response()->json([
            'message' => "Deliverable version {$review->version_label} marked as {$validated['decision']}.",
            'deliverable_review' => $review->load(['decisionBy:id,name']),
        ]);
    }

    public function getClientDecisions(Request $request, $clientId): JsonResponse
    {
        $this->resolveClientMembership($request, $clientId);

        $decisions = ClientDecision::where('client_organization_id', $clientId)
            ->with(['project:id,name,project_code', 'milestone:id,name', 'requestedBy.user:id,name', 'respondedBy:id,name'])
            ->latest('due_date')
            ->get();

        return response()->json(['decisions' => $decisions]);
    }

    public function respondToDecision(Request $request, $clientId, $decisionId): JsonResponse
    {
        $membership = $this->resolveClientMembership($request, $clientId);

        $decision = ClientDecision::where('client_organization_id', $clientId)
            ->where('id', $decisionId)
            ->firstOrFail();

        if ($decision->status === 'closed') {
            return response()->json(['message' => 'This decision item is already closed.'], 422);
        }

        $validated = $request->validate([
            'outcome_decision' => 'required|in:approved,rejected,alternative_chosen',
            'outcome_rationale' => 'required|string|max:1000',
        ]);

        $user = $request->user();

        $decision->update([
            'status' => 'answered',
            'outcome_decision' => $validated['outcome_decision'],
            'outcome_rationale' => $validated['outcome_rationale'],
            'responded_by_user_id' => $user->id,
            'responded_at' => Carbon::now('UTC'),
        ]);

        return response()->json([
            'message' => 'Response recorded in Decision Ledger.',
            'decision' => $decision->load('respondedBy:id,name'),
        ]);
    }

    public function getClientRequests(Request $request, $clientId): JsonResponse
    {
        $this->resolveClientMembership($request, $clientId);

        $requests = ClientRequest::where('client_organization_id', $clientId)
            ->with(['project:id,name,project_code', 'submittedBy:id,name'])
            ->latest()
            ->get();

        return response()->json(['requests' => $requests]);
    }

    public function createClientRequest(Request $request, $clientId): JsonResponse
    {
        $membership = $this->resolveClientMembership($request, $clientId);
        $client = $membership->clientOrganization;

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'category' => 'required|in:change_request,support_issue,feature_request,clarification',
            'title' => 'required|string|max:200',
            'description' => 'required|string',
            'priority' => 'nullable|in:low,medium,high,urgent',
        ]);

        // Verify project belongs to client engagement
        ClientProjectEngagement::where('client_organization_id', $client->id)
            ->where('project_id', $validated['project_id'])
            ->firstOrFail();

        $count = ClientRequest::where('company_id', $client->company_id)->count() + 1;
        $requestCode = 'REQ-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);

        $clientRequest = ClientRequest::create([
            'company_id' => $client->company_id,
            'client_organization_id' => $client->id,
            'project_id' => $validated['project_id'],
            'request_code' => $requestCode,
            'category' => $validated['category'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'priority' => $validated['priority'] ?? 'medium',
            'client_status' => 'submitted',
            'internal_status' => 'new',
            'submitted_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Request submitted successfully. Internal team has been notified.',
            'request' => $clientRequest->load(['project:id,name']),
        ], 201);
    }

    public function getClientContracts(Request $request, $clientId): JsonResponse
    {
        $this->resolveClientMembership($request, $clientId);

        $contracts = ClientContract::where('client_organization_id', $clientId)
            ->where('client_visible', true)
            ->latest('start_date')
            ->get();

        return response()->json(['contracts' => $contracts]);
    }
}

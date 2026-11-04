<?php

namespace App\Domain\Recruitment\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Domain\Recruitment\Actions\ConvertCandidateToEmployeeAction;
use App\Domain\Recruitment\Services\CandidatePipelineService;
use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CandidateApplication;
use App\Models\JobRequisition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecruitmentController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected CandidatePipelineService $pipelineService,
        protected ConvertCandidateToEmployeeAction $convertAction
    ) {}

    /**
     * List job requisitions
     */
    public function indexRequisitions(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.requisitions.view');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $requisitions = $this->pipelineService->getRequisitions($company->id, $request->all());

        return response()->json(['success' => true, 'data' => $requisitions]);
    }

    /**
     * Create job requisition
     */
    public function storeRequisition(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.requisitions.manage');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $validated = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
            'job_position_id' => 'nullable|integer|exists:job_positions,id',
            'title' => 'required|string|max:150',
            'headcount' => 'nullable|integer|min:1',
            'employment_type' => 'nullable|string|in:full_time,part_time,contractor,intern',
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|gte:min_salary',
            'currency' => 'nullable|string|size:3',
            'job_description' => 'nullable|string',
            'requirements' => 'nullable|string',
        ]);

        $requisition = $this->pipelineService->createRequisition($company->id, $validated, $request->user()->id);

        return response()->json(['success' => true, 'data' => $requisition], 201);
    }

    /**
     * Approve job requisition
     */
    public function approveRequisition(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.requisitions.approve');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $requisition = JobRequisition::where('company_id', $company->id)->where('id', $id)->firstOrFail();
        $approved = $this->pipelineService->approveRequisition($requisition, $request->user()->id);

        return response()->json(['success' => true, 'data' => $approved]);
    }

    /**
     * List candidates & applications
     */
    public function indexApplications(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.candidates.view');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $applications = CandidateApplication::where('company_id', $company->id)
            ->with(['candidate', 'requisition.department', 'scorecards', 'latestOffer'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['success' => true, 'data' => $applications]);
    }

    /**
     * Move candidate pipeline stage
     */
    public function advanceStage(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.candidates.manage');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $application = CandidateApplication::where('company_id', $company->id)->where('id', $id)->firstOrFail();
        $validated = $request->validate([
            'current_stage' => 'required|string',
            'stage_notes' => 'nullable|string|max:500',
        ]);

        $updated = $this->pipelineService->advanceStage($application, $validated['current_stage'], $validated['stage_notes'] ?? null);

        return response()->json(['success' => true, 'data' => $updated]);
    }

    /**
     * Submit interview scorecard
     */
    public function submitScorecard(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.scorecards.submit');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $application = CandidateApplication::where('company_id', $company->id)->where('id', $id)->firstOrFail();
        $validated = $request->validate([
            'interview_stage' => 'required|string|max:60',
            'overall_recommendation' => 'required|string|in:strong_yes,yes,neutral,no,strong_no',
            'criteria_scores' => 'required|array',
            'summary_notes' => 'nullable|string',
        ]);

        $scorecard = $this->pipelineService->submitScorecard($application, $validated, $membership->id);

        return response()->json(['success' => true, 'data' => $scorecard], 201);
    }

    /**
     * Atomic Candidate to Employee Conversion
     */
    public function convertCandidate(Request $request, int $id): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);
        $membership = $request->user()->memberships()->where('company_id', $company->id)->firstOrFail();

        $authResult = $this->authEngine->evaluate($membership, 'recruitment.convert');
        if (!$authResult->isAllowed) {
            return response()->json(['success' => false, 'message' => $authResult->reason], 403);
        }

        $application = CandidateApplication::where('company_id', $company->id)
            ->where('id', $id)
            ->with(['candidate', 'requisition', 'latestOffer'])
            ->firstOrFail();

        try {
            $result = $this->convertAction->execute($application, $request->user()->id, $request->all());

            return response()->json([
                'success' => true,
                'message' => 'Candidate successfully converted into active employee record and onboarding DAG initiated.',
                'data' => $result,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }
}

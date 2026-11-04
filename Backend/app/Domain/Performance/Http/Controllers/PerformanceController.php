<?php

namespace App\Domain\Performance\Http\Controllers;

use App\Domain\Access\Services\AuthorizationEngine;
use App\Domain\Organization\Services\TenantContextResolver;
use App\Domain\Performance\Services\SkillsGapAnalysisService;
use App\Http\Controllers\Controller;
use App\Models\CompetencyFramework;
use App\Models\EmployeeCompetencyAssessment;
use App\Models\PerformanceReview;
use App\Models\PerformanceReviewCycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceController extends Controller
{
    public function __construct(
        protected TenantContextResolver $tenantResolver,
        protected AuthorizationEngine $authEngine,
        protected SkillsGapAnalysisService $skillsService
    ) {}

    /**
     * List review cycles
     */
    public function indexCycles(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $cycles = PerformanceReviewCycle::where('company_id', $company->id)
            ->withCount('reviews')
            ->orderByDesc('id')
            ->get();

        return response()->json(['success' => true, 'data' => $cycles]);
    }

    /**
     * Get organization-wide skills gap matrix
     */
    public function skillsGapMatrix(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $matrix = $this->skillsService->getOrganizationSkillsGapMatrix($company->id);

        return response()->json(['success' => true, 'data' => $matrix]);
    }

    /**
     * Record employee competency assessment
     */
    public function assessCompetency(Request $request): JsonResponse
    {
        $company = $this->tenantResolver->resolve($request);

        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employment_records,id',
            'competency_name' => 'required|string|max:150',
            'current_level' => 'required|integer|min:1|max:5',
            'target_level' => 'required|integer|min:1|max:5',
            'framework_id' => 'nullable|integer|exists:competency_frameworks,id',
            'evidence_notes' => 'nullable|string',
        ]);

        $assessment = $this->skillsService->assessEmployee(
            $company->id,
            $validated['employee_id'],
            $validated['competency_name'],
            $validated['current_level'],
            $validated['target_level'],
            $validated['framework_id'] ?? null,
            $validated['evidence_notes'] ?? null,
            $request->user()->id
        );

        return response()->json(['success' => true, 'data' => $assessment], 201);
    }
}

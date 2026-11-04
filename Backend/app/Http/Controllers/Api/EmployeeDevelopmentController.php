<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompetencyFramework;
use App\Models\EmployeeCompetencyAssessment;
use App\Models\EmployeeDevelopmentPlan;
use App\Models\EmployeeFeedback;
use App\Models\EmployeeGoal;
use App\Models\EmploymentRecord;
use App\Models\HrAuditEvent;
use App\Models\OnboardingChecklist;
use App\Models\PerformanceReview;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeDevelopmentController extends Controller
{
    private function resolveMembership(Company $company, Request $request): CompanyMembership
    {
        return CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function resolveEmploymentRecord(Company $company, User $user): ?EmploymentRecord
    {
        $membership = CompanyMembership::where('company_id', $company->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$membership) {
            return null;
        }

        return EmploymentRecord::where('company_id', $company->id)
            ->where('membership_id', $membership->id)
            ->first();
    }

    // =========================================================================
    // 1. GOALS & OKRS (FR-06 & Alg 8.3)
    // =========================================================================

    public function listGoals(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = EmployeeGoal::where('company_id', $company->id)
            ->with(['employee.membership.user:id,name,email', 'approver:id,name']);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $goals = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $goals,
        ]);
    }

    public function createGoal(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'measurement_type' => 'required|string|in:numeric,percentage,milestone,qualitative,learning',
            'baseline_value' => 'nullable|numeric',
            'target_value' => 'required|numeric',
            'current_value' => 'nullable|numeric',
            'unit' => 'nullable|string',
            'due_date' => 'nullable|date',
            'weight' => 'nullable|integer|min:1|max:100',
            'milestones' => 'nullable|array',
        ]);

        $goal = EmployeeGoal::create([
            'company_id' => $company->id,
            'employee_id' => $validated['employee_id'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'measurement_type' => $validated['measurement_type'],
            'baseline_value' => $validated['baseline_value'] ?? 0,
            'target_value' => $validated['target_value'],
            'current_value' => $validated['current_value'] ?? 0,
            'unit' => $validated['unit'] ?? '%',
            'due_date' => $validated['due_date'] ?? null,
            'weight' => $validated['weight'] ?? 10,
            'milestones' => $validated['milestones'] ?? null,
            'status' => 'in_progress',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Goal created successfully.',
            'data' => $goal,
        ], 201);
    }

    public function updateGoalProgress(Company $company, $goalId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'current_value' => 'nullable|numeric',
            'status' => 'nullable|string|in:proposed,in_progress,completed,cancelled,blocked',
            'milestones' => 'nullable|array',
        ]);

        $goal = EmployeeGoal::where('company_id', $company->id)->findOrFail($goalId);

        $updates = [];
        if (isset($validated['current_value'])) {
            $updates['current_value'] = $validated['current_value'];
            if ($goal->measurement_type === 'percentage' && $validated['current_value'] >= 100) {
                $updates['status'] = 'completed';
            } elseif ($goal->measurement_type === 'numeric' && $validated['current_value'] >= $goal->target_value) {
                $updates['status'] = 'completed';
            }
        }

        if (isset($validated['status'])) {
            $updates['status'] = $validated['status'];
        }

        if (isset($validated['milestones'])) {
            $updates['milestones'] = $validated['milestones'];
        }

        $goal->update($updates);

        return response()->json([
            'status' => 'success',
            'message' => 'Goal progress updated.',
            'data' => $goal->fresh(),
        ]);
    }

    // =========================================================================
    // 2. COMPETENCY FRAMEWORKS & SKILL-GAP ENGINE (Feature 2 & Alg 8.6)
    // =========================================================================

    public function listFrameworks(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $frameworks = CompetencyFramework::where('company_id', $company->id)
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $frameworks,
        ]);
    }

    public function createFramework(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'role_target' => 'nullable|string',
            'competencies' => 'required|array',
        ]);

        $framework = CompetencyFramework::create([
            'company_id' => $company->id,
            'name' => $validated['name'],
            'role_target' => $validated['role_target'] ?? 'Senior Engineer',
            'version' => 1,
            'competencies' => $validated['competencies'],
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $framework,
        ], 201);
    }

    public function evaluateSkillGaps(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'framework_id' => 'required|exists:competency_frameworks,id',
        ]);

        $framework = CompetencyFramework::where('company_id', $company->id)->findOrFail($validated['framework_id']);
        $employee = EmploymentRecord::where('company_id', $company->id)
            ->with('membership.user:id,name,email')
            ->findOrFail($validated['employee_id']);

        // Compare assessed levels with target levels in framework
        $existingAssessments = EmployeeCompetencyAssessment::where('company_id', $company->id)
            ->where('employee_id', $employee->id)
            ->get()
            ->keyBy('competency_name');

        $gapResults = [];
        $competencies = $framework->competencies ?? [];

        foreach ($competencies as $comp) {
            $name = $comp['name'] ?? 'General Competency';
            $targetLevel = (int) ($comp['target_level'] ?? 4);
            $currentLevel = isset($existingAssessments[$name]) ? (int) $existingAssessments[$name]->current_level : 2;
            $gap = max(0, $targetLevel - $currentLevel);

            $recommendations = [];
            if ($gap > 0) {
                $recommendations[] = "Participate in architecture pairing on {$name}";
                $recommendations[] = "Review documentation and lead tech check-in for {$name}";
            } else {
                $recommendations[] = "Role benchmark met. Consider mentoring peers in {$name}";
            }

            $gapResults[] = [
                'competency_name' => $name,
                'current_level' => $currentLevel,
                'target_level' => $targetLevel,
                'gap' => $gap,
                'observable_criteria' => $comp['observable_criteria'] ?? "Demonstrated mastery in {$name}",
                'recommended_actions' => $recommendations,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'employee' => $employee,
                'framework' => $framework,
                'analysis' => $gapResults,
            ],
        ]);
    }

    public function recordAssessment(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'framework_id' => 'nullable|exists:competency_frameworks,id',
            'competency_name' => 'required|string',
            'current_level' => 'required|integer|min:1|max:5',
            'target_level' => 'required|integer|min:1|max:5',
            'evidence_notes' => 'nullable|string',
        ]);

        $gap = max(0, $validated['target_level'] - $validated['current_level']);

        $assessment = EmployeeCompetencyAssessment::updateOrCreate(
            [
                'company_id' => $company->id,
                'employee_id' => $validated['employee_id'],
                'competency_name' => $validated['competency_name'],
            ],
            [
                'framework_id' => $validated['framework_id'] ?? null,
                'current_level' => $validated['current_level'],
                'target_level' => $validated['target_level'],
                'gap_score' => $gap,
                'evidence_notes' => $validated['evidence_notes'] ?? null,
                'assessed_by_user_id' => $request->user()->id,
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Competency assessment recorded.',
            'data' => $assessment,
        ]);
    }

    // =========================================================================
    // 3. EMPLOYEE DEVELOPMENT PLANS & MENTORSHIP (FR-09 & Feature 6)
    // =========================================================================

    public function listDevelopmentPlans(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = EmployeeDevelopmentPlan::where('company_id', $company->id)
            ->with(['employee.membership.user:id,name,email', 'mentor:id,name,email']);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        $plans = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $plans,
        ]);
    }

    public function createDevelopmentPlan(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'title' => 'required|string|max:255',
            'target_competency' => 'nullable|string',
            'learning_action' => 'required|string',
            'mentor_user_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $plan = EmployeeDevelopmentPlan::create([
            'company_id' => $company->id,
            'employee_id' => $validated['employee_id'],
            'title' => $validated['title'],
            'target_competency' => $validated['target_competency'] ?? null,
            'learning_action' => $validated['learning_action'],
            'mentor_user_id' => $validated['mentor_user_id'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'status' => 'active',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Development plan created.',
            'data' => $plan->load('mentor:id,name,email'),
        ], 201);
    }

    public function completeDevelopmentPlan(Company $company, $planId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'outcome_reflection' => 'required|string|min:10',
        ]);

        $plan = EmployeeDevelopmentPlan::where('company_id', $company->id)->findOrFail($planId);
        $plan->update([
            'status' => 'completed',
            'outcome_reflection' => $validated['outcome_reflection'],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Development plan milestone successfully completed.',
            'data' => $plan,
        ]);
    }

    // =========================================================================
    // 4. STRUCTURED FEEDBACK & RECOGNITION (FR-08)
    // =========================================================================

    public function listFeedbacks(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = EmployeeFeedback::where('company_id', $company->id)
            ->with(['employee.membership.user:id,name,email', 'author:id,name,email']);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        $feedbacks = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $feedbacks,
        ]);
    }

    public function createFeedback(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'feedback_type' => 'required|string|in:recognition,constructive,peer,coaching',
            'content' => 'required|string|min:5',
            'badge' => 'nullable|string',
            'visibility' => 'nullable|string|in:public,private_manager,confidential_hr',
        ]);

        $feedback = EmployeeFeedback::create([
            'company_id' => $company->id,
            'employee_id' => $validated['employee_id'],
            'author_user_id' => $request->user()->id,
            'feedback_type' => $validated['feedback_type'],
            'content' => $validated['content'],
            'badge' => $validated['badge'] ?? 'Star Contributor',
            'visibility' => $validated['visibility'] ?? 'public',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Feedback submitted.',
            'data' => $feedback->load('author:id,name'),
        ], 201);
    }

    // =========================================================================
    // 5. ONBOARDING & OFFBOARDING CHECKLISTS (FR-10)
    // =========================================================================

    public function listChecklists(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $query = OnboardingChecklist::where('company_id', $company->id)
            ->with('employee.membership.user:id,name,email');

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        $checklists = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $checklists,
        ]);
    }

    public function createChecklist(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'employee_id' => 'required|exists:employment_records,id',
            'template_name' => 'required|string|max:255',
            'type' => 'nullable|string|in:onboarding,offboarding',
            'items' => 'nullable|array',
        ]);

        $defaultItems = $validated['items'] ?? [
            ['id' => 1, 'title' => 'Development Environment Setup & Repository Access', 'completed' => false],
            ['id' => 2, 'title' => 'Security, Password & 2FA Orientation', 'completed' => false],
            ['id' => 3, 'title' => 'Architecture & Code Review Best Practices Walkthrough', 'completed' => false],
            ['id' => 4, 'title' => 'First Task Assignment & Buddy Introduction', 'completed' => false],
            ['id' => 5, 'title' => '30-Day Check-in & Expectations Review', 'completed' => false],
        ];

        $checklist = OnboardingChecklist::create([
            'company_id' => $company->id,
            'employee_id' => $validated['employee_id'],
            'template_name' => $validated['template_name'],
            'type' => $validated['type'] ?? 'onboarding',
            'items' => $defaultItems,
            'progress_percent' => 0,
            'status' => 'in_progress',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $checklist,
        ], 201);
    }

    public function toggleChecklistItem(Company $company, $checklistId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'item_id' => 'required|integer',
            'completed' => 'required|boolean',
        ]);

        $checklist = OnboardingChecklist::where('company_id', $company->id)->findOrFail($checklistId);

        $items = $checklist->items ?? [];
        $completedCount = 0;

        foreach ($items as &$item) {
            if ($item['id'] == $validated['item_id']) {
                $item['completed'] = $validated['completed'];
                $item['completed_at'] = $validated['completed'] ? Carbon::now()->toIso8601String() : null;
            }
            if (!empty($item['completed'])) {
                $completedCount++;
            }
        }

        $total = count($items);
        $pct = $total > 0 ? (int) round(($completedCount / $total) * 100) : 0;
        $status = $pct >= 100 ? 'completed' : 'in_progress';

        $checklist->update([
            'items' => $items,
            'progress_percent' => $pct,
            'status' => $status,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $checklist->fresh(),
        ]);
    }

    // =========================================================================
    // 6. HR REPORTING & AUDITED CSV EXPORT (FR-16)
    // =========================================================================

    public function exportPerformanceData(Company $company, Request $request): StreamedResponse
    {
        $this->resolveMembership($company, $request);

        $reviews = PerformanceReview::where('company_id', $company->id)
            ->with(['cycle', 'employee.membership.user', 'reviewer.membership.user'])
            ->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="finovo_performance_export_' . date('Y-m-d') . '.csv"',
        ];

        return response()->stream(function () use ($reviews) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Review ID',
                'Cycle Title',
                'Employee Name',
                'Reviewer Name',
                'Status',
                'Self Rating',
                'Manager Rating',
                'Calibrated Rating',
                'Final Rating',
                'Quality Score (%)',
                'Released At',
            ]);

            foreach ($reviews as $rev) {
                fputcsv($handle, [
                    $rev->id,
                    $rev->cycle->title ?? 'N/A',
                    $rev->employee->membership->user->name ?? 'Unknown',
                    $rev->reviewer->membership->user->name ?? 'Unassigned',
                    $rev->status,
                    $rev->self_rating,
                    $rev->manager_rating,
                    $rev->calibrated_rating,
                    $rev->final_rating,
                    $rev->quality_score,
                    $rev->released_at ? $rev->released_at->toIso8601String() : '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}

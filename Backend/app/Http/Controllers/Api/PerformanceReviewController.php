<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\EmploymentRecord;
use App\Models\HrAuditEvent;
use App\Models\PerformanceAppeal;
use App\Models\PerformanceReview;
use App\Models\PerformanceReviewCycle;
use App\Models\ReviewEvidenceLink;
use App\Models\ReviewTemplate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PerformanceReviewController extends Controller
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
    // 1. REVIEW CYCLES & ASSIGNMENTS
    // =========================================================================

    public function listCycles(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $cycles = PerformanceReviewCycle::where('company_id', $company->id)
            ->with(['template:id,title,version', 'creator:id,name'])
            ->withCount('reviews')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $cycles,
        ]);
    }

    public function createCycle(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'cycle_type' => 'nullable|string|in:annual,quarterly,probation,project_end,checkin',
            'description' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'self_review_deadline' => 'nullable|date',
            'manager_review_deadline' => 'nullable|date',
            'template_id' => 'nullable|exists:review_templates,id',
        ]);

        return DB::transaction(function () use ($company, $request, $validated) {
            $cycle = PerformanceReviewCycle::create([
                'company_id' => $company->id,
                'title' => $validated['title'],
                'cycle_type' => $validated['cycle_type'] ?? 'annual',
                'description' => $validated['description'] ?? null,
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'self_review_deadline' => $validated['self_review_deadline'] ?? null,
                'manager_review_deadline' => $validated['manager_review_deadline'] ?? null,
                'template_id' => $validated['template_id'] ?? null,
                'created_by_user_id' => $request->user()->id,
                'status' => 'active',
            ]);

            // Automatically & idempotently generate review instances for all active employees
            $employees = EmploymentRecord::where('company_id', $company->id)
                ->where('status', 'active')
                ->get();

            $createdCount = 0;
            foreach ($employees as $emp) {
                // Find reviewer from manager_membership_id
                $reviewerRecord = null;
                if ($emp->manager_membership_id) {
                    $reviewerRecord = EmploymentRecord::where('company_id', $company->id)
                        ->where('membership_id', $emp->manager_membership_id)
                        ->first();
                }

                $review = PerformanceReview::firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'cycle_id' => $cycle->id,
                        'employee_id' => $emp->id,
                    ],
                    [
                        'template_id' => $cycle->template_id,
                        'reviewer_id' => $reviewerRecord ? $reviewerRecord->id : null,
                        'status' => 'self_review',
                        'version' => 1,
                        'quality_score' => 0.00,
                    ]
                );

                if ($review->wasRecentlyCreated) {
                    $createdCount++;
                }
            }

            HrAuditEvent::create([
                'company_id' => $company->id,
                'actor_user_id' => $request->user()->id,
                'action' => 'review_cycle_created',
                'entity_type' => 'PerformanceReviewCycle',
                'entity_id' => $cycle->id,
                'details' => [
                    'title' => $cycle->title,
                    'assignments_created' => $createdCount,
                ],
            ]);

            return response()->json([
                'status' => 'success',
                'message' => "Cycle created with {$createdCount} employee reviews assigned.",
                'data' => $cycle->loadCount('reviews'),
            ], 201);
        });
    }

    public function showCycle(Company $company, $cycleId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $cycle = PerformanceReviewCycle::where('company_id', $company->id)
            ->with(['template', 'creator:id,name'])
            ->withCount('reviews')
            ->findOrFail($cycleId);

        // Compute completion stats
        $reviews = PerformanceReview::where('company_id', $company->id)
            ->where('cycle_id', $cycle->id)
            ->get();

        $stats = [
            'total' => $reviews->count(),
            'self_review_pending' => $reviews->where('status', 'self_review')->count(),
            'manager_review_pending' => $reviews->where('status', 'manager_review')->count(),
            'calibration_pending' => $reviews->where('status', 'calibration')->count(),
            'finalized' => $reviews->whereIn('status', ['released', 'acknowledged'])->count(),
            'average_rating' => round($reviews->whereNotNull('final_rating')->avg('final_rating') ?: 0, 2),
            'average_quality_score' => round($reviews->avg('quality_score') ?: 0, 1),
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'cycle' => $cycle,
                'stats' => $stats,
            ],
        ]);
    }

    public function updateCycleStatus(Company $company, $cycleId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'status' => 'required|string|in:draft,active,review_closed,calibration,finalized,archived',
        ]);

        $cycle = PerformanceReviewCycle::where('company_id', $company->id)->findOrFail($cycleId);
        $oldStatus = $cycle->status;
        $cycle->update(['status' => $validated['status']]);

        HrAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'review_cycle_status_changed',
            'entity_type' => 'PerformanceReviewCycle',
            'entity_id' => $cycle->id,
            'details' => ['from' => $oldStatus, 'to' => $cycle->status],
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $cycle,
        ]);
    }

    // =========================================================================
    // 2. REVIEW TEMPLATES
    // =========================================================================

    public function listTemplates(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $templates = ReviewTemplate::where('company_id', $company->id)
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $templates,
        ]);
    }

    public function createTemplate(Company $company, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'role_type' => 'nullable|string',
            'sections' => 'nullable|array',
            'rating_scale' => 'nullable|array',
        ]);

        $defaultSections = $validated['sections'] ?? [
            ['id' => 'goals', 'title' => 'Goals & Key Deliverables', 'weight' => 40],
            ['id' => 'competencies', 'title' => 'Core Competencies & Quality', 'weight' => 30],
            ['id' => 'collaboration', 'title' => 'Ownership & Collaboration', 'weight' => 30],
        ];

        $defaultScale = $validated['rating_scale'] ?? [
            1 => 'Needs Immediate Improvement',
            2 => 'Developing & Approaching Expectations',
            3 => 'Consistently Meets High Standard',
            4 => 'Exceeds Role Expectations',
            5 => 'Exceptional Organization-Wide Impact',
        ];

        $template = ReviewTemplate::create([
            'company_id' => $company->id,
            'title' => $validated['title'],
            'role_type' => $validated['role_type'] ?? 'general',
            'version' => 1,
            'sections' => $defaultSections,
            'rating_scale' => $defaultScale,
            'is_published' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $template,
        ], 201);
    }

    // =========================================================================
    // 3. REVIEWS LIFECYCLE, SELF & MANAGER ASSESSMENTS
    // =========================================================================

    public function listReviews(Company $company, Request $request): JsonResponse
    {
        $membership = $this->resolveMembership($company, $request);
        $empRecord = $this->resolveEmploymentRecord($company, $request->user());

        $query = PerformanceReview::where('company_id', $company->id)
            ->with([
                'cycle:id,title,status,start_date,end_date',
                'employee.membership.user:id,name,email',
                'reviewer.membership.user:id,name,email',
                'evidenceLinks',
            ]);

        // Filter by cycle
        if ($request->filled('cycle_id')) {
            $query->where('cycle_id', $request->cycle_id);
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by employee
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        // If not HR / Admin, show either own reviews or direct reports reviews
        $isHrAdmin = $membership->role && in_array($membership->role->slug, ['company-owner', 'company-admin', 'hr-officer']);
        if (!$isHrAdmin && $empRecord) {
            $query->where(function ($q) use ($empRecord) {
                $q->where('employee_id', $empRecord->id)
                  ->orWhere('reviewer_id', $empRecord->id);
            });
        }

        $reviews = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $reviews,
        ]);
    }

    public function showReview(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $review = PerformanceReview::where('company_id', $company->id)
            ->with([
                'cycle',
                'template',
                'employee.membership.user:id,name,email',
                'reviewer.membership.user:id,name,email',
                'evidenceLinks.linkedBy:id,name',
                'appeals.resolver:id,name',
            ])
            ->findOrFail($reviewId);

        return response()->json([
            'status' => 'success',
            'data' => $review,
        ]);
    }

    public function submitSelfReview(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'self_rating' => 'required|numeric|min:1|max:5',
            'self_summary' => 'required|string|min:10',
            'self_responses' => 'nullable|array',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $review->update([
            'self_rating' => $validated['self_rating'],
            'self_summary' => $validated['self_summary'],
            'self_responses' => $validated['self_responses'] ?? null,
            'self_submitted_at' => Carbon::now(),
            'status' => 'manager_review',
        ]);

        $this->evaluateQualityScore($review);

        return response()->json([
            'status' => 'success',
            'message' => 'Self-assessment submitted successfully.',
            'data' => $review->fresh(),
        ]);
    }

    public function submitManagerReview(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'manager_rating' => 'required|numeric|min:1|max:5',
            'manager_summary' => 'required|string|min:10',
            'manager_responses' => 'nullable|array',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $review->update([
            'manager_rating' => $validated['manager_rating'],
            'manager_summary' => $validated['manager_summary'],
            'manager_responses' => $validated['manager_responses'] ?? null,
            'manager_submitted_at' => Carbon::now(),
            'status' => 'calibration',
        ]);

        $this->evaluateQualityScore($review);

        return response()->json([
            'status' => 'success',
            'message' => 'Manager assessment submitted and moved to calibration.',
            'data' => $review->fresh(),
        ]);
    }

    // =========================================================================
    // 4. EVIDENCE-LINKED PERFORMANCE PASSPORT (Feature 1 & Alg 8.5)
    // =========================================================================

    public function linkEvidence(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'evidence_type' => 'required|string|in:task,project,training,feedback,client_deliverable',
            'source_id' => 'nullable|integer',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'source_url' => 'nullable|string',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $evidence = ReviewEvidenceLink::create([
            'company_id' => $company->id,
            'review_id' => $review->id,
            'evidence_type' => $validated['evidence_type'],
            'source_id' => $validated['source_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'source_url' => $validated['source_url'] ?? null,
            'linked_by_user_id' => $request->user()->id,
        ]);

        $this->evaluateQualityScore($review);

        return response()->json([
            'status' => 'success',
            'message' => 'Evidence linked to Performance Passport.',
            'data' => $evidence,
        ], 201);
    }

    public function removeEvidence(Company $company, $reviewId, $evidenceId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);
        $evidence = ReviewEvidenceLink::where('company_id', $company->id)
            ->where('review_id', $review->id)
            ->findOrFail($evidenceId);

        $evidence->delete();
        $this->evaluateQualityScore($review);

        return response()->json([
            'status' => 'success',
            'message' => 'Evidence unlinked.',
        ]);
    }

    // =========================================================================
    // 5. CALIBRATION, FINALIZATION, ACKNOWLEDGMENT & APPEALS
    // =========================================================================

    public function calibrateReview(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'calibrated_rating' => 'required|numeric|min:1|max:5',
            'calibration_notes' => 'required|string|min:5',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $review->update([
            'calibrated_rating' => $validated['calibrated_rating'],
            'calibration_notes' => $validated['calibration_notes'],
            'calibrated_by_user_id' => $request->user()->id,
            'status' => 'ready_for_release',
        ]);

        HrAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'review_calibrated',
            'entity_type' => 'PerformanceReview',
            'entity_id' => $review->id,
            'details' => [
                'manager_rating' => $review->manager_rating,
                'calibrated_rating' => $review->calibrated_rating,
                'notes' => $validated['calibration_notes'],
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Calibration recorded and ready for release.',
            'data' => $review->fresh(),
        ]);
    }

    public function finalizeAndRelease(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        // Final rating defaults to calibrated_rating if present, else manager_rating
        $finalRating = $review->calibrated_rating ?? $review->manager_rating ?? 3.00;

        $review->update([
            'final_rating' => $finalRating,
            'released_at' => Carbon::now(),
            'status' => 'released',
        ]);

        HrAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'review_finalized_and_released',
            'entity_type' => 'PerformanceReview',
            'entity_id' => $review->id,
            'details' => ['final_rating' => $finalRating],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Review finalized and released to employee.',
            'data' => $review->fresh(),
        ]);
    }

    public function acknowledgeReview(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'comment' => 'nullable|string',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $review->update([
            'acknowledged_at' => Carbon::now(),
            'employee_acknowledgment_comment' => $validated['comment'] ?? null,
            'status' => 'acknowledged',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Review receipt acknowledged.',
            'data' => $review->fresh(),
        ]);
    }

    public function submitAppeal(Company $company, $reviewId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'reason' => 'required|string|min:15',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);

        $appeal = PerformanceAppeal::create([
            'company_id' => $company->id,
            'review_id' => $review->id,
            'employee_id' => $review->employee_id,
            'reason' => $validated['reason'],
            'status' => 'pending',
        ]);

        $review->update(['status' => 'appeal_pending']);

        HrAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'review_appeal_submitted',
            'entity_type' => 'PerformanceAppeal',
            'entity_id' => $appeal->id,
            'details' => ['reason' => $appeal->reason],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Performance review appeal submitted for independent review.',
            'data' => $appeal,
        ], 201);
    }

    public function resolveAppeal(Company $company, $reviewId, $appealId, Request $request): JsonResponse
    {
        $this->resolveMembership($company, $request);

        $validated = $request->validate([
            'status' => 'required|string|in:upheld,rejected',
            'reviewer_notes' => 'required|string|min:5',
            'amended_rating' => 'nullable|numeric|min:1|max:5',
        ]);

        $review = PerformanceReview::where('company_id', $company->id)->findOrFail($reviewId);
        $appeal = PerformanceAppeal::where('company_id', $company->id)
            ->where('review_id', $review->id)
            ->findOrFail($appealId);

        $appeal->update([
            'status' => $validated['status'],
            'reviewer_notes' => $validated['reviewer_notes'],
            'resolved_by_user_id' => $request->user()->id,
            'resolved_at' => Carbon::now(),
        ]);

        if ($validated['status'] === 'upheld') {
            $newRating = $validated['amended_rating'] ?? $review->final_rating;
            $review->update([
                'status' => 'amended',
                'final_rating' => $newRating,
                'version' => $review->version + 1,
            ]);
        } else {
            $review->update(['status' => 'acknowledged']);
        }

        HrAuditEvent::create([
            'company_id' => $company->id,
            'actor_user_id' => $request->user()->id,
            'action' => 'review_appeal_resolved',
            'entity_type' => 'PerformanceAppeal',
            'entity_id' => $appeal->id,
            'details' => [
                'status' => $appeal->status,
                'notes' => $appeal->reviewer_notes,
            ],
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Appeal resolved.',
            'data' => [
                'appeal' => $appeal,
                'review' => $review->fresh(),
            ],
        ]);
    }

    // =========================================================================
    // 6. PERFORMANCE EVIDENCE QUALITY INDICATOR & REVIEW GUARD (Alg 8.5 & Alg 8.7)
    // =========================================================================

    private function evaluateQualityScore(PerformanceReview $review): void
    {
        $score = 0;
        $flags = [];

        // 1. Self assessment completed
        if (!empty($review->self_summary) && !empty($review->self_rating)) {
            $score += 25;
            $flags[] = 'Self-assessment submitted with narrative reflection';
        } else {
            $flags[] = 'Notice: Self-assessment pending';
        }

        // 2. Manager assessment narrative depth
        if (!empty($review->manager_summary) && strlen($review->manager_summary) >= 30) {
            $score += 25;
            $flags[] = 'Detailed managerial feedback documented';
        } elseif (!empty($review->manager_summary)) {
            $score += 15;
            $flags[] = 'Manager narrative is brief; more observable examples advised';
        } else {
            $flags[] = 'Manager evaluation pending';
        }

        // 3. Evidence-Linked Performance Passport count
        $evidenceCount = $review->evidenceLinks()->count();
        if ($evidenceCount >= 2) {
            $score += 30;
            $flags[] = "High evidentiary support ({$evidenceCount} verified deliverables linked)";
        } elseif ($evidenceCount === 1) {
            $score += 20;
            $flags[] = 'Single evidence item linked; consider adding peer or deliverable references';
        } else {
            $flags[] = 'Fairness Guard Warning: No verifiable work evidence linked to support assessment';
        }

        // 4. Rating range sanity & divergence guard
        if ($review->self_rating && $review->manager_rating) {
            $divergence = abs($review->self_rating - $review->manager_rating);
            if ($divergence <= 1.0) {
                $score += 20;
                $flags[] = 'Strong alignment between employee reflection and manager evaluation';
            } elseif ($divergence >= 2.0) {
                $score += 10;
                $flags[] = 'Fairness Guard Warning: High rating divergence (> 2.0) requires calibration review';
            } else {
                $score += 15;
            }
        } else {
            $score += 10;
        }

        $review->update([
            'quality_score' => min(100.00, $score),
            'quality_flags' => $flags,
        ]);
    }
}

<?php

namespace App\Domain\Recruitment\Services;

use App\Models\Candidate;
use App\Models\CandidateApplication;
use App\Models\CandidateOffer;
use App\Models\InterviewScorecard;
use App\Models\JobRequisition;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CandidatePipelineService
{
    /**
     * Get list of job requisitions for company with filtering
     */
    public function getRequisitions(int $companyId, array $filters = [])
    {
        $query = JobRequisition::where('company_id', $companyId)
            ->with(['department', 'position', 'requestedBy', 'approvedBy'])
            ->withCount('applications');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        return $query->orderByDesc('id')->get();
    }

    /**
     * Create new job requisition
     */
    public function createRequisition(int $companyId, array $data, int $userId): JobRequisition
    {
        return DB::transaction(function () use ($companyId, $data, $userId) {
            $year = date('Y');
            $count = JobRequisition::where('company_id', $companyId)->count() + 1;
            $reqNumber = sprintf('REQ-%s-%03d', $year, $count);

            return JobRequisition::create([
                'company_id' => $companyId,
                'department_id' => $data['department_id'],
                'job_position_id' => $data['job_position_id'] ?? null,
                'requisition_number' => $reqNumber,
                'title' => $data['title'],
                'headcount' => $data['headcount'] ?? 1,
                'employment_type' => $data['employment_type'] ?? 'full_time',
                'min_salary' => $data['min_salary'] ?? null,
                'max_salary' => $data['max_salary'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'status' => 'draft',
                'requested_by_user_id' => $userId,
                'job_description' => $data['job_description'] ?? null,
                'requirements' => $data['requirements'] ?? null,
            ]);
        });
    }

    /**
     * Approve job requisition, transitioning it to open state
     */
    public function approveRequisition(JobRequisition $requisition, int $userId): JobRequisition
    {
        $requisition->update([
            'status' => 'open',
            'approved_by_user_id' => $userId,
            'approved_at' => now(),
        ]);

        return $requisition->fresh();
    }

    /**
     * Advance candidate pipeline stage with state validation
     */
    public function advanceStage(CandidateApplication $application, string $newStage, ?string $notes = null): CandidateApplication
    {
        $validStages = [
            'applied',
            'screening',
            'interviewing',
            'offer_extended',
            'offer_accepted',
            'offer_declined',
            'hired',
            'rejected',
            'withdrawn',
        ];

        if (!in_array($newStage, $validStages, true)) {
            throw new InvalidArgumentException("Invalid candidate stage: {$newStage}");
        }

        $application->update([
            'current_stage' => $newStage,
            'stage_notes' => $notes ?? $application->stage_notes,
        ]);

        return $application->fresh(['candidate', 'requisition', 'scorecards', 'latestOffer']);
    }

    /**
     * Submit interview scorecard evaluation
     */
    public function submitScorecard(CandidateApplication $application, array $data, int $interviewerMembershipId): InterviewScorecard
    {
        return InterviewScorecard::create([
            'company_id' => $application->company_id,
            'candidate_application_id' => $application->id,
            'interviewer_membership_id' => $interviewerMembershipId,
            'interview_stage' => $data['interview_stage'],
            'overall_recommendation' => $data['overall_recommendation'],
            'criteria_scores' => $data['criteria_scores'],
            'summary_notes' => $data['summary_notes'] ?? null,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Create formal candidate offer
     */
    public function createOffer(CandidateApplication $application, array $data, int $userId): CandidateOffer
    {
        return CandidateOffer::create([
            'company_id' => $application->company_id,
            'candidate_application_id' => $application->id,
            'base_salary' => $data['base_salary'],
            'currency' => $data['currency'] ?? 'USD',
            'bonus_percentage' => $data['bonus_percentage'] ?? null,
            'equity_units' => $data['equity_units'] ?? null,
            'proposed_start_date' => $data['proposed_start_date'],
            'expiration_date' => $data['expiration_date'] ?? null,
            'status' => 'approved',
            'approved_by_user_id' => $userId,
            'approved_at' => now(),
            'terms_snapshot' => $data['terms_snapshot'] ?? null,
        ]);
    }
}

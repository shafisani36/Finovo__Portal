<?php

namespace App\Domain\Performance\Services;

use App\Models\CompetencyFramework;
use App\Models\EmployeeCompetencyAssessment;
use App\Models\EmploymentRecord;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SkillsGapAnalysisService
{
    /**
     * Records an assessment for an employee competency and computes gap score
     */
    public function assessEmployee(
        int $companyId,
        int $employeeId,
        string $competencyName,
        int $currentLevel,
        int $targetLevel,
        ?int $frameworkId = null,
        ?string $evidenceNotes = null,
        ?int $assessorUserId = null
    ): EmployeeCompetencyAssessment {
        if ($currentLevel < 1 || $currentLevel > 5 || $targetLevel < 1 || $targetLevel > 5) {
            throw new InvalidArgumentException("Competency levels must be evaluated on a 1 to 5 scale.");
        }

        $gapScore = max(0, $targetLevel - $currentLevel);

        return EmployeeCompetencyAssessment::updateOrCreate(
            [
                'company_id' => $companyId,
                'employee_id' => $employeeId,
                'competency_name' => $competencyName,
            ],
            [
                'framework_id' => $frameworkId,
                'current_level' => $currentLevel,
                'target_level' => $targetLevel,
                'gap_score' => $gapScore,
                'evidence_notes' => $evidenceNotes,
                'assessed_by_user_id' => $assessorUserId,
            ]
        );
    }

    /**
     * Compute organization-wide skills gap matrix
     */
    public function getOrganizationSkillsGapMatrix(int $companyId): array
    {
        $assessments = EmployeeCompetencyAssessment::where('company_id', $companyId)
            ->with(['employee.department'])
            ->get();

        $byCompetency = [];
        foreach ($assessments as $a) {
            $comp = $a->competency_name;
            if (!isset($byCompetency[$comp])) {
                $byCompetency[$comp] = [
                    'competency' => $comp,
                    'total_assessed' => 0,
                    'avg_current_level' => 0,
                    'avg_target_level' => 0,
                    'total_gap' => 0,
                    'critical_gap_count' => 0, // gap >= 2
                ];
            }

            $byCompetency[$comp]['total_assessed']++;
            $byCompetency[$comp]['avg_current_level'] += $a->current_level;
            $byCompetency[$comp]['avg_target_level'] += $a->target_level;
            $byCompetency[$comp]['total_gap'] += $a->gap_score;
            if ($a->gap_score >= 2) {
                $byCompetency[$comp]['critical_gap_count']++;
            }
        }

        foreach ($byCompetency as $comp => &$data) {
            $data['avg_current_level'] = round($data['avg_current_level'] / $data['total_assessed'], 2);
            $data['avg_target_level'] = round($data['avg_target_level'] / $data['total_assessed'], 2);
            $data['avg_gap'] = round($data['total_gap'] / $data['total_assessed'], 2);
        }

        return array_values($byCompetency);
    }

    /**
     * Deterministic weighted rubric performance calculation
     */
    public function calculateWeightedScore(array $sectionScores, array $sectionWeights): float
    {
        $totalWeight = array_sum($sectionWeights);
        if ($totalWeight <= 0) {
            throw new InvalidArgumentException("Total section weights must be greater than zero.");
        }

        $weightedSum = 0.0;
        foreach ($sectionScores as $sectionKey => $score) {
            $weight = $sectionWeights[$sectionKey] ?? 0;
            $weightedSum += ($score * $weight);
        }

        return round($weightedSum / $totalWeight, 2);
    }
}

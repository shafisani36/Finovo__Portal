<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsKpi;
use App\Models\AnalyticsKpiVersion;
use App\Models\AnalyticsSnapshot;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\Project;
use App\Models\CompanyMembership;
use App\Models\BillingInvoice;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsEngineService
{
    /**
     * Compute a KPI snapshot deterministically for a company and date range.
     */
    public function computeKpiSnapshot(
        int $companyId,
        string $kpiCode,
        Carbon $startDate,
        Carbon $endDate,
        array $dimensions = []
    ): AnalyticsSnapshot {
        $kpi = AnalyticsKpi::where('kpi_code', $kpiCode)->firstOrFail();
        $version = $kpi->latestVersion;
        $versionNumber = $version ? $version->version_number : 1;

        $computed = match ($kpiCode) {
            'task_completion_rate' => $this->calculateTaskCompletionRate($companyId, $startDate, $endDate, $dimensions),
            'employee_utilization' => $this->calculateEmployeeUtilization($companyId, $startDate, $endDate, $dimensions),
            'project_gross_margin' => $this->calculateProjectGrossMargin($companyId, $startDate, $endDate, $dimensions),
            'sprint_delivery_velocity' => $this->calculateDeliveryVelocity($companyId, $startDate, $endDate, $dimensions),
            default => $this->calculateFallbackGeneric($companyId, $startDate, $endDate),
        };

        $qualityStatus = 'verified';
        if ($computed['denominator'] == 0 && $computed['numerator'] == 0) {
            $qualityStatus = 'insufficient_sample';
        }

        return AnalyticsSnapshot::updateOrCreate(
            [
                'company_id' => $companyId,
                'kpi_code' => $kpiCode,
                'kpi_version_number' => $versionNumber,
                'time_bucket' => 'custom',
                'period_start' => $startDate->toDateString(),
                'period_end' => $endDate->toDateString(),
                'dimension_values' => empty($dimensions) ? null : $dimensions,
            ],
            [
                'metric_value' => $computed['metric_value'],
                'numerator' => $computed['numerator'],
                'denominator' => $computed['denominator'],
                'source_watermark' => Carbon::now()->toIso8601String(),
                'quality_status' => $qualityStatus,
                'computed_at' => Carbon::now(),
            ]
        );
    }

    /**
     * FR-13-06 Task completion rate algorithm
     * Rate = (Completed tasks in period / Eligible due tasks in period) * 100
     */
    private function calculateTaskCompletionRate(int $companyId, Carbon $startDate, Carbon $endDate, array $dimensions): array
    {
        $query = Task::where('company_id', $companyId)
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('due_at', [$startDate->toDateTimeString(), $endDate->toDateTimeString()])
                  ->orWhere(function ($sub) use ($startDate, $endDate) {
                      $sub->whereNull('due_at')
                          ->whereBetween('created_at', [$startDate->toDateTimeString(), $endDate->toDateTimeString()]);
                  });
            });

        if (!empty($dimensions['project_id'])) {
            $query->where('project_id', $dimensions['project_id']);
        }

        $dueTasks = (clone $query)->count();
        $completedTasks = (clone $query)->whereIn('status', ['completed', 'done', 'closed'])->count();

        $rate = $dueTasks > 0 ? round(($completedTasks / $dueTasks) * 100, 2) : 100.00;

        return [
            'metric_value' => $rate,
            'numerator' => $completedTasks,
            'denominator' => $dueTasks,
        ];
    }

    /**
     * FR-13-06 Employee utilization algorithm
     * Rate = (Total logged work seconds / Expected working seconds) * 100
     */
    private function calculateEmployeeUtilization(int $companyId, Carbon $startDate, Carbon $endDate, array $dimensions): array
    {
        $activeMembers = CompanyMembership::where('company_id', $companyId)
            ->where('status', 'active')
            ->count();

        $workDays = max(1, $startDate->diffInWeekdays($endDate) ?: 1);
        $expectedHours = max(1, $activeMembers * $workDays * 8);

        $loggedQuery = TimeEntry::where('company_id', $companyId)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()]);

        if (!empty($dimensions['project_id'])) {
            $loggedQuery->where('project_id', $dimensions['project_id']);
        }

        $loggedHours = round(($loggedQuery->sum('duration_seconds') ?: 0) / 3600, 2);
        $utilizationRate = round(($loggedHours / $expectedHours) * 100, 2);

        return [
            'metric_value' => min($utilizationRate, 100.0),
            'numerator' => $loggedHours,
            'denominator' => $expectedHours,
        ];
    }

    /**
     * FR-13-06 Project gross margin algorithm
     * Rate = ((Invoiced revenue - labor costs) / Invoiced revenue) * 100
     */
    private function calculateProjectGrossMargin(int $companyId, Carbon $startDate, Carbon $endDate, array $dimensions): array
    {
        $invoicedRevenue = (float) BillingInvoice::where('company_id', $companyId)
            ->whereBetween('created_at', [$startDate->toDateTimeString(), $endDate->toDateTimeString()])
            ->where('status', 'paid')
            ->sum('total_amount');

        // Estimate labor cost from logged time @ standardized blended cost rate ($45/hr)
        $loggedSeconds = (int) TimeEntry::where('company_id', $companyId)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->sum('duration_seconds');
        $laborCost = round(($loggedSeconds / 3600) * 45.0, 2);

        if ($invoicedRevenue <= 0) {
            return [
                'metric_value' => 0.00,
                'numerator' => 0,
                'denominator' => max(1, $laborCost),
            ];
        }

        $margin = round((($invoicedRevenue - $laborCost) / $invoicedRevenue) * 100, 2);

        return [
            'metric_value' => $margin,
            'numerator' => max(0, $invoicedRevenue - $laborCost),
            'denominator' => $invoicedRevenue,
        ];
    }

    /**
     * Delivery Velocity: Completed tasks count / points in period
     */
    private function calculateDeliveryVelocity(int $companyId, Carbon $startDate, Carbon $endDate, array $dimensions): array
    {
        $completedTasks = Task::where('company_id', $companyId)
            ->whereBetween('updated_at', [$startDate->toDateTimeString(), $endDate->toDateTimeString()])
            ->whereIn('status', ['completed', 'done'])
            ->count();

        return [
            'metric_value' => (float) $completedTasks,
            'numerator' => (float) $completedTasks,
            'denominator' => 1.0,
        ];
    }

    private function calculateFallbackGeneric(int $companyId, Carbon $startDate, Carbon $endDate): array
    {
        return [
            'metric_value' => 0.0,
            'numerator' => 0.0,
            'denominator' => 1.0,
        ];
    }
}

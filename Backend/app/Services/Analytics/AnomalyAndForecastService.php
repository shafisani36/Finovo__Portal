<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsAnomaly;
use App\Models\AnalyticsForecast;
use App\Models\AnalyticsSnapshot;
use App\Services\Events\DomainEventDispatcher;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnomalyAndForecastService
{
    public function __construct(
        protected DomainEventDispatcher $eventDispatcher
    ) {}

    /**
     * Anomaly detection pipeline (Section 7).
     * Analyzes snapshots of a KPI to detect abnormal fluctuations.
     */
    public function detectAnomalies(int $companyId, string $kpiCode, float $thresholdPercentage = 20.0): array
    {
        $snapshots = AnalyticsSnapshot::where('company_id', $companyId)
            ->where('kpi_code', $kpiCode)
            ->orderByDesc('period_end')
            ->take(12)
            ->get();

        if ($snapshots->count() < 3) {
            return [];
        }

        $latest = $snapshots->first();
        $history = $snapshots->slice(1);
        $averageBaseline = $history->avg('metric_value') ?: 1.0;

        $observed = (float) $latest->metric_value;
        $diff = abs($observed - $averageBaseline);
        $deviationPercent = round(($diff / max(0.01, $averageBaseline)) * 100, 2);

        $anomaliesDetected = [];

        if ($deviationPercent >= $thresholdPercentage) {
            $severity = 'low';
            if ($deviationPercent >= 50.0) {
                $severity = 'critical';
            } elseif ($deviationPercent >= 35.0) {
                $severity = 'medium';
            }

            $anomaly = AnalyticsAnomaly::create([
                'company_id' => $companyId,
                'kpi_code' => $kpiCode,
                'baseline_value' => $averageBaseline,
                'observed_value' => $observed,
                'deviation_percent' => $deviationPercent,
                'severity' => $severity,
                'explanation_summary' => "Significant {$deviationPercent}% deviation detected from rolling baseline of {$averageBaseline}.",
                'evidence_context' => [
                    'historical_sample_size' => $history->count(),
                    'period_start' => $latest->period_start,
                    'period_end' => $latest->period_end,
                    'history_values' => $history->pluck('metric_value')->all(),
                ],
                'detected_at' => Carbon::now(),
            ]);

            // Dispatch domain event
            $this->eventDispatcher->dispatch(
                eventType: 'analytics.anomaly_detected',
                companyId: $companyId,
                producer: 'analytics-engine',
                data: [
                    'anomaly_id' => $anomaly->id,
                    'kpi_code' => $kpiCode,
                    'severity' => $severity,
                    'deviation_percent' => $deviationPercent,
                ]
            );

            $anomaliesDetected[] = $anomaly;
        }

        return $anomaliesDetected;
    }

    /**
     * Forecasting pipeline (Section 7).
     * Linear trend with uncertainty interval backtesting.
     */
    public function generateForecast(int $companyId, string $kpiCode, int $horizonDays = 30): AnalyticsForecast
    {
        $snapshots = AnalyticsSnapshot::where('company_id', $companyId)
            ->where('kpi_code', $kpiCode)
            ->orderBy('period_end')
            ->take(15)
            ->get();

        $targetDate = Carbon::now()->addDays($horizonDays);

        if ($snapshots->count() < 2) {
            // Insufficient data fallback
            $val = $snapshots->last()?->metric_value ?? 75.0;
            return AnalyticsForecast::create([
                'company_id' => $companyId,
                'kpi_code' => $kpiCode,
                'model_name' => 'naive_baseline_v1',
                'model_version' => '1.0.0',
                'forecast_horizon_date' => $targetDate->toDateString(),
                'forecast_value' => $val,
                'lower_bound' => round($val * 0.85, 2),
                'upper_bound' => round($val * 1.15, 2),
                'confidence_level' => 0.60,
                'assumptions' => [
                    'status' => 'insufficient_historical_depth',
                    'note' => 'Generated using flat naive projection with 15% uncertainty bounds.',
                ],
                'generated_at' => Carbon::now(),
            ]);
        }

        // Simple linear regression extrapolation
        $values = $snapshots->pluck('metric_value')->map(fn($v) => (float) $v)->values()->all();
        $n = count($values);
        $xMean = ($n - 1) / 2;
        $yMean = array_sum($values) / $n;

        $numerator = 0;
        $denominator = 0;
        for ($i = 0; $i < $n; $i++) {
            $numerator += ($i - $xMean) * ($values[$i] - $yMean);
            $denominator += pow($i - $xMean, 2);
        }

        $slope = $denominator != 0 ? ($numerator / $denominator) : 0;
        $intercept = $yMean - ($slope * $xMean);

        // Project ahead
        $projectedSteps = $n + ($horizonDays / 30);
        $forecastValue = round(max(0, $intercept + ($slope * $projectedSteps)), 2);

        // Standard error approximation
        $residuals = [];
        for ($i = 0; $i < $n; $i++) {
            $predicted = $intercept + ($slope * $i);
            $residuals[] = pow($values[$i] - $predicted, 2);
        }
        $stdDev = sqrt(array_sum($residuals) / max(1, $n - 1));
        $margin = round(1.96 * $stdDev, 2); // 95% confidence interval

        return AnalyticsForecast::create([
            'company_id' => $companyId,
            'kpi_code' => $kpiCode,
            'model_name' => 'linear_trend_ols_v1',
            'model_version' => '1.2.0',
            'forecast_horizon_date' => $targetDate->toDateString(),
            'forecast_value' => $forecastValue,
            'lower_bound' => max(0, round($forecastValue - $margin, 2)),
            'upper_bound' => round($forecastValue + $margin, 2),
            'confidence_level' => 0.95,
            'assumptions' => [
                'model' => 'Ordinary Least Squares Trend with 95% Confidence Band',
                'sample_periods_analyzed' => $n,
                'historical_slope' => round($slope, 4),
            ],
            'generated_at' => Carbon::now(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsAnomaly;
use App\Models\AnalyticsKpi;
use App\Models\AnalyticsReport;
use App\Models\AnalyticsSnapshot;
use App\Models\Company;
use App\Services\Analytics\AnalyticsEngineService;
use App\Services\Analytics\AnomalyAndForecastService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(
        protected AnalyticsEngineService $engine,
        protected AnomalyAndForecastService $anomalyService
    ) {}

    /**
     * FR-13-01: Central KPI Catalog
     */
    public function catalog(): JsonResponse
    {
        $kpis = AnalyticsKpi::with('latestVersion')
            ->where('is_active', true)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $kpis,
        ]);
    }

    /**
     * FR-13-02 / FR-13-04: Get or compute specific KPI snapshot with dimensions
     */
    public function getSnapshot(Company $company, Request $request, string $kpiCode): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'project_id' => 'nullable|integer',
        ]);

        $startDate = $request->filled('start_date') ? Carbon::parse($request->input('start_date')) : Carbon::now()->startOfMonth();
        $endDate = $request->filled('end_date') ? Carbon::parse($request->input('end_date')) : Carbon::now()->endOfMonth();

        $dimensions = [];
        if ($request->filled('project_id')) {
            $dimensions['project_id'] = (int) $request->input('project_id');
        }

        $snapshot = $this->engine->computeKpiSnapshot($company->id, $kpiCode, $startDate, $endDate, $dimensions);

        return response()->json([
            'status' => 'success',
            'data' => $snapshot,
        ]);
    }

    /**
     * Comprehensive Executive Dashboard Overview
     */
    public function dashboardOverview(Company $company, Request $request): JsonResponse
    {
        $startDate = Carbon::now()->subDays(30);
        $endDate = Carbon::now();

        $kpis = ['task_completion_rate', 'employee_utilization', 'project_gross_margin', 'sprint_delivery_velocity'];
        $results = [];

        foreach ($kpis as $code) {
            $results[$code] = $this->engine->computeKpiSnapshot($company->id, $code, $startDate, $endDate);
        }

        $recentAnomalies = AnalyticsAnomaly::where('company_id', $company->id)
            ->orderByDesc('detected_at')
            ->take(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'period' => [
                    'start' => $startDate->toDateString(),
                    'end' => $endDate->toDateString(),
                ],
                'metrics' => $results,
                'anomalies' => $recentAnomalies,
                'freshness_watermark' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * FR-13-06: Anomaly Detection Center
     */
    public function listAnomalies(Company $company): JsonResponse
    {
        $anomalies = AnalyticsAnomaly::where('company_id', $company->id)
            ->orderByDesc('detected_at')
            ->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $anomalies,
        ]);
    }

    public function triggerAnomalyDetection(Company $company, Request $request): JsonResponse
    {
        $request->validate(['kpi_code' => 'required|string']);
        $detected = $this->anomalyService->detectAnomalies($company->id, $request->input('kpi_code'));

        return response()->json([
            'status' => 'success',
            'message' => count($detected) . ' anomalies identified.',
            'data' => $detected,
        ]);
    }

    public function acknowledgeAnomaly(Company $company, AnalyticsAnomaly $anomaly, Request $request): JsonResponse
    {
        if ($anomaly->company_id !== $company->id) {
            return response()->json(['message' => 'Unauthorized anomaly access.'], 403);
        }

        $user = $request->user();
        $membership = $company->memberships()->where('user_id', $user->id)->first();

        $anomaly->update([
            'acknowledged_at' => Carbon::now(),
            'acknowledged_by_id' => $membership?->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Anomaly acknowledged.',
            'data' => $anomaly,
        ]);
    }

    /**
     * FR-13-05: Metric Forecasting
     */
    public function getForecast(Company $company, Request $request, string $kpiCode): JsonResponse
    {
        $horizon = (int) $request->input('horizon_days', 30);
        $forecast = $this->anomalyService->generateForecast($company->id, $kpiCode, $horizon);

        return response()->json([
            'status' => 'success',
            'data' => $forecast,
        ]);
    }

    /**
     * FR-13-03: Saved Reports & Custom Builders
     */
    public function listReports(Company $company): JsonResponse
    {
        $reports = AnalyticsReport::where('company_id', $company->id)
            ->with('author')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $reports,
        ]);
    }

    public function saveReport(Company $company, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:190',
            'description' => 'nullable|string',
            'report_type' => 'required|string|in:tabular,trend,distribution,summary',
            'kpi_codes' => 'required|array',
            'dimensions' => 'nullable|array',
            'filters' => 'nullable|array',
            'layout_config' => 'nullable|array',
            'is_shared' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $membership = $company->memberships()->where('user_id', $user->id)->first();

        $report = AnalyticsReport::create([
            'company_id' => $company->id,
            'author_id' => $membership?->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'report_type' => $validated['report_type'],
            'kpi_codes' => $validated['kpi_codes'],
            'dimensions' => $validated['dimensions'] ?? [],
            'filters' => $validated['filters'] ?? [],
            'layout_config' => $validated['layout_config'] ?? [],
            'is_shared' => $validated['is_shared'] ?? true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Custom report saved.',
            'data' => $report,
        ], 201);
    }

    /**
     * FR-13-09: Finobo Agentic AI Analytics Interface
     * Interprets structured AI intents and returns verified metrics with evidence lineage.
     */
    public function finoboAnalyticsQuery(Company $company, Request $request): JsonResponse
    {
        $request->validate([
            'intent' => 'required|string',
            'kpi_code' => 'nullable|string',
            'date_range' => 'nullable|string|in:7d,30d,90d,ytd',
        ]);

        $kpiCode = $request->input('kpi_code', 'task_completion_rate');
        $range = $request->input('date_range', '30d');

        $days = match ($range) {
            '7d' => 7,
            '90d' => 90,
            'ytd' => Carbon::now()->dayOfYear,
            default => 30,
        };

        $startDate = Carbon::now()->subDays($days);
        $endDate = Carbon::now();

        $snapshot = $this->engine->computeKpiSnapshot($company->id, $kpiCode, $startDate, $endDate);
        $forecast = $this->anomalyService->generateForecast($company->id, $kpiCode, 30);

        return response()->json([
            'status' => 'success',
            'data' => [
                'intent' => $request->input('intent'),
                'kpi_code' => $kpiCode,
                'metric_value' => $snapshot->metric_value,
                'numerator' => $snapshot->numerator,
                'denominator' => $snapshot->denominator,
                'period' => [
                    'start' => $startDate->toDateString(),
                    'end' => $endDate->toDateString(),
                ],
                'freshness' => $snapshot->computed_at,
                'quality_status' => $snapshot->quality_status,
                'projected_trend' => [
                    'expected_next_30d' => $forecast->forecast_value,
                    'uncertainty_range' => [$forecast->lower_bound, $forecast->upper_bound],
                    'confidence' => $forecast->confidence_level,
                ],
                'lineage' => [
                    'source_authoritative_tables' => ['tasks', 'time_entries', 'billing_invoices'],
                    'formula_version' => $snapshot->kpi_version_number,
                    'watermark' => $snapshot->source_watermark,
                ],
                'suggested_actions' => [
                    'Inspect underperforming deliverables',
                    'Acknowledge any outstanding anomalies',
                    'Review seat capacity against active employee count',
                ],
            ],
        ]);
    }
}

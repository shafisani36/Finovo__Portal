<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for M13 Reporting and Analytics.
     */
    public function up(): void
    {
        // 1. Central KPI Catalog
        Schema::create('analytics_kpis', function (Blueprint $table) {
            $table->id();
            $table->string('kpi_code')->unique(); // e.g. task_completion_rate, employee_utilization, project_margin, sprint_velocity
            $table->string('name');
            $table->string('domain')->default('operations'); // operations, workforce, finance, delivery, quality
            $table->text('description')->nullable();
            $table->string('owner_role')->default('manager');
            $table->string('unit')->default('percent'); // percent, currency, hours, count, ratio
            $table->json('supported_dimensions')->nullable(); // ["department", "project", "client", "assignee"]
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Versioned KPI Definitions (Preserves historical interpretability)
        Schema::create('analytics_kpi_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kpi_id')->constrained('analytics_kpis')->onDelete('cascade');
            $table->integer('version_number')->default(1);
            $table->string('calculation_method'); // formula, aggregation, composite
            $table->text('formula_expression'); // e.g. (completed_tasks / due_tasks) * 100
            $table->json('inclusion_criteria')->nullable();
            $table->json('exclusion_criteria')->nullable();
            $table->string('required_permission')->default('analytics.view');
            $table->timestamp('effective_from')->useCurrent();
            $table->timestamp('effective_to')->nullable();
            $table->timestamps();

            $table->unique(['kpi_id', 'version_number']);
        });

        // 3. Saved Reports & Builder Definitions
        Schema::create('analytics_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('created_by_membership_id')->nullable()->constrained('company_memberships')->onDelete('set null');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('selected_kpis'); // array of kpi_codes
            $table->json('dimensions'); // grouping fields
            $table->json('filters'); // date range, department_ids, project_ids
            $table->string('chart_type')->default('line'); // line, bar, table, donut, area
            $table->boolean('is_shared')->default(false);
            $table->timestamps();

            $table->index(['company_id', 'is_shared']);
        });

        // 4. Scheduled Reporting Delivery
        Schema::create('analytics_report_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('analytics_reports')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('cron_expression')->default('0 9 * * 1'); // e.g. every Monday at 9AM
            $table->string('format')->default('pdf'); // pdf, csv, json
            $table->json('recipients'); // email addresses or membership IDs
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->string('last_run_status')->nullable();
            $table->timestamps();
        });

        // 5. Precomputed Metric Snapshots (Reusable, fast, tenant-isolated)
        Schema::create('analytics_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('kpi_code')->index();
            $table->integer('kpi_version_number')->default(1);
            $table->string('time_bucket')->index(); // day, week, month, quarter, year
            $table->date('period_start');
            $table->date('period_end');
            $table->json('dimension_values')->nullable(); // e.g. {"department_id": 2}
            $table->decimal('metric_value', 16, 4);
            $table->decimal('numerator', 16, 4)->nullable();
            $table->decimal('denominator', 16, 4)->nullable();
            $table->string('source_watermark')->nullable(); // Hash or timestamp of underlying data
            $table->string('quality_status')->default('valid'); // valid, incomplete, stale
            $table->timestamp('computed_at')->useCurrent();
            $table->timestamps();

            $table->index(['company_id', 'kpi_code', 'period_start', 'period_end'], 'comp_kpi_period_idx');
        });

        // 6. Anomaly Detection Records
        Schema::create('analytics_anomalies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('kpi_code')->index();
            $table->decimal('baseline_value', 16, 4);
            $table->decimal('observed_value', 16, 4);
            $table->decimal('deviation_percent', 8, 2);
            $table->string('severity')->default('medium'); // low, medium, high, critical
            $table->text('explanation_summary')->nullable();
            $table->json('evidence_context')->nullable();
            $table->timestamp('detected_at')->useCurrent();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('acknowledged_by_id')->nullable()->constrained('company_memberships')->onDelete('set null');
            $table->timestamps();

            $table->index(['company_id', 'severity', 'detected_at']);
        });

        // 7. Metric Forecasts with Uncertainty Intervals
        Schema::create('analytics_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('kpi_code')->index();
            $table->string('model_name')->default('seasonal_moving_average');
            $table->string('model_version')->default('1.0');
            $table->date('forecast_horizon_date');
            $table->decimal('forecast_value', 16, 4);
            $table->decimal('lower_bound', 16, 4);
            $table->decimal('upper_bound', 16, 4);
            $table->decimal('confidence_level', 5, 2)->default(95.00); // 95%
            $table->json('assumptions')->nullable();
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();

            $table->index(['company_id', 'kpi_code', 'forecast_horizon_date'], 'comp_kpi_forecast_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_forecasts');
        Schema::dropIfExists('analytics_anomalies');
        Schema::dropIfExists('analytics_snapshots');
        Schema::dropIfExists('analytics_report_schedules');
        Schema::dropIfExists('analytics_reports');
        Schema::dropIfExists('analytics_kpi_versions');
        Schema::dropIfExists('analytics_kpis');
    }
};

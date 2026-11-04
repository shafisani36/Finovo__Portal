<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\CompetencyFramework;
use App\Models\EmployeeDevelopmentPlan;
use App\Models\EmployeeFeedback;
use App\Models\EmployeeGoal;
use App\Models\EmploymentRecord;
use App\Models\OnboardingChecklist;
use App\Models\PerformanceAppeal;
use App\Models\PerformanceReview;
use App\Models\PerformanceReviewCycle;
use App\Models\ReviewEvidenceLink;
use App\Models\ReviewTemplate;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerformanceManagementM11Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanySetup(): array
    {
        $uid = uniqid();
        $hrAdmin = User::factory()->create(['name' => 'Helen HR', 'email' => "helen.{$uid}@finovo.com"]);
        $manager = User::factory()->create(['name' => 'Mark Manager', 'email' => "mark.{$uid}@finovo.com"]);
        $engineer = User::factory()->create(['name' => 'Evan Engineer', 'email' => "evan.{$uid}@finovo.com"]);

        $company = Company::create([
            'name' => 'Finovo Global HR Tech',
            'slug' => 'finovo-hr-' . $uid,
            'status' => 'active',
            'timezone' => 'UTC',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();

        $hrMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $hrAdmin->id,
            'status' => 'active',
        ]);
        $hrMembership->roles()->sync([$ownerRole->id]);

        $managerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $manager->id,
            'status' => 'active',
        ]);
        $managerMembership->roles()->sync([$ownerRole->id]);

        $engineerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $engineer->id,
            'status' => 'active',
        ]);
        $engineerMembership->roles()->sync([$ownerRole->id]);

        // M03 Employment Records
        $managerEmp = EmploymentRecord::create([
            'company_id' => $company->id,
            'membership_id' => $managerMembership->id,
            'employee_number' => 'EMP-MGR-' . rand(100, 999),
            'status' => 'active',
            'hire_date' => Carbon::now()->subMonths(12),
        ]);

        $engineerEmp = EmploymentRecord::create([
            'company_id' => $company->id,
            'membership_id' => $engineerMembership->id,
            'employee_number' => 'EMP-ENG-' . rand(100, 999),
            'status' => 'active',
            'hire_date' => Carbon::now()->subMonths(6),
            'manager_membership_id' => $managerMembership->id,
        ]);

        return compact('company', 'hrAdmin', 'manager', 'engineer', 'managerEmp', 'engineerEmp');
    }

    public function test_can_create_review_cycle_and_auto_assign_employees(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Create Review Template
        $templateResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/templates", [
                'title' => 'Software Engineering Q4 Review Rubric',
                'role_type' => 'engineering',
            ]);

        $templateResponse->assertStatus(201);
        $templateId = $templateResponse->json('data.id');

        // 2. Create Review Cycle
        $cycleResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/cycles", [
                'title' => '2026 Q4 Engineering Growth Cycle',
                'cycle_type' => 'quarterly',
                'description' => 'Comprehensive performance & skill calibration cycle',
                'start_date' => '2026-10-01',
                'end_date' => '2026-12-31',
                'template_id' => $templateId,
            ]);

        $cycleResponse->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $cycleId = $cycleResponse->json('data.id');

        // Verify active employees were automatically assigned
        $this->assertDatabaseHas('performance_reviews', [
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycleId,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'self_review',
        ]);
    }

    public function test_employee_can_submit_self_review_and_calculate_quality_flags(): void
    {
        $setup = $this->createCompanySetup();

        $cycle = PerformanceReviewCycle::create([
            'company_id' => $setup['company']->id,
            'title' => '2026 Growth Cycle',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'status' => 'active',
        ]);

        $review = PerformanceReview::create([
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycle->id,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'self_review',
        ]);

        $response = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/self-review", [
                'self_rating' => 4.5,
                'self_summary' => 'Delivered the M10 collaboration architecture and achieved 100% test coverage.',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'manager_review')
            ->assertJsonPath('data.self_rating', '4.50');

        $this->assertGreaterThan(0, $response->json('data.quality_score'));
    }

    public function test_manager_can_submit_assessment_and_advance_to_calibration(): void
    {
        $setup = $this->createCompanySetup();

        $cycle = PerformanceReviewCycle::create([
            'company_id' => $setup['company']->id,
            'title' => '2026 Annual Cycle',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'status' => 'active',
        ]);

        $review = PerformanceReview::create([
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycle->id,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'manager_review',
            'self_rating' => 4.0,
            'self_summary' => 'Consistently met sprint deliverables and contributed to team architecture reviews.',
        ]);

        $response = $this->actingAs($setup['manager'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/manager-review", [
                'manager_rating' => 4.2,
                'manager_summary' => 'Outstanding delivery track record across client-facing microservices and modules.',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'calibration')
            ->assertJsonPath('data.manager_rating', '4.20');
    }

    public function test_can_link_evidence_to_performance_passport(): void
    {
        $setup = $this->createCompanySetup();

        $cycle = PerformanceReviewCycle::create([
            'company_id' => $setup['company']->id,
            'title' => '2026 Passport Cycle',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'status' => 'active',
        ]);

        $review = PerformanceReview::create([
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycle->id,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'self_review',
        ]);

        $response = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/evidence", [
                'evidence_type' => 'task',
                'source_id' => 101,
                'title' => 'PRJ-M09 Multi-Tenant Isolation Delivery Task',
                'description' => 'Successfully passed 83 tenant barrier unit tests with 0 leaks.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'PRJ-M09 Multi-Tenant Isolation Delivery Task');

        $this->assertDatabaseHas('review_evidence_links', [
            'company_id' => $setup['company']->id,
            'review_id' => $review->id,
            'evidence_type' => 'task',
        ]);
    }

    public function test_hr_can_calibrate_rating_and_finalize_and_release(): void
    {
        $setup = $this->createCompanySetup();

        $cycle = PerformanceReviewCycle::create([
            'company_id' => $setup['company']->id,
            'title' => '2026 Calibration Cycle',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'status' => 'calibration',
        ]);

        $review = PerformanceReview::create([
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycle->id,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'calibration',
            'manager_rating' => 4.5,
        ]);

        // Calibrate
        $calibrateResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/calibrate", [
                'calibrated_rating' => 4.6,
                'calibration_notes' => 'Aligned with engineering department distribution curves.',
            ]);

        $calibrateResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'ready_for_release')
            ->assertJsonPath('data.calibrated_rating', '4.60');

        // Finalize & Release
        $finalizeResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/finalize");

        $finalizeResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'released')
            ->assertJsonPath('data.final_rating', '4.60');
    }

    public function test_employee_can_acknowledge_receipt_and_submit_appeal(): void
    {
        $setup = $this->createCompanySetup();

        $cycle = PerformanceReviewCycle::create([
            'company_id' => $setup['company']->id,
            'title' => '2026 Appeal Cycle',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'status' => 'active',
        ]);

        $review = PerformanceReview::create([
            'company_id' => $setup['company']->id,
            'cycle_id' => $cycle->id,
            'employee_id' => $setup['engineerEmp']->id,
            'reviewer_id' => $setup['managerEmp']->id,
            'status' => 'released',
            'final_rating' => 3.5,
        ]);

        // 1. Acknowledge
        $ackResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/acknowledge", [
                'comment' => 'Received review document.',
            ]);

        $ackResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'acknowledged');

        // 2. Submit Appeal
        $appealResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/appeals", [
                'reason' => 'Quarter 3 architecture lead delivery was omitted from the assessment rubric calculations.',
            ]);

        $appealResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'pending');

        $appealId = $appealResponse->json('data.id');

        // 3. Resolve Appeal (HR)
        $resolveResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/reviews/{$review->id}/appeals/{$appealId}/resolve", [
                'status' => 'upheld',
                'reviewer_notes' => 'Independent audit confirmed M05 deliverables were excluded in error. Amending score.',
                'amended_rating' => 4.2,
            ]);

        $resolveResponse->assertStatus(200)
            ->assertJsonPath('data.appeal.status', 'upheld')
            ->assertJsonPath('data.review.status', 'amended')
            ->assertJsonPath('data.review.final_rating', '4.20');
    }

    public function test_goals_creation_and_progress_calculation(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Percentage goal
        $goal1 = EmployeeGoal::create([
            'company_id' => $setup['company']->id,
            'employee_id' => $setup['engineerEmp']->id,
            'title' => 'Increase Code Coverage to 90%',
            'measurement_type' => 'percentage',
            'baseline_value' => 0,
            'target_value' => 100,
            'current_value' => 75,
            'weight' => 20,
        ]);
        $this->assertEquals(75.0, $goal1->calculated_progress);

        // 2. Numeric goal (e.g. resolve 40 bugs from baseline 10)
        $goal2 = EmployeeGoal::create([
            'company_id' => $setup['company']->id,
            'employee_id' => $setup['engineerEmp']->id,
            'title' => 'Close 50 Performance Tickets',
            'measurement_type' => 'numeric',
            'baseline_value' => 10,
            'target_value' => 50,
            'current_value' => 30, // (30-10)/(50-10) * 100 = 50%
            'weight' => 20,
        ]);
        $this->assertEquals(50.0, $goal2->calculated_progress);

        // Update progress via API
        $updateResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->patchJson("/api/v1/companies/{$setup['company']->id}/hr/goals/{$goal2->id}/progress", [
                'current_value' => 50,
            ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.calculated_progress', 100);
    }

    public function test_competency_framework_and_skill_gap_engine(): void
    {
        $setup = $this->createCompanySetup();

        // Create framework
        $framework = CompetencyFramework::create([
            'company_id' => $setup['company']->id,
            'name' => 'Backend Engineering Framework',
            'role_target' => 'Senior Backend Engineer',
            'competencies' => [
                ['name' => 'System Design', 'target_level' => 4, 'observable_criteria' => 'Designs high-concurrency event buses'],
                ['name' => 'Database Optimization', 'target_level' => 4, 'observable_criteria' => 'Optimizes queries & indexes for MySQL/InnoDB'],
            ],
        ]);

        // Evaluate skill gaps
        $evalResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/skill-gaps/evaluate", [
                'employee_id' => $setup['engineerEmp']->id,
                'framework_id' => $framework->id,
            ]);

        $evalResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(2, 'data.analysis');

        // Record verified assessment
        $recordResponse = $this->actingAs($setup['manager'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/competency-assessments", [
                'employee_id' => $setup['engineerEmp']->id,
                'framework_id' => $framework->id,
                'competency_name' => 'System Design',
                'current_level' => 4,
                'target_level' => 4,
                'evidence_notes' => 'Led M10 messaging architectural review.',
            ]);

        $recordResponse->assertStatus(200)
            ->assertJsonPath('data.gap_score', 0);
    }

    public function test_development_plans_and_structured_feedback(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Development plan with mentorship
        $planResponse = $this->actingAs($setup['manager'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/development-plans", [
                'employee_id' => $setup['engineerEmp']->id,
                'title' => 'Kubernetes & Distributed Cache Mastery',
                'target_competency' => 'System Design',
                'learning_action' => 'Complete internal distributed architecture workshop and pair with principal architect',
                'mentor_user_id' => $setup['manager']->id,
                'due_date' => Carbon::now()->addMonths(3)->toDateString(),
            ]);

        $planResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'active');

        $planId = $planResponse->json('data.id');

        // Complete development plan
        $completeResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/development-plans/{$planId}/complete", [
                'outcome_reflection' => 'Completed Redis caching module and demonstrated 50% response latency reduction.',
            ]);

        $completeResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        // 2. Structured feedback & badge
        $feedbackResponse = $this->actingAs($setup['manager'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/feedbacks", [
                'employee_id' => $setup['engineerEmp']->id,
                'feedback_type' => 'recognition',
                'badge' => 'Architectural Innovator',
                'content' => 'Exceptional initiative in optimizing database query throughput during peak hours.',
            ]);

        $feedbackResponse->assertStatus(201)
            ->assertJsonPath('data.badge', 'Architectural Innovator');
    }

    public function test_onboarding_checklist_and_export_security(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Create onboarding checklist
        $checklistResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->postJson("/api/v1/companies/{$setup['company']->id}/hr/checklists", [
                'employee_id' => $setup['engineerEmp']->id,
                'template_name' => 'Senior Engineer 30-Day Onboarding',
            ]);

        $checklistResponse->assertStatus(201);
        $checklistId = $checklistResponse->json('data.id');

        // Toggle item
        $toggleResponse = $this->actingAs($setup['engineer'], 'sanctum')
            ->patchJson("/api/v1/companies/{$setup['company']->id}/hr/checklists/{$checklistId}/toggle-item", [
                'item_id' => 1,
                'completed' => true,
            ]);

        $toggleResponse->assertStatus(200)
            ->assertJsonPath('data.progress_percent', 20);

        // 2. Export performance CSV
        $exportResponse = $this->actingAs($setup['hrAdmin'], 'sanctum')
            ->get("/api/v1/companies/{$setup['company']->id}/hr/export");

        $exportResponse->assertStatus(200);
        $this->assertStringContainsString('text/csv', $exportResponse->headers->get('Content-Type'));
    }
}

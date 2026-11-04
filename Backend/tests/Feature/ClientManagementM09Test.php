<?php

namespace Tests\Feature;

use App\Models\ClientContact;
use App\Models\ClientContract;
use App\Models\ClientDecision;
use App\Models\ClientDeliverableReview;
use App\Models\ClientInvitation;
use App\Models\ClientMembership;
use App\Models\ClientOrganization;
use App\Models\ClientProjectEngagement;
use App\Models\ClientRequest;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Project;
use App\Models\ProjectDeliverable;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientManagementM09Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleAndPermissionSeeder::class);
    }

    private function createCompanySetup(): array
    {
        $owner = User::factory()->create(['name' => 'Agency Alice', 'email' => 'alice@finovo.com']);
        $pm = User::factory()->create(['name' => 'PM Charlie', 'email' => 'charlie@finovo.com']);
        $clientUser = User::factory()->create(['name' => 'Client David', 'email' => 'david@clientcorp.com']);

        $company = Company::create([
            'name' => 'Finovo Global Agency Workspace',
            'slug' => 'finovo-agency-' . uniqid(),
            'status' => 'active',
            'timezone' => 'UTC',
        ]);

        $ownerRole = Role::where('slug', 'company-owner')->first();
        $pmRole = Role::where('slug', 'project-manager')->first();

        // Owner membership
        $ownerMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $owner->id,
            'status' => 'active',
        ]);
        $ownerMembership->roles()->sync([$ownerRole->id]);

        // PM membership
        $pmMembership = CompanyMembership::create([
            'company_id' => $company->id,
            'user_id' => $pm->id,
            'status' => 'active',
        ]);
        $pmMembership->roles()->sync([$pmRole->id]);

        // M04 Project
        $project = Project::create([
            'company_id' => $company->id,
            'project_code' => 'PRJ-ACME',
            'name' => 'Acme E-Commerce Platform',
            'status' => 'active',
            'health_status' => 'healthy',
            'manager_membership_id' => $pmMembership->id,
        ]);

        // M04 Deliverable
        $deliverable = ProjectDeliverable::create([
            'company_id' => $company->id,
            'project_id' => $project->id,
            'name' => 'Sprint 1 Payment Gateway Architecture',
            'acceptance_status' => 'pending',
        ]);

        return [
            'company' => $company,
            'owner' => $owner,
            'pm' => $pm,
            'clientUser' => $clientUser,
            'ownerMembership' => $ownerMembership,
            'pmMembership' => $pmMembership,
            'project' => $project,
            'deliverable' => $deliverable,
        ];
    }

    public function test_client_organization_creation_and_duplicate_detection(): void
    {
        $setup = $this->createCompanySetup();

        // 1. Create client organization
        $resp1 = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients", [
                'name' => 'Acme Global Corporation',
                'industry' => 'FinTech',
                'country' => 'United States',
                'billing_address' => '100 Wall Street, New York, NY',
            ]);

        $resp1->assertStatus(201)
            ->assertJsonPath('client.reference_code', 'CLT-001')
            ->assertJsonPath('client.name', 'Acme Global Corporation');

        $this->assertDatabaseHas('client_organizations', [
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-001',
            'name' => 'Acme Global Corporation',
        ]);

        // 2. Duplicate organization detection (Alg 7.1)
        $dupResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients", [
                'name' => 'acme global corporation  ',
            ]);

        $dupResp->assertStatus(409)
            ->assertJsonPath('duplicate_found', true);
    }

    public function test_contact_creation_and_primary_designation(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-002',
            'name' => 'Apex Logistics',
            'status' => 'active',
        ]);

        // 1. Add primary contact
        $resp1 = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/contacts", [
                'name' => 'Sarah Connor',
                'email' => 'sarah@apex.com',
                'contact_role' => 'primary',
                'is_primary' => true,
            ]);

        $resp1->assertStatus(201)
            ->assertJsonPath('contact.is_primary', true);

        // 2. Add second contact with is_primary = true (must switch primary)
        $resp2 = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/contacts", [
                'name' => 'John Connor',
                'email' => 'john@apex.com',
                'contact_role' => 'billing',
                'is_primary' => true,
            ]);

        $resp2->assertStatus(201)
            ->assertJsonPath('contact.is_primary', true);

        // Check Sarah is no longer primary
        $sarah = ClientContact::where('email', 'sarah@apex.com')->first();
        $this->assertFalse($sarah->is_primary);
    }

    public function test_client_portal_invitation_lifecycle_and_acceptance(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-003',
            'name' => 'Cyberdyne Systems',
            'status' => 'active',
        ]);

        // 1. Internal PM issues portal invitation
        $inviteResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/invitations", [
                'email' => 'david@clientcorp.com',
                'portal_role' => 'reviewer',
            ]);

        $inviteResp->assertStatus(201)
            ->assertJsonPath('invitation.portal_role', 'reviewer');

        $token = $inviteResp->json('invitation_token');

        // 2. Client user accepts invitation (M01 Authenticated)
        $acceptResp = $this->actingAs($setup['clientUser'])
            ->postJson('/api/v1/client-portal/invitations/accept', [
                'token' => $token,
            ]);

        $acceptResp->assertStatus(200)
            ->assertJsonPath('membership.status', 'active');

        $this->assertDatabaseHas('client_memberships', [
            'client_organization_id' => $client->id,
            'user_id' => $setup['clientUser']->id,
            'portal_role' => 'reviewer',
            'status' => 'active',
        ]);

        // 3. Duplicate token acceptance must be rejected
        $repeatAccept = $this->actingAs($setup['clientUser'])
            ->postJson('/api/v1/client-portal/invitations/accept', [
                'token' => $token,
            ]);

        $repeatAccept->assertStatus(404);
    }

    public function test_project_association_and_access_boundary_simulator(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-004',
            'name' => 'Stark Industries',
            'status' => 'active',
        ]);

        // 1. Associate M04 project with client organization
        $assocResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/projects", [
                'project_id' => $setup['project']->id,
                'client_project_name' => 'Jarvis UI Overhaul',
                'visibility_mode' => 'standard',
                'show_milestones' => true,
                'show_deliverables' => true,
                'show_financials' => false,
            ]);

        $assocResp->assertStatus(201)
            ->assertJsonPath('engagement.client_project_name', 'Jarvis UI Overhaul');

        // 2. Preview Client Access Boundary Simulator (Feature 4)
        $simResp = $this->actingAs($setup['pm'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/access-simulation");

        $simResp->assertStatus(200)
            ->assertJsonPath('simulation.visible_projects.0.client_project_name', 'Jarvis UI Overhaul')
            ->assertJsonPath('simulation.visible_projects.0.financial_visibility', 'Strictly Hidden')
            ->assertJsonPath('simulation.visible_projects.0.internal_safeguards.m08_desktop_monitoring_visible', false);
    }

    public function test_version_locked_deliverable_submission_and_client_approval(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-005',
            'name' => 'Wayne Enterprises',
            'status' => 'active',
        ]);

        // Client portal membership for David
        ClientMembership::create([
            'company_id' => $setup['company']->id,
            'client_organization_id' => $client->id,
            'user_id' => $setup['clientUser']->id,
            'portal_role' => 'reviewer',
            'status' => 'active',
        ]);

        // 1. Internal team submits deliverable version for review (Feature 2)
        $subResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/deliverables", [
                'project_id' => $setup['project']->id,
                'project_deliverable_id' => $setup['deliverable']->id,
                'version_label' => 'v1.0-RC1',
                'title' => 'Payment Gateway Integration Blueprint',
                'file_url' => 'https://storage.finovo.com/deliverables/blueprint-v1.pdf',
            ]);

        $subResp->assertStatus(201)
            ->assertJsonPath('deliverable_review.version_label', 'v1.0-RC1')
            ->assertJsonPath('deliverable_review.review_status', 'submitted');

        $reviewId = $subResp->json('deliverable_review.id');

        // 2. Client reviews and records immutable approval through portal
        $appResp = $this->actingAs($setup['clientUser'])
            ->postJson("/api/v1/client-portal/{$client->id}/deliverables/{$reviewId}/decision", [
                'decision' => 'approved',
                'comment' => 'Architectural approach approved for implementation.',
            ]);

        $appResp->assertStatus(200)
            ->assertJsonPath('deliverable_review.review_status', 'approved')
            ->assertJsonPath('deliverable_review.decision_by.name', 'Client David');

        // 3. Repeated decision on already concluded review must fail
        $repeatResp = $this->actingAs($setup['clientUser'])
            ->postJson("/api/v1/client-portal/{$client->id}/deliverables/{$reviewId}/decision", [
                'decision' => 'changes_requested',
            ]);

        $repeatResp->assertStatus(422);
    }

    public function test_client_decision_ledger_creation_and_response(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-006',
            'name' => 'Umbrella Health',
            'status' => 'active',
        ]);

        ClientMembership::create([
            'company_id' => $setup['company']->id,
            'client_organization_id' => $client->id,
            'user_id' => $setup['clientUser']->id,
            'portal_role' => 'reviewer',
            'status' => 'active',
        ]);

        // 1. Create Decision Ledger request (Feature 1)
        $decResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/decisions", [
                'project_id' => $setup['project']->id,
                'title' => 'Select Primary Auth Provider: Auth0 vs Cognito',
                'context_description' => 'Need architectural confirmation before sprint 2 begins.',
                'due_date' => Carbon::now('UTC')->addDays(3)->toDateString(),
                'impact_summary' => 'Delays past Friday will shift auth milestone by 1 week.',
            ]);

        $decResp->assertStatus(201)
            ->assertJsonPath('decision.status', 'requested');

        $decisionId = $decResp->json('decision.id');

        // 2. Client responds to decision in portal
        $respResp = $this->actingAs($setup['clientUser'])
            ->postJson("/api/v1/client-portal/{$client->id}/decisions/{$decisionId}/respond", [
                'outcome_decision' => 'approved',
                'outcome_rationale' => 'Approved Auth0 due to existing enterprise SSO license.',
            ]);

        $respResp->assertStatus(200)
            ->assertJsonPath('decision.status', 'answered')
            ->assertJsonPath('decision.outcome_decision', 'approved');
    }

    public function test_client_request_submission_and_task_conversion(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-007',
            'name' => 'Initech Corp',
            'status' => 'active',
        ]);

        // Link project
        ClientProjectEngagement::create([
            'company_id' => $setup['company']->id,
            'client_organization_id' => $client->id,
            'project_id' => $setup['project']->id,
            'status' => 'active',
        ]);

        ClientMembership::create([
            'company_id' => $setup['company']->id,
            'client_organization_id' => $client->id,
            'user_id' => $setup['clientUser']->id,
            'portal_role' => 'admin',
            'status' => 'active',
        ]);

        // 1. Client submits change request in portal
        $reqResp = $this->actingAs($setup['clientUser'])
            ->postJson("/api/v1/client-portal/{$client->id}/requests", [
                'project_id' => $setup['project']->id,
                'category' => 'change_request',
                'title' => 'Add Apple Pay and Google Pay Checkout',
                'description' => 'Need one-click mobile checkout integration for upcoming holiday campaign.',
                'priority' => 'high',
            ]);

        $reqResp->assertStatus(201)
            ->assertJsonPath('request.client_status', 'submitted');

        $requestId = $reqResp->json('request.id');

        // 2. Internal PM triages and converts to M05 Task (Feature 6)
        $triageResp = $this->actingAs($setup['pm'])
            ->postJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/requests/{$requestId}/triage", [
                'action' => 'convert_to_task',
                'estimated_cost_hours' => 32,
                'estimated_budget_amount' => 4800,
                'convert_task_title' => 'Implement Apple Pay & Google Pay in Checkout',
            ]);

        $triageResp->assertStatus(200)
            ->assertJsonPath('request.internal_status', 'converted_to_task')
            ->assertJsonPath('request.client_status', 'in_progress');

        $this->assertDatabaseHas('tasks', [
            'project_id' => $setup['project']->id,
            'title' => 'Implement Apple Pay & Google Pay in Checkout',
            'visibility' => 'client_visible',
        ]);
    }

    public function test_explainable_client_health_indicators(): void
    {
        $setup = $this->createCompanySetup();

        $client = ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-008',
            'name' => 'Massive Dynamic',
            'status' => 'active',
        ]);

        // Create overdue decision
        ClientDecision::create([
            'company_id' => $setup['company']->id,
            'client_organization_id' => $client->id,
            'project_id' => $setup['project']->id,
            'decision_code' => 'DEC-9999',
            'title' => 'Overdue Scope Signoff',
            'context_description' => 'Scope decision deadline was yesterday.',
            'due_date' => Carbon::yesterday(),
            'status' => 'requested',
        ]);

        // Check health indicators (Feature 3)
        $healthResp = $this->actingAs($setup['pm'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/clients/{$client->id}/health");

        $healthResp->assertStatus(200)
            ->assertJsonPath('health_status', 'critical')
            ->assertJsonPath('summary.overdue_decisions_count', 1);
    }

    public function test_client_csv_export(): void
    {
        $setup = $this->createCompanySetup();

        ClientOrganization::create([
            'company_id' => $setup['company']->id,
            'reference_code' => 'CLT-009',
            'name' => 'Hooli Corp',
            'status' => 'active',
        ]);

        $resp = $this->actingAs($setup['owner'])
            ->get("/api/v1/companies/{$setup['company']->id}/clients/export");

        $resp->assertStatus(200);
        $this->assertStringContainsString('text/csv', $resp->headers->get('content-type'));
    }

    public function test_tenant_isolation_protects_clients(): void
    {
        $setup = $this->createCompanySetup();

        // Create another tenant
        $company2 = Company::create([
            'name' => 'Competitor Agency',
            'slug' => 'competitor-' . uniqid(),
            'status' => 'active',
        ]);

        $client2 = ClientOrganization::create([
            'company_id' => $company2->id,
            'reference_code' => 'CLT-COMP-01',
            'name' => 'Secret Customer of Competitor',
            'status' => 'active',
        ]);

        // PM from Company 1 attempts to access Client from Company 2 -> MUST BE DENIED
        $resp = $this->actingAs($setup['pm'])
            ->getJson("/api/v1/companies/{$setup['company']->id}/clients/{$client2->id}");

        $resp->assertStatus(404);
    }
}

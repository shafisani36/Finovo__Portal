<?php

use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\CompanySettingsController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DesignationController;
use App\Http\Controllers\Api\EmployeeLifecycleController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\MfaController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\TimeTrackingController;
use App\Http\Controllers\Api\MonitoringController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientPortalController;
use App\Http\Controllers\Api\CollaborationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PerformanceReviewController;
use App\Http\Controllers\Api\EmployeeDevelopmentController;
use App\Http\Controllers\Api\FinanceDashboardController;
use App\Http\Controllers\Api\ProjectFinanceController;
use App\Http\Controllers\Api\BillingInvoiceController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\FinancialCloseController;
use App\Http\Controllers\Api\SubscriptionBillingController;
use App\Http\Controllers\Api\BillingWebhookController;
use App\Http\Controllers\Api\IntegrationController;
use App\Http\Controllers\Api\PlatformAdminController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\FileManagementController;
use App\Http\Controllers\Api\ScreenshotController;
use App\Http\Controllers\Api\DashboardController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Public Authentication & Onboarding
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:15,1');
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
        Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
        Route::post('/mfa/challenge', [MfaController::class, 'challenge'])->middleware('throttle:10,1');
        Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->middleware(['signed', 'throttle:10,1'])
            ->name('verification.verify');
    });

    // Public Invitation Inspection
    Route::get('/invitations/{token}', [InvitationController::class, 'show']);

    // M14 & M15: Public Provider Webhooks (Signature verified in controllers)
    Route::prefix('webhooks')->group(function () {
        Route::post('/billing/{provider}', [BillingWebhookController::class, 'handleProviderWebhook'])
            ->middleware('throttle:60,1');
        Route::post('/integrations/{connectorKey}', [IntegrationController::class, 'handleInboundWebhook'])
            ->middleware('throttle:60,1');
    });

    // Protected Routes (Sanctum SPA / Bearer Token)
    Route::middleware('auth:sanctum')->group(function () {

        // User & Session Context
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/me/companies', [CompanyController::class, 'index']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);

        // Multi-Factor Authentication Management
        Route::prefix('auth/mfa')->group(function () {
            Route::post('/enroll', [MfaController::class, 'enroll']);
            Route::post('/confirm', [MfaController::class, 'confirm']);
            Route::post('/disable', [MfaController::class, 'disable']);
        });

        // Workspace Provisioning & Listing
        Route::get('/companies', [CompanyController::class, 'index']);
        Route::post('/companies', [CompanyController::class, 'store']);
        Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);

        // =========================================================================
        // M01: ORGANIZATION & TENANT MANAGEMENT (Blueprint v1.0)
        // =========================================================================
        Route::prefix('organizations')->group(function () {
            Route::post('/', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'store']);
            Route::get('/current', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'current']);
            Route::patch('/current', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'update']);
            Route::get('/current/settings', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'settings']);
            Route::patch('/current/settings', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'updateSettings']);
            Route::get('/current/entitlements', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'entitlements']);
            Route::post('/current/suspension-requests', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'suspend']);
            Route::post('/current/data-exports', [\App\Domain\Organization\Http\Controllers\OrganizationController::class, 'export']);
        });

        // =========================================================================
        // M03: ROLES, PERMISSIONS & ACCESS CONTROL (Blueprint v1.0)
        // =========================================================================
        Route::prefix('access')->group(function () {
            Route::get('/catalog', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'catalog']);
            Route::get('/roles', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'indexRoles']);
            Route::post('/roles', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'storeRole']);
            Route::get('/roles/{id}', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'showRole']);
            Route::put('/roles/{id}/permissions', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'syncPermissions']);
            Route::delete('/roles/{id}', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'destroyRole']);
            Route::post('/role-assignments', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'assignRole']);
            Route::delete('/role-assignments/{id}', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'revokeRoleAssignment']);
            Route::get('/grants', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'listGrants']);
            Route::post('/grants', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'grantTemporaryAccess']);
            Route::post('/grants/{id}/revoke', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'revokeTemporaryAccess']);
            Route::post('/preview', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'previewAccess']);
        });
        Route::get('/permissions/catalog', [\App\Domain\Access\Http\Controllers\AccessControlController::class, 'catalog']);

        // =========================================================================
        // M02: DEPARTMENT & ORGANIZATIONAL STRUCTURE (Blueprint v1.0)
        // =========================================================================
        Route::get('/organization-chart', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'chart']);
        Route::prefix('structure')->group(function () {
            Route::get('/chart', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'chart']);
            Route::post('/departments', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'createDepartment']);
            Route::post('/departments/{id}/reorganization-preview', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'previewReorganization']);
            Route::post('/departments/{id}/reorganize', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'reorganizeDepartment']);
            Route::get('/locations', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'listLocations']);
            Route::post('/locations', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'createLocation']);
            Route::get('/cost-centers', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'listCostCenters']);
            Route::post('/cost-centers', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'createCostCenter']);
            Route::get('/job-positions', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'listPositions']);
            Route::post('/job-positions', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'createPosition']);
            Route::post('/reporting-relationships', [\App\Domain\Structure\Http\Controllers\OrgStructureController::class, 'assignReportingManager']);
        });

        // =========================================================================
        // M04: EMPLOYEE & WORKFORCE SYSTEM OF RECORD (Blueprint v1.0)
        // =========================================================================
        Route::prefix('workforce')->group(function () {
            Route::get('/employees', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'index']);
            Route::post('/employees', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'store']);
            Route::get('/employees/{id}', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'show']);
            Route::post('/employees/{id}/transfer', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'transfer']);
            Route::put('/employees/{id}/personal-details', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'updatePersonalDetails']);
            Route::post('/employees/{id}/certifications', [\App\Domain\Employee\Http\Controllers\EmployeeRecordController::class, 'addCertification']);
        });

        // =========================================================================
        // M05: RECRUITMENT & APPLICANT TRACKING (Blueprint v1.0)
        // =========================================================================
        Route::prefix('recruitment')->group(function () {
            Route::get('/requisitions', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'indexRequisitions']);
            Route::post('/requisitions', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'storeRequisition']);
            Route::post('/requisitions/{id}/approve', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'approveRequisition']);
            Route::get('/applications', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'indexApplications']);
            Route::post('/applications/{id}/stage', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'advanceStage']);
            Route::post('/applications/{id}/scorecard', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'submitScorecard']);
            Route::post('/applications/{id}/convert', [\App\Domain\Recruitment\Http\Controllers\RecruitmentController::class, 'convertCandidate']);
        });

        // =========================================================================
        // M06: LIFECYCLE MANAGEMENT & DAG EXECUTION ENGINE (Blueprint v1.0)
        // =========================================================================
        Route::prefix('lifecycle')->group(function () {
            Route::get('/instances', [\App\Domain\Lifecycle\Http\Controllers\LifecycleController::class, 'indexInstances']);
            Route::get('/instances/{id}', [\App\Domain\Lifecycle\Http\Controllers\LifecycleController::class, 'showInstance']);
            Route::post('/tasks/{id}/complete', [\App\Domain\Lifecycle\Http\Controllers\LifecycleController::class, 'completeTask']);
            Route::post('/assets', [\App\Domain\Lifecycle\Http\Controllers\LifecycleController::class, 'allocateAsset']);
            Route::post('/access-revocation', [\App\Domain\Lifecycle\Http\Controllers\LifecycleController::class, 'revokeAccess']);
        });

        // =========================================================================
        // M07: ATTENDANCE, SCHEDULES & LEAVE LEDGER (Blueprint v1.0)
        // =========================================================================
        Route::prefix('attendance')->group(function () {
            Route::post('/clock-in', [\App\Domain\Attendance\Http\Controllers\AttendanceAndLeaveController::class, 'clockIn']);
            Route::post('/clock-out', [\App\Domain\Attendance\Http\Controllers\AttendanceAndLeaveController::class, 'clockOut']);
        });

        Route::prefix('leave')->group(function () {
            Route::get('/balances', [\App\Domain\Attendance\Http\Controllers\AttendanceAndLeaveController::class, 'getLeaveBalances']);
            Route::post('/requests', [\App\Domain\Attendance\Http\Controllers\AttendanceAndLeaveController::class, 'submitLeaveRequest']);
            Route::post('/requests/{id}/approve', [\App\Domain\Attendance\Http\Controllers\AttendanceAndLeaveController::class, 'approveLeave']);
        });

        // =========================================================================
        // M08: TIME TRACKING, OCC TIMERS & TIMESHEETS (Blueprint v1.0)
        // =========================================================================
        Route::prefix('time-tracking')->group(function () {
            Route::post('/start-timer', [\App\Domain\TimeTracking\Http\Controllers\TimeTrackingController::class, 'startTimer']);
            Route::post('/stop-timer/{id}', [\App\Domain\TimeTracking\Http\Controllers\TimeTrackingController::class, 'stopTimer']);
            Route::post('/manual-entry', [\App\Domain\TimeTracking\Http\Controllers\TimeTrackingController::class, 'manualEntry']);
            Route::post('/timesheets/submit', [\App\Domain\TimeTracking\Http\Controllers\TimeTrackingController::class, 'submitTimesheet']);
            Route::post('/timesheets/{id}/approve', [\App\Domain\TimeTracking\Http\Controllers\TimeTrackingController::class, 'approveTimesheet']);
        });

        // =========================================================================
        // M09: DETERMINISTIC PAYROLL ENGINE (Blueprint v1.0)
        // =========================================================================
        Route::prefix('payroll')->group(function () {
            Route::get('/runs', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'indexRuns']);
            Route::post('/runs', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'storeRun']);
            Route::post('/runs/{id}/calculate', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'calculateRun']);
            Route::post('/runs/{id}/approve', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'approveRun']);
            Route::post('/runs/{id}/finalize', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'finalizeRun']);
            Route::get('/payslips', [\App\Domain\Payroll\Http\Controllers\PayrollController::class, 'indexPayslips']);
        });

        // =========================================================================
        // M10: PERFORMANCE, RUBRICS & SKILLS-GAP (Blueprint v1.0)
        // =========================================================================
        Route::prefix('performance')->group(function () {
            Route::get('/cycles', [\App\Domain\Performance\Http\Controllers\PerformanceController::class, 'indexCycles']);
            Route::get('/skills-gap', [\App\Domain\Performance\Http\Controllers\PerformanceController::class, 'skillsGapMatrix']);
            Route::post('/assessments', [\App\Domain\Performance\Http\Controllers\PerformanceController::class, 'assessCompetency']);
        });

        // M09: External Client Portal (User-Scoped)
        Route::prefix('client-portal')->group(function () {
            Route::post('/invitations/accept', [ClientController::class, 'acceptInvitation']);
            Route::get('/me/workspaces', [ClientPortalController::class, 'getMyWorkspaces']);
            Route::get('/{clientId}/overview', [ClientPortalController::class, 'getPortalOverview']);
            Route::get('/{clientId}/projects', [ClientPortalController::class, 'getClientProjects']);
            Route::get('/{clientId}/deliverables', [ClientPortalController::class, 'getClientDeliverables']);
            Route::post('/{clientId}/deliverables/{reviewId}/decision', [ClientPortalController::class, 'submitDeliverableDecision']);
            Route::get('/{clientId}/decisions', [ClientPortalController::class, 'getClientDecisions']);
            Route::post('/{clientId}/decisions/{decisionId}/respond', [ClientPortalController::class, 'respondToDecision']);
            Route::get('/{clientId}/requests', [ClientPortalController::class, 'getClientRequests']);
            Route::post('/{clientId}/requests', [ClientPortalController::class, 'createClientRequest']);
            Route::get('/{clientId}/contracts', [ClientPortalController::class, 'getClientContracts']);
        });

        // M02 Company Scoped Routes Protected by EnsureCompanyMembership
        Route::prefix('companies/{company}')
            ->middleware(['company.access'])
            ->group(function () {

                // Workspace Overview & Profile
                Route::get('/', [CompanyController::class, 'show'])
                    ->middleware('company.permission:company.view');
                Route::patch('/', [CompanyController::class, 'update'])
                    ->middleware('company.permission:company.manage');

                // Employee Directory & Memberships
                Route::get('/members', [MemberController::class, 'index'])
                    ->middleware('company.permission:members.view');
                Route::get('/members/{member}', [MemberController::class, 'show'])
                    ->middleware('company.permission:members.view');
                Route::patch('/members/{member}', [MemberController::class, 'update'])
                    ->middleware('company.permission:members.manage');
                Route::post('/members/{member}/suspend', [MemberController::class, 'suspend'])
                    ->middleware('company.permission:members.manage');
                Route::post('/members/{member}/reactivate', [MemberController::class, 'reactivate'])
                    ->middleware('company.permission:members.manage');
                Route::delete('/members/{member}', [MemberController::class, 'destroy'])
                    ->middleware('company.permission:members.manage');

                // Invitations
                Route::post('/invitations', [InvitationController::class, 'store'])
                    ->middleware('company.permission:members.invite');

                // Departments & Teams
                Route::get('/departments', [DepartmentController::class, 'index'])
                    ->middleware('company.permission:company.view');
                Route::post('/departments', [DepartmentController::class, 'store'])
                    ->middleware('company.permission:company.manage');
                Route::get('/departments/{department}', [DepartmentController::class, 'show'])
                    ->middleware('company.permission:company.view');
                Route::patch('/departments/{department}', [DepartmentController::class, 'update'])
                    ->middleware('company.permission:company.manage');
                Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])
                    ->middleware('company.permission:company.manage');

                // Company Settings
                Route::get('/settings', [CompanySettingsController::class, 'show'])
                    ->middleware('company.permission:company.view');
                Route::patch('/settings', [CompanySettingsController::class, 'update'])
                    ->middleware('company.permission:company.manage');

                // Security Audit Logs
                Route::get('/audit-events', [AuditController::class, 'index'])
                    ->middleware('company.permission:audit.view');

                // M03: Designations
                Route::get('/designations', [DesignationController::class, 'index'])
                    ->middleware('company.permission:employees.directory.view');
                Route::post('/designations', [DesignationController::class, 'store'])
                    ->middleware('company.permission:employees.designations.manage');
                Route::patch('/designations/{designation}', [DesignationController::class, 'update'])
                    ->middleware('company.permission:employees.designations.manage');
                Route::delete('/designations/{designation}', [DesignationController::class, 'destroy'])
                    ->middleware('company.permission:employees.designations.manage');

                // M03: Teams
                Route::get('/teams', [TeamController::class, 'index'])
                    ->middleware('company.permission:employees.directory.view');
                Route::post('/teams', [TeamController::class, 'store'])
                    ->middleware('company.permission:employees.teams.manage');
                Route::get('/teams/{team}', [TeamController::class, 'show'])
                    ->middleware('company.permission:employees.directory.view');
                Route::patch('/teams/{team}', [TeamController::class, 'update'])
                    ->middleware('company.permission:employees.teams.manage');
                Route::delete('/teams/{team}', [TeamController::class, 'destroy'])
                    ->middleware('company.permission:employees.teams.manage');
                Route::post('/teams/{team}/members', [TeamController::class, 'addMember'])
                    ->middleware('company.permission:employees.teams.manage');
                Route::delete('/teams/{team}/members/{membership}', [TeamController::class, 'removeMember'])
                    ->middleware('company.permission:employees.teams.manage');

                // M03: Employee Lifecycle
                Route::get('/employees/export', [EmployeeLifecycleController::class, 'export'])
                    ->middleware('company.permission:employees.export');
                Route::get('/employees', [EmployeeLifecycleController::class, 'index'])
                    ->middleware('company.permission:employees.directory.view');
                Route::post('/employees', [EmployeeLifecycleController::class, 'store'])
                    ->middleware('company.permission:employees.employment.create');
                Route::get('/employees/{employee}', [EmployeeLifecycleController::class, 'show'])
                    ->middleware('company.permission:employees.profile.view');
                Route::patch('/employees/{employee}/profile', [EmployeeLifecycleController::class, 'updateProfile'])
                    ->middleware('company.permission:employees.profile.update_self');
                Route::patch('/employees/{employee}/employment', [EmployeeLifecycleController::class, 'updateEmployment'])
                    ->middleware('company.permission:employees.employment.update');
                Route::delete('/employees/{employee}', [EmployeeLifecycleController::class, 'destroy'])
                    ->middleware('company.permission:employees.employment.update');
                Route::post('/employees/{employee}/reset-password', [EmployeeLifecycleController::class, 'resetPassword'])
                    ->middleware('company.permission:employees.employment.update');
                Route::post('/employees/{employee}/status-transitions', [EmployeeLifecycleController::class, 'transitionStatus'])
                    ->middleware('company.permission:employees.employment.status_change');
                Route::post('/employees/{employee}/offboarding', [EmployeeLifecycleController::class, 'offboard'])
                    ->middleware('company.permission:employees.offboarding.manage');
                Route::post('/employees/{employee}/onboarding-tasks/{task}/toggle', [EmployeeLifecycleController::class, 'toggleOnboardingTask'])
                    ->middleware('company.permission:employees.onboarding.complete');
                Route::get('/employee-change-requests', [EmployeeLifecycleController::class, 'changeRequestsInbox'])
                    ->middleware('company.permission:employees.employment.approve');
                Route::post('/employees/{employee}/change-requests', [EmployeeLifecycleController::class, 'createChangeRequest'])
                    ->middleware('company.permission:employees.employment.view');
                Route::post('/employee-change-requests/{changeRequest}/review', [EmployeeLifecycleController::class, 'reviewChangeRequest'])
                    ->middleware('company.permission:employees.employment.approve');
                Route::get('/employees/{employee}/documents', [EmployeeLifecycleController::class, 'listDocuments'])
                    ->middleware('company.permission:employees.documents.view');
                Route::post('/employees/{employee}/documents', [EmployeeLifecycleController::class, 'uploadDocument'])
                    ->middleware('company.permission:employees.documents.manage');
                Route::get('/employees/{employee}/skills', [EmployeeLifecycleController::class, 'listSkills'])
                    ->middleware('company.permission:employees.profile.view');
                Route::post('/employees/{employee}/skills', [EmployeeLifecycleController::class, 'saveSkill'])
                    ->middleware('company.permission:employees.profile.view');
                Route::delete('/employees/{employee}/skills/{skill}', [EmployeeLifecycleController::class, 'deleteSkill'])
                    ->middleware('company.permission:employees.profile.view');
                Route::get('/employee-reports/summary', [EmployeeLifecycleController::class, 'reports'])
                    ->middleware('company.permission:reports.view');

                // M04: Project Management
                Route::get('/projects/export', [ProjectController::class, 'export'])
                    ->middleware('company.permission:projects.export');
                Route::get('/projects', [ProjectController::class, 'index'])
                    ->middleware('company.permission:projects.directory.view');
                Route::post('/projects', [ProjectController::class, 'store'])
                    ->middleware('company.permission:projects.create');
                Route::get('/projects/{project}', [ProjectController::class, 'show'])
                    ->middleware('company.permission:projects.view');
                Route::patch('/projects/{project}', [ProjectController::class, 'update'])
                    ->middleware('company.permission:projects.update');
                Route::post('/projects/{project}/transitions', [ProjectController::class, 'transitionStatus'])
                    ->middleware('company.permission:projects.status.manage');
                Route::post('/projects/{project}/members', [ProjectController::class, 'addMember'])
                    ->middleware('company.permission:projects.team.manage');
                Route::delete('/projects/{project}/members/{member}', [ProjectController::class, 'removeMember'])
                    ->middleware('company.permission:projects.team.manage');
                Route::post('/projects/{project}/milestones', [ProjectController::class, 'storeMilestone'])
                    ->middleware('company.permission:projects.milestones.manage');
                Route::post('/projects/{project}/milestones/{milestone}/complete', [ProjectController::class, 'completeMilestone'])
                    ->middleware('company.permission:projects.milestones.approve');
                Route::post('/projects/{project}/milestone-dependencies', [ProjectController::class, 'addMilestoneDependency'])
                    ->middleware('company.permission:projects.schedule.manage');
                Route::post('/projects/{project}/risks', [ProjectController::class, 'storeRisk'])
                    ->middleware('company.permission:projects.risks.manage');
                Route::post('/projects/{project}/risks/{risk}/resolve', [ProjectController::class, 'resolveRisk'])
                    ->middleware('company.permission:projects.risks.manage');
                Route::post('/projects/{project}/change-requests', [ProjectController::class, 'storeChangeRequest'])
                    ->middleware('company.permission:projects.scope.manage');
                Route::post('/projects/{project}/change-requests/{changeRequest}/review', [ProjectController::class, 'reviewChangeRequest'])
                    ->middleware('company.permission:projects.scope.approve');
                Route::post('/projects/{project}/decisions', [ProjectController::class, 'storeDecision'])
                    ->middleware('company.permission:projects.update');
                Route::post('/projects/{project}/documents', [ProjectController::class, 'storeDocument'])
                    ->middleware('company.permission:projects.documents.manage');

                // M05: Task Management
                Route::get('/tasks/export', [TaskController::class, 'export'])
                    ->middleware('company.permission:tasks.export');
                Route::get('/task-reports/summary', [TaskController::class, 'reports'])
                    ->middleware('company.permission:tasks.reports.view');
                Route::get('/tasks', [TaskController::class, 'index'])
                    ->middleware('company.permission:tasks.view');
                Route::post('/tasks', [TaskController::class, 'store'])
                    ->middleware('company.permission:tasks.create');
                Route::get('/tasks/{task}', [TaskController::class, 'show'])
                    ->middleware('company.permission:tasks.view');
                Route::patch('/tasks/{task}', [TaskController::class, 'update'])
                    ->middleware('company.permission:tasks.update');
                Route::post('/tasks/{task}/assignments', [TaskController::class, 'assign'])
                    ->middleware('company.permission:tasks.assign');
                Route::post('/tasks/{task}/transitions', [TaskController::class, 'transitionStatus'])
                    ->middleware('company.permission:tasks.status.change');
                Route::post('/tasks/{task}/submit-review', [TaskController::class, 'submitReview'])
                    ->middleware('company.permission:tasks.status.change');
                Route::post('/tasks/{task}/approve', [TaskController::class, 'approve'])
                    ->middleware('company.permission:tasks.approve');
                Route::post('/tasks/{task}/reject', [TaskController::class, 'reject'])
                    ->middleware('company.permission:tasks.review');
                Route::post('/tasks/{task}/dependencies', [TaskController::class, 'addDependency'])
                    ->middleware('company.permission:tasks.dependencies.manage');
                Route::post('/tasks/{task}/comments', [TaskController::class, 'addComment'])
                    ->middleware('company.permission:tasks.comments.create');
                Route::post('/tasks/{task}/checklists', [TaskController::class, 'addChecklistItem'])
                    ->middleware('company.permission:tasks.update');
                Route::patch('/tasks/{task}/checklist-items/{item}/toggle', [TaskController::class, 'toggleChecklistItem'])
                    ->middleware('company.permission:tasks.update');
                Route::post('/tasks/{task}/attachments', [TaskController::class, 'addAttachment'])
                    ->middleware('company.permission:tasks.attachments.manage');

                // M06: Time Tracking & Timesheet Management
                Route::prefix('time')->group(function () {
                    // Session Lifecycle
                    Route::post('/sessions', [TimeTrackingController::class, 'startSession'])
                        ->middleware('company.permission:time.sessions.start');
                    Route::get('/sessions/current', [TimeTrackingController::class, 'currentSession'])
                        ->middleware('company.permission:time.sessions.view_own');
                    Route::post('/sessions/{session}/pause', [TimeTrackingController::class, 'pauseSession'])
                        ->middleware('company.permission:time.sessions.manage_own');
                    Route::post('/sessions/{session}/resume', [TimeTrackingController::class, 'resumeSession'])
                        ->middleware('company.permission:time.sessions.manage_own');
                    Route::post('/sessions/{session}/stop', [TimeTrackingController::class, 'stopSession'])
                        ->middleware('company.permission:time.sessions.manage_own');
                    Route::post('/sessions/{session}/switch-task', [TimeTrackingController::class, 'switchTask'])
                        ->middleware('company.permission:time.sessions.manage_own');

                    // Entries & Manual Records
                    Route::get('/entries', [TimeTrackingController::class, 'listEntries'])
                        ->middleware('company.permission:time.entries.view_own');
                    Route::post('/entries', [TimeTrackingController::class, 'createManualEntry'])
                        ->middleware('company.permission:time.entries.create');
                    Route::patch('/entries/{entry}', [TimeTrackingController::class, 'updateEntry'])
                        ->middleware('company.permission:time.entries.edit_own');
                    Route::post('/entries/{entry}/corrections', [TimeTrackingController::class, 'requestCorrection'])
                        ->middleware('company.permission:time.entries.correct');

                    // Timesheets
                    Route::get('/timesheets', [TimeTrackingController::class, 'listTimesheets'])
                        ->middleware('company.permission:time.timesheets.submit');
                    Route::post('/timesheets', [TimeTrackingController::class, 'storeTimesheet'])
                        ->middleware('company.permission:time.timesheets.submit');
                    Route::post('/timesheets/{timesheet}/submit', [TimeTrackingController::class, 'submitTimesheet'])
                        ->middleware('company.permission:time.timesheets.submit');
                    Route::post('/timesheets/{timesheet}/approve', [TimeTrackingController::class, 'approveTimesheet'])
                        ->middleware('company.permission:time.timesheets.approve');
                    Route::post('/timesheets/{timesheet}/reject', [TimeTrackingController::class, 'rejectTimesheet'])
                        ->middleware('company.permission:time.timesheets.review');
                    Route::post('/timesheets/{timesheet}/reopen', [TimeTrackingController::class, 'reopenTimesheet'])
                        ->middleware('company.permission:time.timesheets.reopen');

                    // Offline Synchronization & Hardware Devices
                    Route::post('/sync-batches', [TimeTrackingController::class, 'syncBatch']);
                    Route::get('/devices', [TimeTrackingController::class, 'listDevices'])
                        ->middleware('company.permission:time.devices.manage');
                    Route::post('/devices/register', [TimeTrackingController::class, 'registerDevice'])
                        ->middleware('company.permission:time.devices.register');
                    Route::post('/devices/{device}/revoke', [TimeTrackingController::class, 'revokeDevice'])
                        ->middleware('company.permission:time.devices.revoke');

                    // Reports & Export
                    Route::get('/reports/summary', [TimeTrackingController::class, 'reportsSummary'])
                        ->middleware('company.permission:time.reports.view');
                    Route::get('/exports', [TimeTrackingController::class, 'exportCsv'])
                        ->middleware('company.permission:time.reports.export');
                });

                // M07: Attendance & Shift Management
                Route::prefix('attendance')->group(function () {
                    Route::get('/me/today', [AttendanceController::class, 'today'])
                        ->middleware('company.permission:attendance.view_own');
                    Route::get('/me', [AttendanceController::class, 'history'])
                        ->middleware('company.permission:attendance.view_own');
                    Route::post('/clock-in', [AttendanceController::class, 'clockIn'])
                        ->middleware('company.permission:attendance.clock_in');
                    Route::post('/clock-out', [AttendanceController::class, 'clockOut'])
                        ->middleware('company.permission:attendance.clock_out');
                    Route::post('/breaks/start', [AttendanceController::class, 'startBreak'])
                        ->middleware('company.permission:attendance.clock_in');
                    Route::post('/breaks/end', [AttendanceController::class, 'endBreak'])
                        ->middleware('company.permission:attendance.clock_in');
                    Route::get('/shifts', [AttendanceController::class, 'shifts'])
                        ->middleware('company.permission:attendance.view_own');
                    Route::post('/shifts', [AttendanceController::class, 'createShift'])
                        ->middleware('company.permission:attendance.policy.manage');
                    Route::post('/shifts/assign', [AttendanceController::class, 'assignShift'])
                        ->middleware('company.permission:attendance.manage');
                    Route::get('/team', [AttendanceController::class, 'teamAttendance'])
                        ->middleware('company.permission:attendance.view_team');
                    Route::post('/corrections', [AttendanceController::class, 'requestCorrection'])
                        ->middleware('company.permission:attendance.correction.request');
                    Route::post('/corrections/{id}/review', [AttendanceController::class, 'reviewCorrection'])
                        ->middleware('company.permission:attendance.correction.review');
                    Route::get('/reports/daily', [AttendanceController::class, 'dailyReport'])
                        ->middleware('company.permission:attendance.report.view');
                    Route::get('/reports/summary', [AttendanceController::class, 'summaryReport'])
                        ->middleware('company.permission:attendance.report.view');
                    Route::get('/export', [AttendanceController::class, 'exportAttendance'])
                        ->middleware('company.permission:attendance.export');
                    Route::post('/sync-batches', [AttendanceController::class, 'syncBatch']);
                    Route::get('/sync-batches/{batchUid}', [AttendanceController::class, 'syncBatchStatus']);
                    Route::get('/history/{date}', [AttendanceController::class, 'dayHistory']);
                    Route::get('/records/{record}', [AttendanceController::class, 'recordDetails']);
                    Route::post('/{record}/screenshot', [ScreenshotController::class, 'store']);
                    Route::post('/{record}/request-screenshot', [ScreenshotController::class, 'requestScreenshot']);
                    Route::get('/screenshot-status/{requestId}', [ScreenshotController::class, 'checkScreenshotStatus']);
                    Route::get('/employee/check-screenshot-request', [ScreenshotController::class, 'employeeCheckRequest']);
                    Route::post('/employee/submit-screenshot', [ScreenshotController::class, 'employeeSubmitScreenshot']);
                });

                // M07: Leave Lifecycle & Balances
                Route::prefix('leave')->group(function () {
                    Route::get('/types', [LeaveController::class, 'types'])
                        ->middleware('company.permission:leave.view_own');
                    Route::get('/balances/me', [LeaveController::class, 'myBalances'])
                        ->middleware('company.permission:leave.view_own');
                    Route::get('/requests', [LeaveController::class, 'requests'])
                        ->middleware('company.permission:leave.view_own');
                    Route::post('/requests', [LeaveController::class, 'submitRequest'])
                        ->middleware('company.permission:leave.request');
                    Route::get('/requests/{id}', [LeaveController::class, 'showRequest'])
                        ->middleware('company.permission:leave.view_own');
                    Route::post('/requests/{id}/approve', [LeaveController::class, 'approveRequest'])
                        ->middleware('company.permission:leave.approve');
                    Route::post('/requests/{id}/reject', [LeaveController::class, 'rejectRequest'])
                        ->middleware('company.permission:leave.reject');
                    Route::post('/requests/{id}/cancel', [LeaveController::class, 'cancelRequest'])
                        ->middleware('company.permission:leave.cancel.request');
                    Route::get('/approvals/pending', [LeaveController::class, 'pendingApprovals'])
                        ->middleware('company.permission:leave.review');
                    Route::post('/balances/{membershipId}/adjust', [LeaveController::class, 'adjustBalance'])
                        ->middleware('company.permission:leave.balance.adjust');
                    Route::get('/reports/summary', [LeaveController::class, 'summaryReport'])
                        ->middleware('company.permission:leave.report.view');
                });

                // M08: Desktop Monitoring & Workforce Activity Intelligence
                Route::prefix('monitoring')->group(function () {
                    // Policy & Simulator
                    Route::get('/policy/current', [MonitoringController::class, 'getEffectivePolicy'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::post('/policy/acknowledge', [MonitoringController::class, 'acknowledgePolicy'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::get('/policy/preview', [MonitoringController::class, 'previewPolicySimulator'])
                        ->middleware('company.permission:monitoring.policy.manage');
                    Route::get('/policies', [MonitoringController::class, 'listPolicies'])
                        ->middleware('company.permission:monitoring.policy.manage');
                    Route::post('/policies', [MonitoringController::class, 'createPolicy'])
                        ->middleware('company.permission:monitoring.policy.manage');
                    Route::post('/policies/{id}/publish', [MonitoringController::class, 'publishPolicy'])
                        ->middleware('company.permission:monitoring.policy.manage');

                    // Devices & Health
                    Route::post('/devices/register', [MonitoringController::class, 'registerDevice'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::get('/devices', [MonitoringController::class, 'listDevices'])
                        ->middleware('company.permission:monitoring.devices.manage');
                    Route::post('/devices/{id}/heartbeat', [MonitoringController::class, 'recordHeartbeat'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::post('/devices/{id}/revoke', [MonitoringController::class, 'revokeDevice'])
                        ->middleware('company.permission:monitoring.devices.manage');

                    // Idempotent Event Ingestion
                    Route::post('/events/batches', [MonitoringController::class, 'submitEventBatch'])
                        ->middleware('company.permission:monitoring.view_own');

                    // Timelines & Summaries
                    Route::get('/timeline/me', [MonitoringController::class, 'getOwnTimeline'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::get('/timeline/team', [MonitoringController::class, 'getTeamTimeline'])
                        ->middleware('company.permission:monitoring.view_team');
                    Route::get('/summaries/me', [MonitoringController::class, 'getOwnSummary'])
                        ->middleware('company.permission:monitoring.view_own');

                    // Context Annotations & Disputes
                    Route::post('/annotations', [MonitoringController::class, 'createAnnotation'])
                        ->middleware('company.permission:monitoring.dispute.submit');
                    Route::get('/annotations', [MonitoringController::class, 'listAnnotations'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::post('/disputes', [MonitoringController::class, 'submitDispute'])
                        ->middleware('company.permission:monitoring.dispute.submit');
                    Route::get('/disputes', [MonitoringController::class, 'listDisputes'])
                        ->middleware('company.permission:monitoring.view_own');
                    Route::post('/disputes/{id}/resolve', [MonitoringController::class, 'resolveDispute'])
                        ->middleware('company.permission:monitoring.dispute.review');

                    // Work Context Engine Reconciliation
                    Route::get('/reconciliation-cases', [MonitoringController::class, 'getReconciliationCases'])
                        ->middleware('company.permission:monitoring.reconciliation.view');
                    Route::post('/reconciliation/run', [MonitoringController::class, 'runReconciliation'])
                        ->middleware('company.permission:monitoring.reconciliation.review');
                    Route::post('/reconciliation-cases/{id}/review', [MonitoringController::class, 'reviewReconciliationCase'])
                        ->middleware('company.permission:monitoring.reconciliation.review');

                    // Export
                    Route::get('/export', [MonitoringController::class, 'exportMonitoring'])
                        ->middleware('company.permission:monitoring.export');
                });

                // M09: Client Management & Internal Client Workspace
                Route::prefix('clients')->group(function () {
                    Route::get('/', [ClientController::class, 'index'])
                        ->middleware('company.permission:clients.view');
                    Route::post('/', [ClientController::class, 'store'])
                        ->middleware('company.permission:clients.create');
                    Route::get('/export', [ClientController::class, 'exportClients'])
                        ->middleware('company.permission:clients.export');
                    Route::get('/{id}', [ClientController::class, 'show'])
                        ->middleware('company.permission:clients.view');
                    Route::patch('/{id}', [ClientController::class, 'update'])
                        ->middleware('company.permission:clients.manage');
                    Route::post('/{id}/archive', [ClientController::class, 'archive'])
                        ->middleware('company.permission:clients.manage');

                    // Contacts & Portal Access
                    Route::post('/{id}/contacts', [ClientController::class, 'storeContact'])
                        ->middleware('company.permission:clients.manage');
                    Route::patch('/{id}/contacts/{contactId}', [ClientController::class, 'updateContact'])
                        ->middleware('company.permission:clients.manage');
                    Route::post('/{id}/invitations', [ClientController::class, 'inviteClientUser'])
                        ->middleware('company.permission:clients.portal.manage');
                    Route::post('/{id}/memberships/{membershipId}/revoke', [ClientController::class, 'revokeMembership'])
                        ->middleware('company.permission:clients.portal.manage');

                    // Project Engagements & Deliverables
                    Route::post('/{id}/projects', [ClientController::class, 'associateProject'])
                        ->middleware('company.permission:clients.projects.manage');
                    Route::post('/{id}/deliverables', [ClientController::class, 'submitDeliverableForReview'])
                        ->middleware('company.permission:clients.deliverables.manage');

                    // Decisions & Requests
                    Route::post('/{id}/decisions', [ClientController::class, 'createDecisionRequest'])
                        ->middleware('company.permission:clients.decisions.manage');
                    Route::post('/{id}/requests/{requestId}/triage', [ClientController::class, 'triageRequest'])
                        ->middleware('company.permission:clients.requests.manage');

                    // Contracts
                    Route::post('/{id}/contracts', [ClientController::class, 'storeContract'])
                        ->middleware('company.permission:clients.contracts.manage');

                    // Health Engine & Access Simulator
                    Route::get('/{id}/health', [ClientController::class, 'getHealthIndicators'])
                        ->middleware('company.permission:clients.health.view');
                    Route::get('/{id}/access-simulation', [ClientController::class, 'simulateAccessBoundary'])
                        ->middleware('company.permission:clients.health.view');
                });

                // M10: Collaboration, Messaging & Notification Intelligence
                Route::prefix('collaboration')->group(function () {
                    // Conversations
                    Route::get('/conversations', [CollaborationController::class, 'index'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::post('/conversations', [CollaborationController::class, 'store'])
                        ->middleware('company.permission:collaboration.conversations.create');
                    Route::get('/conversations/{id}', [CollaborationController::class, 'show'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::patch('/conversations/{id}', [CollaborationController::class, 'update'])
                        ->middleware('company.permission:collaboration.conversations.create');
                    Route::post('/conversations/{id}/archive', [CollaborationController::class, 'archive'])
                        ->middleware('company.permission:collaboration.conversations.create');
                    Route::post('/conversations/{id}/members', [CollaborationController::class, 'addMember'])
                        ->middleware('company.permission:collaboration.conversations.create');
                    Route::delete('/conversations/{id}/members/{userId}', [CollaborationController::class, 'removeMember'])
                        ->middleware('company.permission:collaboration.conversations.create');

                    // Messages & Ordering
                    Route::get('/conversations/{id}/messages', [CollaborationController::class, 'listMessages'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::post('/conversations/{id}/messages', [CollaborationController::class, 'sendMessage'])
                        ->middleware('company.permission:collaboration.messages.send');
                    Route::patch('/conversations/{id}/messages/{messageId}', [CollaborationController::class, 'editMessage'])
                        ->middleware('company.permission:collaboration.messages.edit');
                    Route::delete('/conversations/{id}/messages/{messageId}', [CollaborationController::class, 'deleteMessage'])
                        ->middleware('company.permission:collaboration.messages.delete');
                    Route::post('/conversations/{id}/messages/bulk-delete', [CollaborationController::class, 'bulkDeleteMessages'])
                        ->middleware('company.permission:collaboration.messages.delete');
                    Route::post('/conversations/{id}/messages/{messageId}/reactions', [CollaborationController::class, 'addReaction'])
                        ->middleware('company.permission:collaboration.messages.send');
                    Route::post('/conversations/{id}/read-cursor', [CollaborationController::class, 'updateReadCursor'])
                        ->middleware('company.permission:collaboration.conversations.view');

                    // Features 1 & 2: Conversation-to-Action Engine & Decision Ledger
                    Route::post('/conversations/{id}/messages/{messageId}/actions', [CollaborationController::class, 'convertToAction'])
                        ->middleware('company.permission:collaboration.actions.create');
                    Route::post('/conversations/{id}/messages/{messageId}/decisions', [CollaborationController::class, 'recordDecision'])
                        ->middleware('company.permission:collaboration.actions.create');

                    // Feature 5: Project Handover Brief
                    Route::get('/projects/{projectId}/handover-brief', [CollaborationController::class, 'generateHandoverBrief'])
                        ->middleware('company.permission:collaboration.conversations.view');

                    // Search & Export
                    Route::get('/search', [CollaborationController::class, 'search'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::get('/export', [CollaborationController::class, 'export'])
                        ->middleware('company.permission:collaboration.export');

                    // Real-Time Presence & Heartbeat Tracking
                    Route::post('/presence/ping', [CollaborationController::class, 'pingPresence'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::get('/presence', [CollaborationController::class, 'getPresence'])
                        ->middleware('company.permission:collaboration.conversations.view');

                    // Real-Time Call Signaling & Active Session Synchronization
                    Route::post('/calls/signal', [CollaborationController::class, 'handleCallSignal'])
                        ->middleware('company.permission:collaboration.conversations.view');
                    Route::get('/calls/active', [CollaborationController::class, 'getActiveCallSignal'])
                        ->middleware('company.permission:collaboration.conversations.view');
                });

                // Unified Notification Center & Preferences
                Route::prefix('notifications')->group(function () {
                    Route::get('/', [NotificationController::class, 'index']);
                    Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
                    Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
                    Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
                    Route::get('/preferences', [NotificationController::class, 'getPreferences']);
                    Route::patch('/preferences', [NotificationController::class, 'updatePreferences']);
                });

                // Targeted Announcements
                Route::prefix('announcements')->group(function () {
                    Route::get('/', [NotificationController::class, 'listAnnouncements'])
                        ->middleware('company.permission:collaboration.announcements.view');
                    Route::post('/', [NotificationController::class, 'createAnnouncement'])
                        ->middleware('company.permission:collaboration.announcements.manage');
                    Route::post('/{id}/acknowledge', [NotificationController::class, 'acknowledgeAnnouncement'])
                        ->middleware('company.permission:collaboration.announcements.view');
                });

                // M11: HR, Employee Development & Performance Intelligence
                Route::prefix('hr')->group(function () {
                    // Review Cycles
                    Route::get('/cycles', [PerformanceReviewController::class, 'listCycles'])
                        ->middleware('company.permission:hr.review_cycles.manage');
                    Route::post('/cycles', [PerformanceReviewController::class, 'createCycle'])
                        ->middleware('company.permission:hr.review_cycles.manage');
                    Route::get('/cycles/{cycleId}', [PerformanceReviewController::class, 'showCycle'])
                        ->middleware('company.permission:hr.review_cycles.manage');
                    Route::patch('/cycles/{cycleId}/status', [PerformanceReviewController::class, 'updateCycleStatus'])
                        ->middleware('company.permission:hr.review_cycles.manage');

                    // Templates
                    Route::get('/templates', [PerformanceReviewController::class, 'listTemplates'])
                        ->middleware('company.permission:hr.review_cycles.manage');
                    Route::post('/templates', [PerformanceReviewController::class, 'createTemplate'])
                        ->middleware('company.permission:hr.review_cycles.manage');

                    // Reviews & Assessments
                    Route::get('/reviews', [PerformanceReviewController::class, 'listReviews'])
                        ->middleware('company.permission:hr.reviews.view');
                    Route::get('/reviews/{reviewId}', [PerformanceReviewController::class, 'showReview'])
                        ->middleware('company.permission:hr.reviews.view');
                    Route::post('/reviews/{reviewId}/self-review', [PerformanceReviewController::class, 'submitSelfReview'])
                        ->middleware('company.permission:hr.reviews.self');
                    Route::post('/reviews/{reviewId}/manager-review', [PerformanceReviewController::class, 'submitManagerReview'])
                        ->middleware('company.permission:hr.reviews.assess');

                    // Performance Passport Evidence Links
                    Route::post('/reviews/{reviewId}/evidence', [PerformanceReviewController::class, 'linkEvidence'])
                        ->middleware('company.permission:hr.reviews.view');
                    Route::delete('/reviews/{reviewId}/evidence/{evidenceId}', [PerformanceReviewController::class, 'removeEvidence'])
                        ->middleware('company.permission:hr.reviews.view');

                    // Calibration, Finalization & Appeals
                    Route::post('/reviews/{reviewId}/calibrate', [PerformanceReviewController::class, 'calibrateReview'])
                        ->middleware('company.permission:hr.reviews.finalize');
                    Route::post('/reviews/{reviewId}/finalize', [PerformanceReviewController::class, 'finalizeAndRelease'])
                        ->middleware('company.permission:hr.reviews.finalize');
                    Route::post('/reviews/{reviewId}/acknowledge', [PerformanceReviewController::class, 'acknowledgeReview'])
                        ->middleware('company.permission:hr.reviews.self');
                    Route::post('/reviews/{reviewId}/appeals', [PerformanceReviewController::class, 'submitAppeal'])
                        ->middleware('company.permission:hr.reviews.self');
                    Route::post('/reviews/{reviewId}/appeals/{appealId}/resolve', [PerformanceReviewController::class, 'resolveAppeal'])
                        ->middleware('company.permission:hr.appeals.manage');

                    // Goals & OKRs
                    Route::get('/goals', [EmployeeDevelopmentController::class, 'listGoals'])
                        ->middleware('company.permission:hr.goals.manage');
                    Route::post('/goals', [EmployeeDevelopmentController::class, 'createGoal'])
                        ->middleware('company.permission:hr.goals.manage');
                    Route::patch('/goals/{goalId}/progress', [EmployeeDevelopmentController::class, 'updateGoalProgress'])
                        ->middleware('company.permission:hr.goals.manage');

                    // Competency Frameworks & Skills Gap Engine
                    Route::get('/frameworks', [EmployeeDevelopmentController::class, 'listFrameworks'])
                        ->middleware('company.permission:hr.competencies.manage');
                    Route::post('/frameworks', [EmployeeDevelopmentController::class, 'createFramework'])
                        ->middleware('company.permission:hr.competencies.manage');
                    Route::post('/skill-gaps/evaluate', [EmployeeDevelopmentController::class, 'evaluateSkillGaps'])
                        ->middleware('company.permission:hr.competencies.manage');
                    Route::post('/competency-assessments', [EmployeeDevelopmentController::class, 'recordAssessment'])
                        ->middleware('company.permission:hr.competencies.manage');

                    // Development Plans & Mentorship
                    Route::get('/development-plans', [EmployeeDevelopmentController::class, 'listDevelopmentPlans'])
                        ->middleware('company.permission:hr.competencies.manage');
                    Route::post('/development-plans', [EmployeeDevelopmentController::class, 'createDevelopmentPlan'])
                        ->middleware('company.permission:hr.competencies.manage');
                    Route::post('/development-plans/{planId}/complete', [EmployeeDevelopmentController::class, 'completeDevelopmentPlan'])
                        ->middleware('company.permission:hr.competencies.manage');

                    // Feedback & Recognition
                    Route::get('/feedbacks', [EmployeeDevelopmentController::class, 'listFeedbacks'])
                        ->middleware('company.permission:hr.feedback.create');
                    Route::post('/feedbacks', [EmployeeDevelopmentController::class, 'createFeedback'])
                        ->middleware('company.permission:hr.feedback.create');

                    // Onboarding / Offboarding Checklists
                    Route::get('/checklists', [EmployeeDevelopmentController::class, 'listChecklists'])
                        ->middleware('company.permission:hr.reviews.view');
                    Route::post('/checklists', [EmployeeDevelopmentController::class, 'createChecklist'])
                        ->middleware('company.permission:hr.review_cycles.manage');
                    Route::patch('/checklists/{checklistId}/toggle-item', [EmployeeDevelopmentController::class, 'toggleChecklistItem'])
                        ->middleware('company.permission:hr.reviews.view');

                    // Exports & Audited Reports
                    Route::get('/export', [EmployeeDevelopmentController::class, 'exportPerformanceData'])
                        ->middleware('company.permission:hr.export');
                });

                // M12: Finance, Project Costing & Billing Management
                Route::prefix('finance')->group(function () {
                    // Dashboard & Overview
                    Route::get('/overview', [FinanceDashboardController::class, 'overview'])
                        ->middleware('company.permission:finance.dashboard.view');
                    Route::get('/export', [FinanceDashboardController::class, 'exportReport'])
                        ->middleware('company.permission:finance.export');

                    // Project Profitability & Costing
                    Route::get('/projects/{projectId}/profitability', [ProjectFinanceController::class, 'getProfitability'])
                        ->middleware('company.permission:finance.project_cost.view');
                    Route::get('/projects/{projectId}/budget', [ProjectFinanceController::class, 'getBudget'])
                        ->middleware('company.permission:finance.project_budget.manage');
                    Route::post('/projects/{projectId}/budget', [ProjectFinanceController::class, 'setBudget'])
                        ->middleware('company.permission:finance.project_budget.manage');
                    Route::post('/projects/{projectId}/budget-revisions', [ProjectFinanceController::class, 'reviseBudget'])
                        ->middleware('company.permission:finance.project_budget.manage');
                    Route::get('/projects/{projectId}/costs', [ProjectFinanceController::class, 'getCosts'])
                        ->middleware('company.permission:finance.project_cost.view');
                    Route::post('/projects/{projectId}/sync-labor-costs', [ProjectFinanceController::class, 'syncLaborCosts'])
                        ->middleware('company.permission:finance.project_cost.view');

                    // Billing Contracts
                    Route::get('/projects/{projectId}/contract', [ProjectFinanceController::class, 'getBillingContract'])
                        ->middleware('company.permission:finance.contracts.manage');
                    Route::post('/projects/{projectId}/contract', [ProjectFinanceController::class, 'updateBillingContract'])
                        ->middleware('company.permission:finance.contracts.manage');

                    // Invoicing & Billable Recovery Engine
                    Route::get('/invoices', [BillingInvoiceController::class, 'listInvoices'])
                        ->middleware('company.permission:finance.invoices.view');
                    Route::get('/invoices/{invoiceId}', [BillingInvoiceController::class, 'showInvoice'])
                        ->middleware('company.permission:finance.invoices.view');
                    Route::get('/billing-candidates', [BillingInvoiceController::class, 'getBillingCandidates'])
                        ->middleware('company.permission:finance.invoices.manage');
                    Route::post('/invoices/draft', [BillingInvoiceController::class, 'createDraftInvoice'])
                        ->middleware('company.permission:finance.invoices.manage');
                    Route::post('/invoices/{invoiceId}/issue', [BillingInvoiceController::class, 'issueInvoice'])
                        ->middleware('company.permission:finance.invoices.manage');

                    // Client Payments & Allocations
                    Route::get('/payments', [BillingInvoiceController::class, 'listPayments'])
                        ->middleware('company.permission:finance.payments.manage');
                    Route::post('/payments', [BillingInvoiceController::class, 'recordPayment'])
                        ->middleware('company.permission:finance.payments.manage');
                    Route::post('/payments/{paymentId}/allocations', [BillingInvoiceController::class, 'allocatePayment'])
                        ->middleware('company.permission:finance.payments.manage');

                    // Expenses
                    Route::get('/expenses', [ExpenseController::class, 'listExpenses'])
                        ->middleware('company.permission:finance.expenses.submit');
                    Route::post('/expenses', [ExpenseController::class, 'submitExpense'])
                        ->middleware('company.permission:finance.expenses.submit');
                    Route::post('/expenses/{expenseId}/approve', [ExpenseController::class, 'approveExpense'])
                        ->middleware('company.permission:finance.expenses.approve');
                    Route::post('/expenses/{expenseId}/reject', [ExpenseController::class, 'rejectExpense'])
                        ->middleware('company.permission:finance.expenses.approve');

                    // Financial Period Close
                    Route::get('/period-closes', [FinancialCloseController::class, 'listCloses'])
                        ->middleware('company.permission:finance.period_close.manage');
                    Route::post('/period-closes', [FinancialCloseController::class, 'closePeriod'])
                        ->middleware('company.permission:finance.period_close.manage');
                    Route::post('/period-closes/{closeId}/reopen', [FinancialCloseController::class, 'reopenPeriod'])
                        ->middleware('company.permission:finance.period_close.manage');
                });

                // M14: SaaS Subscription Billing & Entitlements
                Route::prefix('billing')->group(function () {
                    Route::get('/plans', [SubscriptionBillingController::class, 'listPlans']);
                    Route::get('/subscription', [SubscriptionBillingController::class, 'currentSubscription']);
                    Route::post('/checkout', [SubscriptionBillingController::class, 'initiateCheckout']);
                    Route::post('/subscription/seats', [SubscriptionBillingController::class, 'updateSeats']);
                    Route::post('/subscription/cancel', [SubscriptionBillingController::class, 'cancelSubscription']);
                    Route::get('/invoices', [SubscriptionBillingController::class, 'invoices']);
                    Route::get('/entitlements', [SubscriptionBillingController::class, 'entitlements']);
                });

                // M15: Integrations Platform
                Route::prefix('integrations')->group(function () {
                    Route::get('/connectors', [IntegrationController::class, 'listConnectors']);
                    Route::get('/connections', [IntegrationController::class, 'listConnections']);
                    Route::post('/connections', [IntegrationController::class, 'createConnection']);
                    Route::post('/connections/{connection}/sync', [IntegrationController::class, 'triggerSync']);
                    Route::post('/connections/{connection}/disconnect', [IntegrationController::class, 'disconnect']);
                    Route::get('/connections/{connection}/runs', [IntegrationController::class, 'syncRuns']);
                    Route::get('/webhooks/outbound', [IntegrationController::class, 'listOutboundWebhooks']);
                    Route::post('/webhooks/outbound', [IntegrationController::class, 'registerOutboundWebhook']);
                    Route::post('/webhooks/outbound/{webhook}/test', [IntegrationController::class, 'testOutboundWebhook']);
                });

                // M13: Reporting & Analytics
                Route::prefix('analytics')->group(function () {
                    Route::get('/catalog', [AnalyticsController::class, 'catalog']);
                    Route::get('/dashboard', [AnalyticsController::class, 'dashboardOverview']);
                    Route::get('/kpis/{kpiCode}/snapshot', [AnalyticsController::class, 'getSnapshot']);
                    Route::get('/anomalies', [AnalyticsController::class, 'listAnomalies']);
                    Route::post('/anomalies/detect', [AnalyticsController::class, 'triggerAnomalyDetection']);
                    Route::post('/anomalies/{anomaly}/acknowledge', [AnalyticsController::class, 'acknowledgeAnomaly']);
                    Route::get('/kpis/{kpiCode}/forecast', [AnalyticsController::class, 'getForecast']);
                    Route::get('/reports', [AnalyticsController::class, 'listReports']);
                    Route::post('/reports', [AnalyticsController::class, 'saveReport']);
                    Route::post('/finobo/query', [AnalyticsController::class, 'finoboAnalyticsQuery']);
                });

                // File & Document Management Module
                Route::prefix('files')->group(function () {
                    Route::get('/', [FileManagementController::class, 'index']);
                    Route::get('/screenshots', [FileManagementController::class, 'screenshots']);
                    Route::post('/upload', [FileManagementController::class, 'upload']);
                    Route::post('/bulk-action', [FileManagementController::class, 'bulkAction']);
                    Route::get('/history', [FileManagementController::class, 'auditHistory']);
                    Route::get('/{uuid}', [FileManagementController::class, 'show']);
                    Route::get('/{uuid}/download', [FileManagementController::class, 'download']);
                    Route::patch('/{uuid}', [FileManagementController::class, 'update']);
                    Route::delete('/{uuid}', [FileManagementController::class, 'destroy']);
                });
                Route::get('/files-telemetry', [FileManagementController::class, 'telemetry']);
                Route::get('/storage-stats', [DashboardController::class, 'sidebarStats']);

                // Folders Management
                Route::prefix('folders')->group(function () {
                    Route::get('/', [FileManagementController::class, 'folders']);
                    Route::post('/', [FileManagementController::class, 'createFolder']);
                    Route::patch('/{folder}', [FileManagementController::class, 'updateFolder']);
                    Route::delete('/{folder}', [FileManagementController::class, 'deleteFolder']);
                });
            });

        // M16: SaaS Platform Administration (Protected by platform.admin)
        Route::prefix('platform')->middleware('platform.admin')->group(function () {
            Route::get('/tenants', [PlatformAdminController::class, 'listTenants']);
            Route::post('/tenants/{company}/status', [PlatformAdminController::class, 'updateTenantStatus']);
            Route::post('/tenants/{company}/support-session', [PlatformAdminController::class, 'requestSupportSession']);
            Route::get('/support-sessions', [PlatformAdminController::class, 'listSupportSessions']);
            Route::post('/support-sessions/{session}/terminate', [PlatformAdminController::class, 'terminateSupportSession']);
            Route::get('/feature-flags', [PlatformAdminController::class, 'listFeatureFlags']);
            Route::post('/feature-flags', [PlatformAdminController::class, 'createOrUpdateFeatureFlag']);
            Route::get('/incidents', [PlatformAdminController::class, 'listIncidents']);
            Route::post('/incidents', [PlatformAdminController::class, 'createIncident']);
            Route::post('/incidents/{incident}/updates', [PlatformAdminController::class, 'addIncidentUpdate']);
            Route::get('/telemetry', [PlatformAdminController::class, 'getTelemetryOverview']);
            Route::get('/audit-logs', [PlatformAdminController::class, 'listAuditLogs']);
        });
    });
});


Route::prefix('v1')->group(function () {
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/attendance/history/{date}', [AttendanceController::class, 'dayHistory'])
            ->where('date', '\\d{4}-\\d{2}-\\d{2}');
        Route::get('/attendance/records/{record}', [AttendanceController::class, 'recordDetailsDirect']);
        Route::post('/attendance/{record}/screenshot', [ScreenshotController::class, 'store']);
        Route::post('/attendance/{record}/request-screenshot', [ScreenshotController::class, 'requestScreenshot']);
        Route::get('/attendance/screenshot-status/{requestId}', [ScreenshotController::class, 'checkScreenshotStatus']);
        Route::get('/attendance/employee/check-screenshot-request', [ScreenshotController::class, 'employeeCheckRequest']);
        Route::post('/attendance/employee/submit-screenshot', [ScreenshotController::class, 'employeeSubmitScreenshot']);
        Route::get('/dashboard/sidebar-stats', [DashboardController::class, 'sidebarStats']);
    });
});

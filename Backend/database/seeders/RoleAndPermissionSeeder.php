<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Company & Settings
            ['key' => 'company.view', 'name' => 'View Company', 'module' => 'company'],
            ['key' => 'company.manage', 'name' => 'Manage Company', 'module' => 'company'],
            ['key' => 'company.billing', 'name' => 'Manage Billing', 'module' => 'company'],

            // Members & Roles
            ['key' => 'members.view', 'name' => 'View Members', 'module' => 'members'],
            ['key' => 'members.invite', 'name' => 'Invite Members', 'module' => 'members'],
            ['key' => 'members.manage', 'name' => 'Manage Members', 'module' => 'members'],
            ['key' => 'roles.manage', 'name' => 'Manage Roles', 'module' => 'roles'],

            // Projects (M04)
            ['key' => 'projects.view', 'name' => 'View Projects', 'module' => 'projects'],
            ['key' => 'projects.directory.view', 'name' => 'View Project Directory', 'module' => 'projects'],
            ['key' => 'projects.create', 'name' => 'Create Projects', 'module' => 'projects'],
            ['key' => 'projects.edit', 'name' => 'Edit Projects', 'module' => 'projects'],
            ['key' => 'projects.update', 'name' => 'Update Projects', 'module' => 'projects'],
            ['key' => 'projects.delete', 'name' => 'Delete Projects', 'module' => 'projects'],
            ['key' => 'projects.archive', 'name' => 'Archive Projects', 'module' => 'projects'],
            ['key' => 'projects.status.manage', 'name' => 'Manage Project Status', 'module' => 'projects'],
            ['key' => 'projects.scope.view', 'name' => 'View Project Scope', 'module' => 'projects'],
            ['key' => 'projects.scope.manage', 'name' => 'Manage Project Scope', 'module' => 'projects'],
            ['key' => 'projects.scope.approve', 'name' => 'Approve Project Scope', 'module' => 'projects'],
            ['key' => 'projects.team.view', 'name' => 'View Project Team', 'module' => 'projects'],
            ['key' => 'projects.team.manage', 'name' => 'Manage Project Team', 'module' => 'projects'],
            ['key' => 'projects.milestones.view', 'name' => 'View Project Milestones', 'module' => 'projects'],
            ['key' => 'projects.milestones.manage', 'name' => 'Manage Project Milestones', 'module' => 'projects'],
            ['key' => 'projects.milestones.approve', 'name' => 'Approve Milestone Completion', 'module' => 'projects'],
            ['key' => 'projects.schedule.manage', 'name' => 'Manage Project Schedule', 'module' => 'projects'],
            ['key' => 'projects.budget.view', 'name' => 'View Project Budget', 'module' => 'projects'],
            ['key' => 'projects.budget.manage', 'name' => 'Manage Project Budget', 'module' => 'projects'],
            ['key' => 'projects.risks.manage', 'name' => 'Manage Project Risks & Issues', 'module' => 'projects'],
            ['key' => 'projects.documents.view', 'name' => 'View Project Documents', 'module' => 'projects'],
            ['key' => 'projects.documents.manage', 'name' => 'Manage Project Documents', 'module' => 'projects'],
            ['key' => 'projects.client_view.manage', 'name' => 'Manage Client-Facing Views', 'module' => 'projects'],
            ['key' => 'projects.reports.view', 'name' => 'View Project Reports', 'module' => 'projects'],
            ['key' => 'projects.export', 'name' => 'Export Projects', 'module' => 'projects'],
            ['key' => 'projects.audit.view', 'name' => 'View Project Audit Trail', 'module' => 'projects'],
            ['key' => 'projects.close', 'name' => 'Close Projects', 'module' => 'projects'],

            // M05 Task Management Catalogue
            ['key' => 'tasks.view', 'name' => 'View Tasks', 'module' => 'tasks'],
            ['key' => 'tasks.create', 'name' => 'Create Tasks', 'module' => 'tasks'],
            ['key' => 'tasks.update', 'name' => 'Update Tasks', 'module' => 'tasks'],
            ['key' => 'tasks.assign', 'name' => 'Assign Tasks', 'module' => 'tasks'],
            ['key' => 'tasks.status.change', 'name' => 'Change Task Status', 'module' => 'tasks'],
            ['key' => 'tasks.delete', 'name' => 'Delete/Archive Tasks', 'module' => 'tasks'],
            ['key' => 'tasks.priority.manage', 'name' => 'Manage Task Priority', 'module' => 'tasks'],
            ['key' => 'tasks.due_date.manage', 'name' => 'Manage Task Due Dates', 'module' => 'tasks'],
            ['key' => 'tasks.dependencies.manage', 'name' => 'Manage Task Dependencies', 'module' => 'tasks'],
            ['key' => 'tasks.comments.view', 'name' => 'View Task Comments', 'module' => 'tasks'],
            ['key' => 'tasks.comments.create', 'name' => 'Add Task Comments', 'module' => 'tasks'],
            ['key' => 'tasks.internal_notes.view', 'name' => 'View Internal-Only Notes', 'module' => 'tasks'],
            ['key' => 'tasks.review', 'name' => 'Review Task Deliverables', 'module' => 'tasks'],
            ['key' => 'tasks.approve', 'name' => 'Approve Task Deliverables', 'module' => 'tasks'],
            ['key' => 'tasks.time.view', 'name' => 'View Task Time Records', 'module' => 'tasks'],
            ['key' => 'tasks.time.approve', 'name' => 'Approve Task Time', 'module' => 'tasks'],
            ['key' => 'tasks.attachments.view', 'name' => 'View Task Attachments', 'module' => 'tasks'],
            ['key' => 'tasks.attachments.manage', 'name' => 'Manage Task Attachments', 'module' => 'tasks'],
            ['key' => 'tasks.reports.view', 'name' => 'View Task Reports', 'module' => 'tasks'],
            ['key' => 'tasks.export', 'name' => 'Export Task Data', 'module' => 'tasks'],
            ['key' => 'tasks.audit.view', 'name' => 'View Task Audit Logs', 'module' => 'tasks'],

            // Time Tracking (M06 Catalogue)
            ['key' => 'time.track', 'name' => 'Track Time (Legacy)', 'module' => 'time_tracking'],
            ['key' => 'time.view_team', 'name' => 'View Team Time (Legacy)', 'module' => 'time_tracking'],
            ['key' => 'time.manage', 'name' => 'Manage Time Entries (Legacy)', 'module' => 'time_tracking'],
            ['key' => 'time.sessions.start', 'name' => 'Start an eligible session', 'module' => 'time_tracking'],
            ['key' => 'time.sessions.view_own', 'name' => 'View own sessions', 'module' => 'time_tracking'],
            ['key' => 'time.sessions.manage_own', 'name' => 'Pause, resume and stop own sessions', 'module' => 'time_tracking'],
            ['key' => 'time.entries.create', 'name' => 'Create permitted entries', 'module' => 'time_tracking'],
            ['key' => 'time.entries.view_own', 'name' => 'View own time records', 'module' => 'time_tracking'],
            ['key' => 'time.entries.view_team', 'name' => 'View authorized team entries', 'module' => 'time_tracking'],
            ['key' => 'time.entries.edit_own', 'name' => 'Edit eligible draft entries', 'module' => 'time_tracking'],
            ['key' => 'time.entries.correct', 'name' => 'Request or perform authorized corrections', 'module' => 'time_tracking'],
            ['key' => 'time.timesheets.submit', 'name' => 'Submit own timesheets', 'module' => 'time_tracking'],
            ['key' => 'time.timesheets.view_team', 'name' => 'View authorized team timesheets', 'module' => 'time_tracking'],
            ['key' => 'time.timesheets.review', 'name' => 'Review submitted timesheets', 'module' => 'time_tracking'],
            ['key' => 'time.timesheets.approve', 'name' => 'Approve eligible submissions', 'module' => 'time_tracking'],
            ['key' => 'time.timesheets.reopen', 'name' => 'Reopen under the correction policy', 'module' => 'time_tracking'],
            ['key' => 'time.reports.view', 'name' => 'View authorized time reports', 'module' => 'time_tracking'],
            ['key' => 'time.reports.export', 'name' => 'Export permitted data', 'module' => 'time_tracking'],
            ['key' => 'time.devices.register', 'name' => 'Register a tracker device', 'module' => 'time_tracking'],
            ['key' => 'time.devices.manage', 'name' => 'Manage registered devices', 'module' => 'time_tracking'],
            ['key' => 'time.devices.revoke', 'name' => 'Revoke a device', 'module' => 'time_tracking'],
            ['key' => 'time.audit.view', 'name' => 'View authorized time audit history', 'module' => 'time_tracking'],
            ['key' => 'time.policy.manage', 'name' => 'Manage company tracking and approval policies', 'module' => 'time_tracking'],

            // M07 Attendance & Leave Catalogue
            ['key' => 'attendance.view_own', 'name' => 'View Own Attendance', 'module' => 'attendance'],
            ['key' => 'attendance.clock_in', 'name' => 'Clock In', 'module' => 'attendance'],
            ['key' => 'attendance.clock_out', 'name' => 'Clock Out', 'module' => 'attendance'],
            ['key' => 'attendance.view_team', 'name' => 'View Team Attendance', 'module' => 'attendance'],
            ['key' => 'attendance.view_company', 'name' => 'View Company Attendance', 'module' => 'attendance'],
            ['key' => 'attendance.manage', 'name' => 'Manage Attendance', 'module' => 'attendance'],
            ['key' => 'attendance.correction.request', 'name' => 'Request Attendance Correction', 'module' => 'attendance'],
            ['key' => 'attendance.correction.review', 'name' => 'Review Attendance Corrections', 'module' => 'attendance'],
            ['key' => 'attendance.correction.apply', 'name' => 'Apply Attendance Correction', 'module' => 'attendance'],
            ['key' => 'attendance.policy.manage', 'name' => 'Manage Attendance Policies', 'module' => 'attendance'],
            ['key' => 'attendance.report.view', 'name' => 'View Attendance Reports', 'module' => 'attendance'],
            ['key' => 'attendance.export', 'name' => 'Export Attendance Data', 'module' => 'attendance'],
            ['key' => 'leave.view_own', 'name' => 'View Own Leave & Balances', 'module' => 'leave'],
            ['key' => 'leave.request', 'name' => 'Request Leave', 'module' => 'leave'],
            ['key' => 'leave.cancel.request', 'name' => 'Request Leave Cancellation', 'module' => 'leave'],
            ['key' => 'leave.view_team', 'name' => 'View Team Leave', 'module' => 'leave'],
            ['key' => 'leave.view_company', 'name' => 'View Company Leave', 'module' => 'leave'],
            ['key' => 'leave.review', 'name' => 'Review Leave Requests', 'module' => 'leave'],
            ['key' => 'leave.approve', 'name' => 'Approve Leave Requests', 'module' => 'leave'],
            ['key' => 'leave.reject', 'name' => 'Reject Leave Requests', 'module' => 'leave'],
            ['key' => 'leave.policy.manage', 'name' => 'Manage Leave Policies', 'module' => 'leave'],
            ['key' => 'leave.balance.adjust', 'name' => 'Adjust Leave Balances', 'module' => 'leave'],
            ['key' => 'leave.report.view', 'name' => 'View Leave Reports', 'module' => 'leave'],

            // Legacy Attendance & Leave keys for backward compatibility
            ['key' => 'attendance.view', 'name' => 'View Attendance (Legacy)', 'module' => 'attendance'],

            // Reports & Audits
            ['key' => 'reports.view', 'name' => 'View Reports', 'module' => 'reports'],
            ['key' => 'audit.view', 'name' => 'View Audit Logs', 'module' => 'audit'],

            // M03 Employee Management
            ['key' => 'employees.directory.view', 'name' => 'View Employee Directory', 'module' => 'employees'],
            ['key' => 'employees.profile.view', 'name' => 'View Employee Profile', 'module' => 'employees'],
            ['key' => 'employees.profile.update_self', 'name' => 'Update Self Profile', 'module' => 'employees'],
            ['key' => 'employees.profile.update', 'name' => 'Update Employee Profile', 'module' => 'employees'],
            ['key' => 'employees.employment.view', 'name' => 'View Employment Details', 'module' => 'employees'],
            ['key' => 'employees.employment.create', 'name' => 'Create Employment Records', 'module' => 'employees'],
            ['key' => 'employees.employment.update', 'name' => 'Update Employment Details', 'module' => 'employees'],
            ['key' => 'employees.employment.status_change', 'name' => 'Change Employment Status', 'module' => 'employees'],
            ['key' => 'employees.employment.approve', 'name' => 'Approve Employment Changes', 'module' => 'employees'],
            ['key' => 'employees.sensitive.view', 'name' => 'View Sensitive Details', 'module' => 'employees'],
            ['key' => 'employees.sensitive.update', 'name' => 'Update Sensitive Details', 'module' => 'employees'],
            ['key' => 'employees.documents.view', 'name' => 'View Documents', 'module' => 'employees'],
            ['key' => 'employees.documents.manage', 'name' => 'Manage Documents', 'module' => 'employees'],
            ['key' => 'employees.onboarding.manage', 'name' => 'Manage Onboarding', 'module' => 'employees'],
            ['key' => 'employees.onboarding.complete', 'name' => 'Complete Onboarding Tasks', 'module' => 'employees'],
            ['key' => 'employees.teams.manage', 'name' => 'Manage Teams', 'module' => 'employees'],
            ['key' => 'employees.departments.manage', 'name' => 'Manage Departments', 'module' => 'employees'],
            ['key' => 'employees.designations.manage', 'name' => 'Manage Designations', 'module' => 'employees'],
            ['key' => 'employees.offboarding.manage', 'name' => 'Manage Offboarding', 'module' => 'employees'],
            ['key' => 'employees.export', 'name' => 'Export Employees', 'module' => 'employees'],
            ['key' => 'employees.audit.view', 'name' => 'View Employee Audit', 'module' => 'employees'],

            // M08 Desktop Monitoring & Activity Intelligence Catalogue
            ['key' => 'monitoring.view_own', 'name' => 'View Own Activity & Monitoring', 'module' => 'monitoring'],
            ['key' => 'monitoring.view_team', 'name' => 'View Team Activity & Monitoring', 'module' => 'monitoring'],
            ['key' => 'monitoring.view_company', 'name' => 'View Company Activity & Monitoring', 'module' => 'monitoring'],
            ['key' => 'monitoring.policy.manage', 'name' => 'Manage Monitoring Policies & Simulator', 'module' => 'monitoring'],
            ['key' => 'monitoring.devices.manage', 'name' => 'Manage Monitoring Tracker Devices', 'module' => 'monitoring'],
            ['key' => 'monitoring.dispute.submit', 'name' => 'Submit Monitoring Context Correction / Dispute', 'module' => 'monitoring'],
            ['key' => 'monitoring.dispute.review', 'name' => 'Review & Resolve Employee Activity Disputes', 'module' => 'monitoring'],
            ['key' => 'monitoring.reconciliation.view', 'name' => 'View Work Context Engine Reconciliations', 'module' => 'monitoring'],
            ['key' => 'monitoring.reconciliation.review', 'name' => 'Review Reconciliation Cases', 'module' => 'monitoring'],
            ['key' => 'monitoring.export', 'name' => 'Export Monitoring & Activity Data', 'module' => 'monitoring'],

            // M09 Client Management & Client Portal Catalogue
            ['key' => 'clients.view', 'name' => 'View Client Organizations', 'module' => 'clients'],
            ['key' => 'clients.create', 'name' => 'Create Client Organizations', 'module' => 'clients'],
            ['key' => 'clients.manage', 'name' => 'Manage Client Organizations & Contacts', 'module' => 'clients'],
            ['key' => 'clients.portal.manage', 'name' => 'Manage Client Portal Memberships & Invitations', 'module' => 'clients'],
            ['key' => 'clients.projects.manage', 'name' => 'Manage Client Project Engagements & Visibility', 'module' => 'clients'],
            ['key' => 'clients.deliverables.manage', 'name' => 'Submit Deliverables for Client Review', 'module' => 'clients'],
            ['key' => 'clients.decisions.manage', 'name' => 'Manage Client Decision Ledger', 'module' => 'clients'],
            ['key' => 'clients.requests.manage', 'name' => 'Triage & Convert Client Requests', 'module' => 'clients'],
            ['key' => 'clients.contracts.manage', 'name' => 'Manage Client Contracts & Engagements', 'module' => 'clients'],
            ['key' => 'clients.health.view', 'name' => 'View Client Health & Access Boundary Simulator', 'module' => 'clients'],
            ['key' => 'clients.export', 'name' => 'Export Client Data', 'module' => 'clients'],

            // M10 Collaboration, Messaging & Notification Intelligence Catalogue
            ['key' => 'collaboration.conversations.create', 'name' => 'Create Direct and Group Conversations', 'module' => 'collaboration'],
            ['key' => 'collaboration.conversations.view', 'name' => 'View Authorized Conversations', 'module' => 'collaboration'],
            ['key' => 'collaboration.messages.send', 'name' => 'Send Messages in Authorized Conversations', 'module' => 'collaboration'],
            ['key' => 'collaboration.messages.edit', 'name' => 'Edit Own Messages within Policy', 'module' => 'collaboration'],
            ['key' => 'collaboration.messages.delete', 'name' => 'Delete or Redact Messages', 'module' => 'collaboration'],
            ['key' => 'collaboration.announcements.manage', 'name' => 'Manage & Publish Targeted Announcements', 'module' => 'collaboration'],
            ['key' => 'collaboration.announcements.view', 'name' => 'View Permitted Announcements', 'module' => 'collaboration'],
            ['key' => 'collaboration.actions.create', 'name' => 'Convert Message to M05 Task or Decision', 'module' => 'collaboration'],
            ['key' => 'collaboration.notifications.manage', 'name' => 'Manage Notification Settings & Quiet Hours', 'module' => 'collaboration'],
            ['key' => 'collaboration.export', 'name' => 'Export Authorized Collaboration History', 'module' => 'collaboration'],

            // M11 HR, Employee Development & Performance Intelligence Catalogue
            ['key' => 'hr.review_cycles.manage', 'name' => 'Manage Review Cycles & Templates', 'module' => 'performance'],
            ['key' => 'hr.reviews.view', 'name' => 'View Authorized Performance Reviews', 'module' => 'performance'],
            ['key' => 'hr.reviews.self', 'name' => 'Submit Self-Assessments', 'module' => 'performance'],
            ['key' => 'hr.reviews.assess', 'name' => 'Submit Manager Assessments', 'module' => 'performance'],
            ['key' => 'hr.reviews.finalize', 'name' => 'Calibrate & Finalize Performance Reviews', 'module' => 'performance'],
            ['key' => 'hr.goals.manage', 'name' => 'Manage Employee Goals & OKRs', 'module' => 'performance'],
            ['key' => 'hr.competencies.manage', 'name' => 'Manage Competency Frameworks & Skills Gap', 'module' => 'performance'],
            ['key' => 'hr.feedback.create', 'name' => 'Give Structured Feedback & Recognition', 'module' => 'performance'],
            ['key' => 'hr.appeals.manage', 'name' => 'Review and Adjudicate Performance Appeals', 'module' => 'performance'],
            ['key' => 'hr.export', 'name' => 'Export Authorized HR Performance Reports', 'module' => 'performance'],

            // M12 Finance, Project Costing & Billing Management Catalogue
            ['key' => 'finance.dashboard.view', 'name' => 'View Financial Overview & Metrics', 'module' => 'finance'],
            ['key' => 'finance.project_cost.view', 'name' => 'View Project Costs & Profitability', 'module' => 'finance'],
            ['key' => 'finance.project_budget.manage', 'name' => 'Manage Project Budgets & Revisions', 'module' => 'finance'],
            ['key' => 'finance.contracts.manage', 'name' => 'Manage Billing Contracts & Cost Rates', 'module' => 'finance'],
            ['key' => 'finance.invoices.view', 'name' => 'View Client Invoices', 'module' => 'finance'],
            ['key' => 'finance.invoices.manage', 'name' => 'Create & Issue Invoices', 'module' => 'finance'],
            ['key' => 'finance.payments.manage', 'name' => 'Record & Allocate Payments', 'module' => 'finance'],
            ['key' => 'finance.expenses.submit', 'name' => 'Submit Project Expenses', 'module' => 'finance'],
            ['key' => 'finance.expenses.approve', 'name' => 'Approve or Reject Expenses', 'module' => 'finance'],
            ['key' => 'finance.period_close.manage', 'name' => 'Perform Financial Period Close', 'module' => 'finance'],
            ['key' => 'finance.export', 'name' => 'Export Financial Reports', 'module' => 'finance'],
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['key' => $perm['key']], $perm);
        }

        $allPermissionIds = Permission::all()->pluck('id');

        // Create System Default Roles (company_id is null for template roles)
        $ownerRole = Role::firstOrCreate(
            ['company_id' => null, 'slug' => 'company-owner'],
            ['name' => 'Company Owner', 'description' => 'Full administrative access and company ownership', 'is_system' => true]
        );
        $ownerRole->permissions()->sync($allPermissionIds);

        $adminRole = Role::firstOrCreate(
            ['company_id' => null, 'slug' => 'company-admin'],
            ['name' => 'Company Administrator', 'description' => 'Administrative control across organizational features', 'is_system' => true]
        );
        $adminPermissions = Permission::whereNotIn('key', ['company.billing'])->pluck('id');
        $adminRole->permissions()->sync($adminPermissions);

        $pmRole = Role::firstOrCreate(
            ['company_id' => null, 'slug' => 'project-manager'],
            ['name' => 'Project Manager', 'description' => 'Can manage projects, tasks, and view team time entries and team attendance', 'is_system' => true]
        );
        $pmPermissions = Permission::whereIn('module', ['projects', 'tasks', 'time_tracking', 'clients', 'collaboration'])
            ->orWhereIn('key', [
                'reports.view', 'members.view',
                'employees.directory.view', 'employees.profile.view', 'employees.onboarding.complete',
                'attendance.view_own', 'attendance.clock_in', 'attendance.clock_out', 'attendance.view_team',
                'attendance.correction.request', 'attendance.correction.review',
                'leave.view_own', 'leave.request', 'leave.cancel.request', 'leave.view_team', 'leave.review', 'leave.approve', 'leave.reject',
                'monitoring.view_own', 'monitoring.view_team', 'monitoring.dispute.submit', 'monitoring.dispute.review', 'monitoring.reconciliation.view', 'monitoring.reconciliation.review',
                'hr.reviews.view', 'hr.reviews.assess', 'hr.goals.manage', 'hr.feedback.create', 'hr.competencies.manage',
                'finance.dashboard.view', 'finance.project_cost.view', 'finance.project_budget.manage', 'finance.expenses.submit', 'finance.expenses.approve',
            ])
            ->pluck('id');
        $pmRole->permissions()->sync($pmPermissions);

        $hrRole = Role::firstOrCreate(
            ['company_id' => null, 'slug' => 'hr-officer'],
            ['name' => 'HR Officer', 'description' => 'Manages employees, attendance, leave policies, and approvals', 'is_system' => true]
        );
        $hrPermissions = Permission::whereIn('module', ['employees', 'attendance', 'leave', 'performance', 'collaboration'])
            ->orWhereIn('key', [
                'company.view', 'members.view', 'reports.view', 'projects.directory.view', 'projects.view',
                'monitoring.view_own', 'monitoring.view_team', 'monitoring.view_company', 'monitoring.policy.manage', 'monitoring.dispute.review', 'monitoring.reconciliation.view', 'monitoring.reconciliation.review', 'monitoring.export',
                'clients.view', 'clients.health.view',
            ])
            ->pluck('id');
        $hrRole->permissions()->sync($hrPermissions);

        $employeeRole = Role::firstOrCreate(
            ['company_id' => null, 'slug' => 'employee'],
            ['name' => 'Employee', 'description' => 'Standard team member with task, time tracking, attendance and leave abilities', 'is_system' => true]
        );
        $employeePermissions = Permission::whereIn('key', [
            'company.view', 'members.view', 'projects.view', 'projects.directory.view', 'tasks.view', 'tasks.edit',
            'tasks.comments.view', 'tasks.comments.create',
            'collaboration.conversations.view', 'collaboration.conversations.create',
            'collaboration.messages.send', 'collaboration.messages.edit', 'collaboration.messages.delete',
            'collaboration.announcements.view', 'collaboration.actions.create',
            'time.track', 'time.sessions.start', 'time.sessions.view_own', 'time.sessions.manage_own',
            'time.entries.create', 'time.entries.view_own', 'time.entries.edit_own', 'time.entries.correct',
            'time.timesheets.submit', 'time.devices.register', 'attendance.view',
            'attendance.view_own', 'attendance.clock_in', 'attendance.clock_out', 'attendance.correction.request',
            'leave.view_own', 'leave.request', 'leave.cancel.request',
            'employees.directory.view', 'employees.profile.view', 'employees.profile.update_self',
            'employees.onboarding.complete', 'employees.documents.view',
            'monitoring.view_own', 'monitoring.dispute.submit',
            'clients.view',
            'hr.reviews.view', 'hr.reviews.self', 'hr.goals.manage', 'hr.feedback.create',
            'finance.expenses.submit'
        ])->pluck('id');
        $employeeRole->permissions()->sync($employeePermissions);
    }
}

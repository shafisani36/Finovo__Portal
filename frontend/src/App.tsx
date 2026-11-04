import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfirmationModalProvider } from "./context/ConfirmationModalContext";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { MfaChallengePage } from "./pages/MfaChallengePage";
import { SelectWorkspacePage } from "./pages/SelectWorkspacePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { WorkspaceOverviewPage } from "./pages/WorkspaceOverviewPage";
import { EmployeeDirectoryPage } from "./pages/EmployeeDirectoryPage";
import { EmployeeCreatePage } from "./pages/EmployeeCreatePage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { RolesPage } from "./pages/RolesPage";
import { CompanySettingsPage } from "./pages/CompanySettingsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { ProjectManagementPage } from "./pages/ProjectManagementPage";
import { ProjectCreatePage } from "./pages/ProjectCreatePage";
import { TaskManagementPage } from "./pages/TaskManagementPage";
import { TaskCreatePage } from "./pages/TaskCreatePage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";
import { AttendanceLeavePage } from "./pages/AttendanceLeavePage";
import { MonitoringIntelligencePage } from "./pages/MonitoringIntelligencePage";
import { ClientManagementPage } from "./pages/ClientManagementPage";
import { ClientPortalPage } from "./pages/ClientPortalPage";
import { CollaborationPage } from "./pages/CollaborationPage";
import { PerformanceManagementPage } from "./pages/PerformanceManagementPage";
import { FinanceManagementPage } from "./pages/FinanceManagementPage";
import { SubscriptionBillingPage } from "./pages/SubscriptionBillingPage";
import { IntegrationsHubPage } from "./pages/IntegrationsHubPage";
import { PlatformAdminPage } from "./pages/PlatformAdminPage";
import { FileManagementPage } from "./pages/FileManagementPage";
import { DownloadTrackerPage } from "./pages/DownloadTrackerPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin h-5 w-5 text-[#F95716]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-medium">
            Resolving tenant session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const WorkspaceRedirect: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  return <Navigate to={`/app/${companySlug}/overview`} replace />;
};

const AnalyticsRedirect: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  return (
    <Navigate to={`/app/${companySlug || "bitspark-ops"}/monitoring`} replace />
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ConfirmationModalProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/mfa/challenge" element={<MfaChallengePage />} />

            {/* Protected Onboarding & Selection Routes */}
            <Route
              path="/select-workspace"
              element={
                <ProtectedRoute>
                  <SelectWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* M02 Company Workspace Scoped Routes */}
            <Route
              path="/app/:companySlug"
              element={
                <ProtectedRoute>
                  <WorkspaceRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/dashboard"
              element={
                <ProtectedRoute>
                  <WorkspaceRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/overview"
              element={
                <ProtectedRoute>
                  <WorkspaceOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/projects"
              element={
                <ProtectedRoute>
                  <ProjectManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/projects/create"
              element={
                <ProtectedRoute>
                  <ProjectCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/projects/new"
              element={
                <ProtectedRoute>
                  <ProjectCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/tasks"
              element={
                <ProtectedRoute>
                  <TaskManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/tasks/create"
              element={
                <ProtectedRoute>
                  <TaskCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/tasks/new"
              element={
                <ProtectedRoute>
                  <TaskCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/files"
              element={
                <ProtectedRoute>
                  <FileManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/docs"
              element={
                <ProtectedRoute>
                  <FileManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/time"
              element={
                <ProtectedRoute>
                  <TimeTrackingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/download-tracker"
              element={
                <ProtectedRoute>
                  <DownloadTrackerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/tracker/download"
              element={
                <ProtectedRoute>
                  <DownloadTrackerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/attendance"
              element={
                <ProtectedRoute>
                  <AttendanceLeavePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/monitoring"
              element={
                <ProtectedRoute>
                  <MonitoringIntelligencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/clients"
              element={
                <ProtectedRoute>
                  <ClientManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/collaboration"
              element={
                <ProtectedRoute>
                  <CollaborationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/messages"
              element={
                <ProtectedRoute>
                  <CollaborationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/meet/:roomId"
              element={
                <ProtectedRoute>
                  <CollaborationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meet/:roomId"
              element={
                <ProtectedRoute>
                  <CollaborationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/performance"
              element={
                <ProtectedRoute>
                  <PerformanceManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/finance"
              element={
                <ProtectedRoute>
                  <FinanceManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/portal/:clientId"
              element={
                <ProtectedRoute>
                  <ClientPortalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/:clientId"
              element={
                <ProtectedRoute>
                  <ClientPortalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/employees"
              element={
                <ProtectedRoute>
                  <EmployeeDirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/employees/create"
              element={
                <ProtectedRoute>
                  <EmployeeCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/employees/new"
              element={
                <ProtectedRoute>
                  <EmployeeCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/departments"
              element={
                <ProtectedRoute>
                  <DepartmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/roles"
              element={
                <ProtectedRoute>
                  <RolesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/settings"
              element={
                <ProtectedRoute>
                  <CompanySettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:companySlug/audit"
              element={
                <ProtectedRoute>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />

            {/* M13: Reporting & Analytics Redirect to Unified Analytics Hub */}
            <Route
              path="/app/:companySlug/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsRedirect />
                </ProtectedRoute>
              }
            />

            {/* M14: Subscription Billing */}
            <Route
              path="/app/:companySlug/billing"
              element={
                <ProtectedRoute>
                  <SubscriptionBillingPage />
                </ProtectedRoute>
              }
            />

            {/* M15: Integrations Platform */}
            <Route
              path="/app/:companySlug/integrations"
              element={
                <ProtectedRoute>
                  <IntegrationsHubPage />
                </ProtectedRoute>
              }
            />

            {/* M16: SaaS Platform Administration */}
            <Route
              path="/app/:companySlug/platform-admin"
              element={
                <ProtectedRoute>
                  <PlatformAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/platform-admin"
              element={
                <ProtectedRoute>
                  <PlatformAdminPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ConfirmationModalProvider>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

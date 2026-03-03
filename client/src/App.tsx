import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, Suspense, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RoleThemeProvider } from "@/components/role-theme-provider";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import { WorkspaceAccessGuard } from "@/components/workspace-access-guard";
import { WorkspaceRibbon } from "@/components/workspace-ribbon";
import { TrialBanner } from "@/components/trial-banner";

import { ErrorBoundary } from "@/components/error-boundary";
import { EnforcementProvider } from "@/lib/enforcement-context";

function retryImport<T>(importFn: () => Promise<T>, retries = 3): Promise<T> {
  return importFn().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<T>((resolve) =>
      setTimeout(() => resolve(retryImport(importFn, retries - 1)), 1000)
    );
  });
}

// Lazy-loaded pages for code splitting (performance optimization)
const Planning = lazy(() => retryImport(() => import("@/pages/planning")));
const PrePlanning = lazy(() => retryImport(() => import("@/pages/pre-planning")));
const FirmWideControlsLazy = lazy(() => retryImport(() => import("@/pages/firm-wide-controls")));
const InformationRequisition = lazy(() => retryImport(() => import("@/pages/information-requisition")));
const FSHeadsPage = lazy(() => retryImport(() => import("@/pages/fs-heads")));
const Finalization = lazy(() => retryImport(() => import("@/pages/finalization")));
const Execution = lazy(() => retryImport(() => import("@/pages/execution")));
const ImportWizard = lazy(() => retryImport(() => import("@/pages/import-wizard")));
const NewEngagement = lazy(() => retryImport(() => import("@/pages/new-engagement")));
const EngagementDetail = lazy(() => retryImport(() => import("@/pages/engagement-detail")));
const PhaseView = lazy(() => retryImport(() => import("@/pages/phase-view")));
const ClientOnboarding = lazy(() => retryImport(() => import("@/pages/client-onboarding")));
const ClientList = lazy(() => retryImport(() => import("@/pages/client-list")));
const ClientDetail = lazy(() => retryImport(() => import("@/pages/client-detail")));
const EthicsIndependence = lazy(() => retryImport(() => import("@/pages/ethics-independence")));
const EvidenceVault = lazy(() => retryImport(() => import("@/pages/evidence-vault")));
const EQCR = lazy(() => retryImport(() => import("@/pages/eqcr")));
const Inspection = lazy(() => retryImport(() => import("@/pages/inspection")));
const InspectionDashboard = lazy(() => retryImport(() => import("@/pages/inspection-dashboard")));
const AuditHealthDashboard = lazy(() => retryImport(() => import("@/pages/audit-health-dashboard")));
const PrintView = lazy(() => retryImport(() => import("@/pages/print-view")));
const DevDashboard = lazy(() => retryImport(() => import("@/pages/dev-dashboard")));
const AdminDashboard = lazy(() => retryImport(() => import("@/pages/admin-dashboard")));
const UserManagement = lazy(() => retryImport(() => import("@/pages/user-management")));
const Administration = lazy(() => retryImport(() => import("@/pages/administration")));
const Engagements = lazy(() => retryImport(() => import("@/pages/engagements")));
const EngagementAllocation = lazy(() => retryImport(() => import("@/pages/engagement-allocation")));
const Reports = lazy(() => retryImport(() => import("@/pages/reports")));
const Settings = lazy(() => retryImport(() => import("@/pages/settings")));
const TBReview = lazy(() => retryImport(() => import("@/pages/tb-review")));
const PDFDocumentation = lazy(() => retryImport(() => import("@/pages/pdf-documentation")));
const UserGuide = lazy(() => retryImport(() => import("@/pages/user-guide")));
const DeploymentGuide = lazy(() => retryImport(() => import("@/pages/deployment-guide")));
const EngagementEdit = lazy(() => retryImport(() => import("@/pages/engagement-edit")));
const EngagementControl = lazy(() => retryImport(() => import("@/pages/engagement-control")));
const WorkflowHealthPage = lazy(() => retryImport(() => import("@/pages/WorkflowHealthPage")));
const PostUploadWorkflow = lazy(() => retryImport(() => import("@/pages/post-upload-workflow")));
const OutputsPage = lazy(() => retryImport(() => import("@/pages/outputs")));
const Observations = lazy(() => retryImport(() => import("@/pages/observations")));
const PortalLogin = lazy(() => retryImport(() => import("@/pages/portal-login")));
const PortalDashboard = lazy(() => retryImport(() => import("@/pages/portal-dashboard")));
const PortalRequests = lazy(() => retryImport(() => import("@/pages/portal-requests")));

const PricingPage = lazy(() => retryImport(() => import("@/pages/pricing")));
const SignupPage = lazy(() => retryImport(() => import("@/pages/signup")));
const InviteAcceptPage = lazy(() => retryImport(() => import("@/pages/invite-accept")));

const PlatformDashboard = lazy(() => retryImport(() => import("@/pages/platform/platform-dashboard")));
const FirmManagement = lazy(() => retryImport(() => import("@/pages/platform/firm-management")));
const PlanManagement = lazy(() => retryImport(() => import("@/pages/platform/plan-management")));
const PlatformNotifications = lazy(() => retryImport(() => import("@/pages/platform/platform-notifications")));
const PlatformAuditLogs = lazy(() => retryImport(() => import("@/pages/platform/platform-audit-logs")));
const PlatformAIConfig = lazy(() => retryImport(() => import("@/pages/platform/platform-ai-config")));
const FirmUsersPage = lazy(() => retryImport(() => import("@/pages/firm-admin/firm-users")));
const FirmSettingsPage = lazy(() => retryImport(() => import("@/pages/firm-admin/firm-settings")));
const FirmAuditLogsPage = lazy(() => retryImport(() => import("@/pages/firm-admin/firm-audit-logs")));
const FirmAIUsagePage = lazy(() => retryImport(() => import("@/pages/firm-admin/firm-ai-usage")));


// Wrapper for global lazy-loaded pages
const FirmWideControls = (props: any) => (
  <Suspense fallback={<LoadingSpinner />}>
    <FirmWideControlsLazy {...props} />
  </Suspense>
);

// Helper to wrap lazy components with Suspense for non-guarded routes
const withLazySuspense = (LazyComponent: React.LazyExoticComponent<any>) => (props: any) => (
  <Suspense fallback={<LoadingSpinner />}>
    <LazyComponent {...props} />
  </Suspense>
);

// Lazy page wrappers for global (non-guarded) routes
const ClientListLazy = withLazySuspense(ClientList);
const ClientOnboardingLazy = withLazySuspense(ClientOnboarding);
const ClientDetailLazy = withLazySuspense(ClientDetail);
const EngagementsLazy = withLazySuspense(Engagements);
const NewEngagementLazy = withLazySuspense(NewEngagement);
const EngagementDetailLazy = withLazySuspense(EngagementDetail);
const EngagementEditLazy = withLazySuspense(EngagementEdit);
const EngagementAllocationLazy = withLazySuspense(EngagementAllocation);
const PhaseViewLazy = withLazySuspense(PhaseView);
const PDFDocumentationLazy = withLazySuspense(PDFDocumentation);
const DevDashboardLazy = withLazySuspense(DevDashboard);
const AdminDashboardLazy = withLazySuspense(AdminDashboard);
const AdministrationLazy = withLazySuspense(Administration);
const UserManagementLazy = withLazySuspense(UserManagement);
const ReportsLazy = withLazySuspense(Reports);
const SettingsLazy = withLazySuspense(Settings);
const UserGuideLazy = withLazySuspense(UserGuide);
const DeploymentGuideLazy = withLazySuspense(DeploymentGuide);
const WorkflowHealthPageLazy = withLazySuspense(WorkflowHealthPage);
const PortalLoginLazy = withLazySuspense(PortalLogin);
const PortalDashboardLazy = withLazySuspense(PortalDashboard);
const PortalRequestsLazy = withLazySuspense(PortalRequests);
const PricingPageLazy = withLazySuspense(PricingPage);
const SignupPageLazy = withLazySuspense(SignupPage);
const InviteAcceptPageLazy = withLazySuspense(InviteAcceptPage);
const PlatformDashboardLazy = withLazySuspense(PlatformDashboard);
const FirmManagementLazy = withLazySuspense(FirmManagement);
const PlanManagementLazy = withLazySuspense(PlanManagement);
const PlatformNotificationsLazy = withLazySuspense(PlatformNotifications);
const PlatformAuditLogsLazy = withLazySuspense(PlatformAuditLogs);
const PlatformAIConfigLazy = withLazySuspense(PlatformAIConfig);
const FirmUsersLazy = withLazySuspense(FirmUsersPage);
const FirmSettingsLazy = withLazySuspense(FirmSettingsPage);
const FirmAuditLogsLazy = withLazySuspense(FirmAuditLogsPage);
const FirmAIUsageLazy = withLazySuspense(FirmAIUsagePage);

const StandardsMatrix = lazy(() => import("@/pages/standards-matrix"));
const GuardedStandardsMatrix = createGuardedComponent(StandardsMatrix, "StandardsMatrix", true);

function WorkspaceRedirect() {
  return <Redirect to="/engagements" />;
}

function LegacyRouteRedirect({ params }: { params?: { id?: string }; routePath: string }) {
  const engagementId = params?.id || "";
  if (!engagementId) {
    return <Redirect to="/engagements" />;
  }
  return null;
}

function createLegacyRedirect(legacyPath: string, workspacePath: string) {
  return function LegacyRedirectComponent({ params }: { params?: { id?: string } }) {
    const engagementId = params?.id || "";
    if (!engagementId) {
      return <Redirect to="/engagements" />;
    }
    return <Redirect to={`/workspace/${engagementId}/${workspacePath}`} />;
  };
}

function RoleGuard({ requiredRole, children }: { requiredRole: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const userRole = user?.role?.toUpperCase() || "";
  
  if (requiredRole === "SUPER_ADMIN" && userRole !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="access-denied">
        <div className="text-center space-y-3">
          <div className="text-4xl font-bold text-muted-foreground">403</div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">This area requires Super Admin privileges.</p>
          <a href="/" className="text-primary underline">Return to Dashboard</a>
        </div>
      </div>
    );
  }
  
  if (requiredRole === "FIRM_ADMIN" && userRole !== "FIRM_ADMIN" && userRole !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="access-denied">
        <div className="text-center space-y-3">
          <div className="text-4xl font-bold text-muted-foreground">403</div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">This area requires Firm Admin privileges.</p>
          <a href="/" className="text-primary underline">Return to Dashboard</a>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

function createRoleGuardedComponent(Component: React.LazyExoticComponent<any>, requiredRole: string) {
  return (props: any) => (
    <RoleGuard requiredRole={requiredRole}>
      <Suspense fallback={<LoadingSpinner />}>
        <Component {...props} />
      </Suspense>
    </RoleGuard>
  );
}

const GuardedPlatformDashboard = createRoleGuardedComponent(PlatformDashboard, "SUPER_ADMIN");
const GuardedFirmManagement = createRoleGuardedComponent(FirmManagement, "SUPER_ADMIN");
const GuardedPlanManagement = createRoleGuardedComponent(PlanManagement, "SUPER_ADMIN");
const GuardedPlatformNotifications = createRoleGuardedComponent(PlatformNotifications, "SUPER_ADMIN");
const GuardedPlatformAuditLogs = createRoleGuardedComponent(PlatformAuditLogs, "SUPER_ADMIN");
const GuardedPlatformAIConfig = createRoleGuardedComponent(PlatformAIConfig, "SUPER_ADMIN");
const GuardedFirmUsers = createRoleGuardedComponent(FirmUsersPage, "FIRM_ADMIN");
const GuardedFirmSettings = createRoleGuardedComponent(FirmSettingsPage, "FIRM_ADMIN");
const GuardedFirmAuditLogs = createRoleGuardedComponent(FirmAuditLogsPage, "FIRM_ADMIN");
const GuardedFirmAIUsage = createRoleGuardedComponent(FirmAIUsagePage, "FIRM_ADMIN");

function createGuardedComponent(Component: React.ComponentType<any>, displayName: string, isLazy = false) {
  const GuardedComponent = (props: { params?: { engagementId?: string } }) => {
    const engagementId = props.params?.engagementId || "";
    const content = <Component {...props} />;
    
    return (
      <WorkspaceAccessGuard engagementId={engagementId}>
        {isLazy ? <Suspense fallback={<LoadingSpinner />}>{content}</Suspense> : content}
      </WorkspaceAccessGuard>
    );
  };
  GuardedComponent.displayName = `Guarded${displayName}`;
  return GuardedComponent;
}

// Pre-create all guarded components at module level to avoid re-creation on every render
// Lazy-loaded pages are marked with isLazy=true
const GuardedInformationRequisition = createGuardedComponent(InformationRequisition, "InformationRequisition", true);
const GuardedPrePlanning = createGuardedComponent(PrePlanning, "PrePlanning", true);
const GuardedPlanning = createGuardedComponent(Planning, "Planning", true);
const GuardedExecution = createGuardedComponent(Execution, "Execution", true);
const GuardedFSHeadsPage = createGuardedComponent(FSHeadsPage, "FSHeadsPage", true);
const GuardedFinalization = createGuardedComponent(Finalization, "Finalization", true);
const GuardedPrintView = createGuardedComponent(PrintView, "PrintView", true);
const GuardedEQCR = createGuardedComponent(EQCR, "EQCR", true);
const GuardedEvidenceVault = createGuardedComponent(EvidenceVault, "EvidenceVault", true);
const GuardedInspection = createGuardedComponent(Inspection, "Inspection", true);
const GuardedInspectionDashboard = createGuardedComponent(InspectionDashboard, "InspectionDashboard", true);
const GuardedAuditHealthDashboard = createGuardedComponent(AuditHealthDashboard, "AuditHealthDashboard", true);
const GuardedEngagementControl = createGuardedComponent(EngagementControl, "EngagementControl", true);
const GuardedEthicsIndependence = createGuardedComponent(EthicsIndependence, "EthicsIndependence", true);
const GuardedTBReview = createGuardedComponent(TBReview, "TBReview", true);
const GuardedImportWizard = createGuardedComponent(ImportWizard, "ImportWizard", true);
const GuardedOutputsPage = createGuardedComponent(OutputsPage, "OutputsPage", true);

const GuardedObservations = createGuardedComponent(Observations, "Observations", true);
const GuardedPostUploadWorkflow = createGuardedComponent(PostUploadWorkflow, "PostUploadWorkflow", true);

function Router() {
  return (
    <Switch>
      {/* Global routes (no engagement context) */}
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clients" component={ClientListLazy} />
      <Route path="/clients/new" component={ClientOnboardingLazy} />
      <Route path="/clients/:id/edit" component={ClientOnboardingLazy} />
      <Route path="/clients/:id" component={ClientDetailLazy} />
      <Route path="/engagements" component={EngagementsLazy} />
      <Route path="/engagement/new" component={NewEngagementLazy} />
      <Route path="/engagement/:id/edit" component={EngagementEditLazy} />
      <Route path="/engagement/:id" component={EngagementDetailLazy} />
      <Route path="/allocation" component={EngagementAllocationLazy} />
      <Route path="/pdf-documentation" component={PDFDocumentationLazy} />
      <Route path="/dev" component={DevDashboardLazy} />
      <Route path="/admin" component={AdminDashboardLazy} />
      <Route path="/administration" component={AdministrationLazy} />
      <Route path="/users" component={UserManagementLazy} />
      <Route path="/firm-controls" component={FirmWideControls} />
      <Route path="/reports" component={ReportsLazy} />
      <Route path="/settings" component={SettingsLazy} />
      <Route path="/user-guide" component={UserGuideLazy} />
      <Route path="/deployment-guide" component={DeploymentGuideLazy} />
      <Route path="/phase/:phase" component={PhaseViewLazy} />

      {/* Platform Admin routes (SuperAdmin only - frontend role guard) */}
      <Route path="/platform" component={GuardedPlatformDashboard} />
      <Route path="/platform/firms" component={GuardedFirmManagement} />
      <Route path="/platform/plans" component={GuardedPlanManagement} />
      <Route path="/platform/notifications" component={GuardedPlatformNotifications} />
      <Route path="/platform/audit-logs" component={GuardedPlatformAuditLogs} />
      <Route path="/platform/ai-config" component={GuardedPlatformAIConfig} />

      {/* Firm Admin routes (FirmAdmin+ role guard) */}
      <Route path="/firm-admin" component={GuardedFirmSettings} />
      <Route path="/firm-admin/users" component={GuardedFirmUsers} />
      <Route path="/firm-admin/settings" component={GuardedFirmSettings} />
      <Route path="/firm-admin/audit-logs" component={GuardedFirmAuditLogs} />
      <Route path="/firm-admin/ai-usage" component={GuardedFirmAIUsage} />
      
      {/* Redirect bare /workspace to engagements */}
      <Route path="/workspace" component={WorkspaceRedirect} />
      
      {/* Workspace routes (require engagementId + access check) */}
      <Route path="/workspace/:engagementId/requisition" component={GuardedInformationRequisition} />
      <Route path="/workspace/:engagementId/pre-planning" component={GuardedPrePlanning} />
      <Route path="/workspace/:engagementId/planning" component={GuardedPlanning} />
      <Route path="/workspace/:engagementId/execution" component={GuardedExecution} />
      <Route path="/workspace/:engagementId/fs-heads" component={GuardedFSHeadsPage} />
      <Route path="/workspace/:engagementId/finalization" component={GuardedFinalization} />
      <Route path="/workspace/:engagementId/deliverables" component={GuardedPrintView} />
      <Route path="/workspace/:engagementId/eqcr" component={GuardedEQCR} />
      <Route path="/workspace/:engagementId/evidence" component={GuardedEvidenceVault} />
      <Route path="/workspace/:engagementId/inspection" component={GuardedInspection} />
      <Route path="/workspace/:engagementId/qcr-dashboard" component={GuardedInspectionDashboard} />
      <Route path="/workspace/:engagementId/audit-health" component={GuardedAuditHealthDashboard} />
      <Route path="/workspace/:engagementId/workflow-health" component={WorkflowHealthPageLazy} />
      <Route path="/workspace/:engagementId/onboarding" component={GuardedEngagementControl} />
      <Route path="/workspace/:engagementId/control" component={GuardedEngagementControl} />
      <Route path="/workspace/:engagementId/ethics" component={GuardedEthicsIndependence} />
      <Route path="/workspace/:engagementId/tb-review" component={GuardedTBReview} />

      <Route path="/workspace/:engagementId/import" component={GuardedImportWizard} />
      <Route path="/workspace/:engagementId/outputs" component={GuardedOutputsPage} />
      <Route path="/workspace/:engagementId/observations" component={GuardedObservations} />
      <Route path="/workspace/:engagementId/post-upload-workflow" component={GuardedPostUploadWorkflow} />
      <Route path="/workspace/:engagementId/standards-matrix" component={GuardedStandardsMatrix} />
      
      {/* Legacy routes - redirect to workspace with access guard */}
      <Route path="/engagement/:id/information-requisition" component={createLegacyRedirect("information-requisition", "requisition")} />
      <Route path="/engagement/:id/pre-planning" component={createLegacyRedirect("pre-planning", "pre-planning")} />
      <Route path="/engagement/:id/planning" component={createLegacyRedirect("planning", "planning")} />
      <Route path="/engagement/:id/execution" component={createLegacyRedirect("execution", "execution")} />
      <Route path="/engagement/:id/controls" component={createLegacyRedirect("controls", "execution")} />
      <Route path="/engagement/:id/substantive" component={createLegacyRedirect("substantive", "execution")} />
      <Route path="/engagement/:id/analytical" component={createLegacyRedirect("analytical", "execution")} />
      <Route path="/engagement/:id/finalization" component={createLegacyRedirect("finalization", "finalization")} />
      <Route path="/engagement/:id/print" component={createLegacyRedirect("print", "deliverables")} />
      <Route path="/engagement/:id/eqcr" component={createLegacyRedirect("eqcr", "eqcr")} />
      <Route path="/engagement/:id/evidence" component={createLegacyRedirect("evidence", "evidence")} />
      <Route path="/engagement/:id/inspection" component={createLegacyRedirect("inspection", "inspection")} />
      <Route path="/engagement/:id/onboarding" component={createLegacyRedirect("onboarding", "onboarding")} />
      <Route path="/engagement/:id/control" component={createLegacyRedirect("control", "control")} />
      <Route path="/engagement/:id/ethics" component={createLegacyRedirect("ethics", "ethics")} />
      <Route path="/engagement/:id/tb-review" component={createLegacyRedirect("tb-review", "tb-review")} />
      <Route path="/engagement/:id/fs-heads" component={createLegacyRedirect("fs-heads", "fs-heads")} />

      <Route path="/engagement/:id/observations" component={createLegacyRedirect("observations", "observations")} />
      <Route path="/engagement/:id/outputs" component={createLegacyRedirect("outputs", "outputs")} />
      <Route path="/engagement/:id/deliverables" component={createLegacyRedirect("deliverables", "deliverables")} />
      <Route path="/engagement/:id/evidence-vault" component={createLegacyRedirect("evidence-vault", "evidence")} />
      <Route path="/engagement/:id/audit-health" component={createLegacyRedirect("audit-health", "audit-health")} />
      <Route path="/engagement/:id/workflow-health" component={createLegacyRedirect("workflow-health", "workflow-health")} />
      <Route path="/engagement/:id/post-upload-workflow" component={createLegacyRedirect("post-upload-workflow", "post-upload-workflow")} />
      <Route path="/engagement/:id/qcr-dashboard" component={createLegacyRedirect("qcr-dashboard", "qcr-dashboard")} />
      <Route path="/engagement/:id/import" component={createLegacyRedirect("import", "import")} />
      <Route path="/engagement/:id/requisition" component={createLegacyRedirect("requisition", "requisition")} />
      
      {/* Standalone workspace routes - redirect to engagements */}
      <Route path="/pre-planning" component={withLazySuspense(PrePlanning)} />
      <Route path="/information-requisition" component={withLazySuspense(InformationRequisition)} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function EnforcedAppContent({ user, firm, sidebarStyle, initials }: { 
  user: any; 
  firm: any; 
  sidebarStyle: React.CSSProperties;
  initials: string;
}) {
  const { activeEngagement } = useWorkspace();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onToggleHelp: () => setShortcutsOpen(prev => !prev),
    engagementId: activeEngagement?.id || null,
  });
  
  return (
    <EnforcementProvider engagementId={activeEngagement?.id || null}>
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full">
          <AppSidebar
            currentUser={{
              name: user?.fullName || "User",
              role: user?.role?.toLowerCase() || "staff",
              initials,
            }}
          />
          <div className="flex flex-col flex-1 min-w-0">
            <TopBar
              clientName={firm?.name || "Select Engagement"}
              engagementId=""
              currentPhase="onboarding"
              phaseStatus="not_started"
            />
            <TrialBanner />
            <WorkspaceRibbon />
            
            <main className="flex-1 overflow-auto bg-background">
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </SidebarProvider>
    </EnforcementProvider>
  );
}

function AppLayout() {
  const { user, firm } = useAuth();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  const initials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <WorkspaceProvider>
        <EnforcedAppContent 
          user={user} 
          firm={firm} 
          sidebarStyle={sidebarStyle} 
          initials={initials}
        />
    </WorkspaceProvider>
  );
}

function AuthenticatedApp() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <RoleThemeProvider>
      <AppLayout />
    </RoleThemeProvider>
  );
}

function PortalRouter() {
  return (
    <Switch>
      <Route path="/portal/login" component={PortalLoginLazy} />
      <Route path="/portal/dashboard" component={PortalDashboardLazy} />
      <Route path="/portal/engagement/:id" component={PortalRequestsLazy} />
      <Route component={PortalLoginLazy} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isPortalRoute = location.startsWith("/portal");
  const isPublicRoute = location === "/pricing" || location.startsWith("/signup") || location.startsWith("/invite/");

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {isPortalRoute ? (
            <PortalRouter />
          ) : isPublicRoute ? (
            <Switch>
              <Route path="/pricing" component={PricingPageLazy} />
              <Route path="/signup" component={SignupPageLazy} />
              <Route path="/invite/:token" component={InviteAcceptPageLazy} />
            </Switch>
          ) : (
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

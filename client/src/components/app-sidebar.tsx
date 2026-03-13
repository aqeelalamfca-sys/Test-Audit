import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Building2,
  FileText,
  UserCheck,
  Shield,
  ShieldCheck,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  ListChecks,
  ArrowLeft,
  BookOpen,
  Scale,
  Play,
  CheckCircle2,
  FileOutput,
  Search,
  Bell,
  Bot,
  Crown,
  Rocket,
  MessageSquare,
  Banknote,
  Upload,
  CheckSquare,
  Map,
  Calculator,
  AlertTriangle,
  Compass,
  TestTube,
  Link2,
  Eye,
  PenTool,
  Gavel,
  Archive,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useWorkspace, WORKSPACE_PHASES, isPhaseVisible } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { EngagementHealthPanel } from "@/components/engagement-health-panel";
import { useRoleTheme } from "@/components/role-theme-provider";
import {
  getRoleActiveItemClasses,
  getRoleIconClasses,
  getRoleBadgeClasses,
  getRoleSidebarClasses,
  getRoleDisplayLabel,
} from "@/lib/role-theme";

interface AppSidebarProps {
  currentUser?: {
    name: string;
    role: string;
    initials: string;
  };
}

import {
  PHASE_GROUP_ORDER,
  PHASE_GROUP_LABELS,
} from "../../../shared/phases";

const WORKSPACE_PHASE_ICONS: Record<string, React.ElementType> = {
  "acceptance": ClipboardList,
  "independence": Shield,
  "tb-gl-upload": Upload,
  "validation": CheckSquare,
  "coa-mapping": Map,
  "materiality": Calculator,
  "risk-assessment": AlertTriangle,
  "planning-strategy": Compass,
  "procedures-sampling": ListChecks,
  "execution-testing": Play,
  "evidence-linking": Link2,
  "observations": Eye,
  "adjustments": PenTool,
  "finalization": CheckCircle2,
  "opinion-reports": FileOutput,
  "eqcr": UserCheck,
  "inspection": Archive,
};

export function AppSidebar({ currentUser }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, firm } = useAuth();
  const { theme } = useRoleTheme();
  const { activeEngagement, isInWorkspaceMode, getWorkspaceHref, exitWorkspace, currentEngagementId } = useWorkspace();

  const userRole = user?.role?.toLowerCase() || currentUser?.role?.toLowerCase() || "staff";
  const isAdmin = userRole === "admin" || userRole === "partner" || userRole === "managing_partner" || userRole === "firm_admin";
  const isManager = userRole === "manager" || isAdmin;
  const isSuperAdmin = userRole === "super_admin";
  const isFirmAdmin = userRole === "firm_admin";

  const isWorkspaceRoute = location.startsWith("/workspace/");

  const sidebarClasses = getRoleSidebarClasses(theme);
  const activeClasses = getRoleActiveItemClasses(theme);
  const iconClasses = getRoleIconClasses(theme);
  const badgeClasses = getRoleBadgeClasses(theme);

  const { data: reviewNoteStats } = useQuery({
    queryKey: ["/api/review-notes-v2/stats/summary"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/review-notes-v2/stats/summary");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
    enabled: !isSuperAdmin,
  });
  const pendingReviewNotes = (reviewNoteStats?.myOpen || 0) + (reviewNoteStats?.createdOpen || 0);

  const sectionLabel = isSuperAdmin ? "Platform Admin" : isFirmAdmin ? "Firm Administration" : "";
  const headerSubtitle = isSuperAdmin ? "Platform Control" : isFirmAdmin ? "Firm Administration" : "Statutory Audit";
  const headerInitials = isSuperAdmin ? "SA" : isFirmAdmin ? "FA" : "AW";
  const homeLink = isSuperAdmin ? "/platform" : isFirmAdmin ? "/firm-admin/settings" : "/";
  const firmLogoUrl = firm?.logoUrl || null;

  return (
    <Sidebar className={`border-r ${sidebarClasses.border}`}>
      <SidebarHeader className={`border-b px-4 py-3 ${sidebarClasses.border} ${sidebarClasses.headerBg}`}>
        <Link href={homeLink} className="flex items-center gap-2.5" data-testid="link-home">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0 ${theme.avatarBg} ${theme.avatarText}`}>
            {headerInitials}
          </div>
          <div className="min-w-0">
            <h1 className={`text-sm font-semibold leading-tight tracking-tight ${theme.iconColor} ${theme.iconColorDark}`}>
              AuditWise
            </h1>
            <p className={`text-[11px] leading-tight truncate text-muted-foreground`}>
              {headerSubtitle}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isWorkspaceRoute ? (
          <>
            <div className="px-2 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={exitWorkspace}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Engagements
              </Button>
            </div>

            <div className="border-b border-sidebar-border mx-2">
              <EngagementHealthPanel slot="top" />
            </div>

            {(() => {
              const role = user?.role?.toUpperCase() || currentUser?.role?.toUpperCase() || "STAFF";
              const visiblePhases = WORKSPACE_PHASES.filter(p => isPhaseVisible(p.key, role));
              const groups = PHASE_GROUP_ORDER
                .map(g => PHASE_GROUP_LABELS[g] || g)
                .filter(g => visiblePhases.some(p => p.group === g));

              return groups.map(groupLabel => (
                <SidebarGroup key={groupLabel}>
                  <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {groupLabel}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visiblePhases
                        .filter(phase => phase.group === groupLabel)
                        .map(phase => {
                          const Icon = WORKSPACE_PHASE_ICONS[phase.key] || FileText;
                          const href = getWorkspaceHref(phase.key);
                          const isActive = location.includes(`/${phase.key}`);
                          return (
                            <SidebarMenuItem key={phase.key}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                data-testid={`nav-${phase.key}`}
                              >
                                <Link href={href}>
                                  <Icon className="h-4 w-4" />
                                  <span>{phase.label}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ));
            })()}

            <div className="border-t border-sidebar-border mx-2">
              <EngagementHealthPanel slot="bottom" />
            </div>
          </>
        ) : isSuperAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className={`px-2 text-xs font-medium uppercase tracking-wide ${theme.groupLabelColor} ${theme.groupLabelColorDark}`}>
                <Crown className="h-3 w-3 inline mr-1" />
                Platform Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform" || location === "/"}
                      data-testid="nav-platform-dashboard"
                      className={activeClasses}
                    >
                      <Link href="/platform">
                        <LayoutDashboard className={`h-4 w-4 ${iconClasses}`} />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/firms"}
                      data-testid="nav-platform-firms"
                      className={activeClasses}
                    >
                      <Link href="/platform/firms">
                        <Building2 className={`h-4 w-4 ${iconClasses}`} />
                        <span>Firm Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/plans"}
                      data-testid="nav-platform-plans"
                      className={activeClasses}
                    >
                      <Link href="/platform/plans">
                        <BarChart3 className={`h-4 w-4 ${iconClasses}`} />
                        <span>Plan Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/billing"}
                      data-testid="nav-platform-billing"
                      className={activeClasses}
                    >
                      <Link href="/platform/billing">
                        <Banknote className={`h-4 w-4 ${iconClasses}`} />
                        <span>Billing Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/notifications"}
                      data-testid="nav-platform-notifications"
                      className={activeClasses}
                    >
                      <Link href="/platform/notifications">
                        <Bell className={`h-4 w-4 ${iconClasses}`} />
                        <span>Notifications</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/audit-logs"}
                      data-testid="nav-platform-audit-logs"
                      className={activeClasses}
                    >
                      <Link href="/platform/audit-logs">
                        <FileText className={`h-4 w-4 ${iconClasses}`} />
                        <span>Audit Logs</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/ai-config"}
                      data-testid="nav-platform-ai-config"
                      className={activeClasses}
                    >
                      <Link href="/platform/ai-config">
                        <Bot className={`h-4 w-4 ${iconClasses}`} />
                        <span>AI Configuration</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/feedback"}
                      data-testid="nav-platform-feedback"
                      className={activeClasses}
                    >
                      <Link href="/platform/feedback">
                        <MessageSquare className={`h-4 w-4 ${iconClasses}`} />
                        <span>Firm Feedback</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/legal-acceptances"}
                      data-testid="nav-platform-legal-acceptances"
                      className={activeClasses}
                    >
                      <Link href="/platform/legal-acceptances">
                        <FileText className={`h-4 w-4 ${iconClasses}`} />
                        <span>Legal Acceptances</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/deployment-guide"}
                      data-testid="nav-deployment-guide"
                      className={activeClasses}
                    >
                      <Link href="/deployment-guide">
                        <Rocket className={`h-4 w-4 ${iconClasses}`} />
                        <span>Deployment Guide</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Overview
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/" || location === "/dashboard"}
                      data-testid="nav-home"
                    >
                      <Link href="/">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Home</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith("/clients")}
                      data-testid="nav-clients"
                    >
                      <Link href="/clients">
                        <Building2 className="h-4 w-4" />
                        <span>Clients</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/engagements"}
                      data-testid="nav-engagements"
                    >
                      <Link href="/engagements">
                        <FileText className="h-4 w-4" />
                        <span>Engagements</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/review-notes"}
                      data-testid="nav-review-notes"
                    >
                      <Link href="/review-notes">
                        <MessageSquare className="h-4 w-4" />
                        <span>Review Notes</span>
                        {pendingReviewNotes > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {pendingReviewNotes > 99 ? "99+" : pendingReviewNotes}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/allocation"}
                        data-testid="nav-allocation"
                      >
                        <Link href="/allocation">
                          <UserCheck className="h-4 w-4" />
                          <span>Engagement Allocation</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-controls"}
                        data-testid="nav-firm-controls"
                      >
                        <Link href="/firm-controls">
                          <ShieldCheck className="h-4 w-4" />
                          <span>Firm Wide Controls</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isFirmAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-admin/settings" || location === "/firm-admin"}
                        data-testid="nav-firm-settings"
                      >
                        <Link href="/firm-admin/settings">
                          <Settings className="h-4 w-4" />
                          <span>Firm Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {!isFirmAdmin && isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/administration"}
                        data-testid="nav-administration"
                      >
                        <Link href="/administration">
                          <Shield className="h-4 w-4" />
                          <span>Firm Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isFirmAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-admin/users"}
                        data-testid="nav-firm-users"
                      >
                        <Link href="/firm-admin/users">
                          <Users className="h-4 w-4" />
                          <span>User Management</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {!isFirmAdmin && isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/users"}
                        data-testid="nav-users"
                      >
                        <Link href="/users">
                          <Users className="h-4 w-4" />
                          <span>Users & Roles</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-admin/control-compliance-log"}
                        data-testid="nav-control-compliance-log"
                      >
                        <Link href="/firm-admin/control-compliance-log">
                          <ClipboardList className="h-4 w-4" />
                          <span>Control Compliance Log</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/reports"}
                      data-testid="nav-reports"
                    >
                      <Link href="/reports">
                        <BarChart3 className="h-4 w-4" />
                        <span>Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/secp-compliance"}
                      data-testid="nav-secp-compliance"
                    >
                      <Link href="/secp-compliance">
                        <Scale className="h-4 w-4" />
                        <span>SECP Compliance</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/fbr-documentation"}
                      data-testid="nav-fbr-documentation"
                    >
                      <Link href="/fbr-documentation">
                        <FileText className="h-4 w-4" />
                        <span>FBR Documentation</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isFirmAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-admin/audit-logs"}
                        data-testid="nav-firm-audit-logs"
                      >
                        <Link href="/firm-admin/audit-logs">
                          <FileText className="h-4 w-4" />
                          <span>Audit Logs</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isFirmAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/firm-admin/ai-usage"}
                        data-testid="nav-firm-ai-usage"
                      >
                        <Link href="/firm-admin/ai-usage">
                          <Bot className="h-4 w-4" />
                          <span>AI Integration</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className={`border-t px-3 py-2.5 ${sidebarClasses.border} ${sidebarClasses.footerBg}`}>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className={`text-xs font-medium ${theme.avatarBg} ${theme.avatarText}`}>
              {currentUser?.initials || "JD"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {currentUser?.name || "John Doe"}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold ${badgeClasses}`}
              data-testid={`badge-role-${userRole}`}
            >
              {getRoleDisplayLabel(userRole).toUpperCase()}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

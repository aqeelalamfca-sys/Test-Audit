import React from "react";
import { Link, useLocation } from "wouter";
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
  FolderOpen,
  Shield,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  ArrowLeft,
  Layers,
  BookOpen,
  Target,
  Play,
  CheckCircle2,
  FileOutput,
  Search,
  Bell,
  Bot,
  Crown,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth";
import { useWorkspace, WORKSPACE_PHASES, isPhaseVisible } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { EngagementHealthPanel } from "@/components/engagement-health-panel";

interface AppSidebarProps {
  currentUser?: {
    name: string;
    role: string;
    initials: string;
  };
}

const WORKSPACE_PHASE_ICONS: Record<string, React.ElementType> = {
  "requisition": FileText,
  "pre-planning": ClipboardList,
  "planning": Target,
  "execution": Play,
  "fs-heads": Layers,
  "evidence": FolderOpen,
  "finalization": CheckCircle2,
  "deliverables": FileOutput,
  "eqcr": CheckCircle2,
  "inspection": Search,
};

export function AppSidebar({ currentUser }: AppSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { activeEngagement, isInWorkspaceMode, getWorkspaceHref, exitWorkspace, currentEngagementId } = useWorkspace();

  const userRole = user?.role?.toLowerCase() || currentUser?.role?.toLowerCase() || "staff";
  const isAdmin = userRole === "admin" || userRole === "partner" || userRole === "managing_partner" || userRole === "firm_admin";
  const isManager = userRole === "manager" || isAdmin;
  const isSuperAdmin = userRole === "super_admin";
  const isFirmAdmin = userRole === "firm_admin";

  const isWorkspaceRoute = location.startsWith("/workspace/");

  return (
    <Sidebar className={`border-r ${isSuperAdmin ? 'border-red-200 dark:border-red-900' : 'border-sidebar-border'}`}>
      <SidebarHeader className={`border-b px-4 py-4 ${isSuperAdmin ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30' : 'border-sidebar-border'}`}>
        <Link href={isSuperAdmin ? "/platform" : "/"} className="flex items-center gap-3" data-testid="link-home">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-lg ${isSuperAdmin ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground'}`}>
            {isSuperAdmin ? "SA" : "AW"}
          </div>
          <div>
            <h1 className={`text-lg font-semibold ${isSuperAdmin ? 'text-red-700 dark:text-red-400' : 'text-sidebar-foreground'}`}>
              {isSuperAdmin ? "AuditWise" : "AuditWise"}
            </h1>
            <p className={`text-xs ${isSuperAdmin ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
              {isSuperAdmin ? "Platform Control" : "Statutory Audit"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isWorkspaceRoute ? (
          <>
            {/* Workspace Mode: Back to Engagements button */}
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

            {/* Workspace Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit Lifecycle
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {WORKSPACE_PHASES.filter((phase) => {
                    const role = user?.role?.toUpperCase() || currentUser?.role?.toUpperCase() || "STAFF";
                    return isPhaseVisible(phase.key, role);
                  }).map((phase) => {
                    const Icon = WORKSPACE_PHASE_ICONS[phase.key] || FileText;
                    const href = getWorkspaceHref(phase.key);
                    const isActive = location.includes(`/${phase.key}`) ||
                      (phase.key === "requisition" && location.includes("/requisition"));
                    
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

            <div className="border-t border-sidebar-border mx-2">
              <EngagementHealthPanel slot="bottom" />
            </div>
          </>
        ) : isSuperAdmin ? (
          <>
            {/* SuperAdmin: Platform Admin Only */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
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
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform">
                        <LayoutDashboard className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/firms"}
                      data-testid="nav-platform-firms"
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform/firms">
                        <Building2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>Firm Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/plans"}
                      data-testid="nav-platform-plans"
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform/plans">
                        <BarChart3 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>Plan Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/notifications"}
                      data-testid="nav-platform-notifications"
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform/notifications">
                        <Bell className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>Notifications</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/audit-logs"}
                      data-testid="nav-platform-audit-logs"
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform/audit-logs">
                        <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>Audit Logs</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/platform/ai-config"}
                      data-testid="nav-platform-ai-config"
                      className="data-[active=true]:bg-red-100 data-[active=true]:text-red-800 dark:data-[active=true]:bg-red-950 dark:data-[active=true]:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <Link href="/platform/ai-config">
                        <Bot className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span>AI Configuration</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            {/* Global Mode: Overview Section */}
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Global Mode: Administration Section */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isAdmin && (
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
                  {isAdmin && (
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
                      isActive={location === "/settings"}
                      data-testid="nav-settings"
                    >
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        <span>Admin Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isFirmAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Firm Administration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/firm-admin/users"} data-testid="nav-firm-users">
                        <Link href="/firm-admin/users">
                          <Users className="h-4 w-4" />
                          <span>User Management</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/firm-admin/settings" || location === "/firm-admin"} data-testid="nav-firm-settings">
                        <Link href="/firm-admin/settings">
                          <Settings className="h-4 w-4" />
                          <span>Firm Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/firm-admin/audit-logs"} data-testid="nav-firm-audit-logs">
                        <Link href="/firm-admin/audit-logs">
                          <FileText className="h-4 w-4" />
                          <span>Audit Logs</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/firm-admin/ai-usage"} data-testid="nav-firm-ai-usage">
                        <Link href="/firm-admin/ai-usage">
                          <Bot className="h-4 w-4" />
                          <span>AI Usage</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className={`border-t p-4 ${isSuperAdmin ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30' : 'border-sidebar-border'}`}>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            <AvatarFallback className={`text-sm font-medium ${isSuperAdmin ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground'}`}>
              {currentUser?.initials || "JD"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentUser?.name || "John Doe"}
            </p>
            {isSuperAdmin ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" data-testid="badge-super-admin">
                SUPER ADMIN
              </span>
            ) : (
              <RoleBadge role={currentUser?.role || "partner"} />
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

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
  const isAdmin = userRole === "admin" || userRole === "partner" || userRole === "managing_partner";
  const isManager = userRole === "manager" || isAdmin;

  const isWorkspaceRoute = location.startsWith("/workspace/");

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3" data-testid="link-home">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            AW
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">AuditWise</h1>
            <p className="text-xs text-muted-foreground">Statutory Audit</p>
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
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {currentUser?.initials || "JD"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentUser?.name || "John Doe"}
            </p>
            <RoleBadge role={currentUser?.role || "partner"} />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

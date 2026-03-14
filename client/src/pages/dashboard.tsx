import { useQuery } from "@tanstack/react-query";
import { EngagementLink } from "@/components/engagement-link";
import { CreateClientDialog } from "@/components/create-client-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatusBadge,
  type EntityStatus,
  type SectionStatus,
} from "@/components/ui/visual-indicators";
import {
  Building2,
  FileText,
  UserCheck,
  Plus,
  Eye,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  PlayCircle,
  ClipboardCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  ntn?: string;
  entityType?: string;
  industry?: string;
  sizeClassification?: string;
  lifecycleStatus?: string;
  status: string;
}

interface Engagement {
  id: string;
  engagementCode?: string;
  clientName?: string;
  client?: {
    id: string;
    name: string;
  };
  engagementType?: string;
  periodFrom?: string;
  periodTo?: string;
  partner?: string;
  manager?: string;
  status: string;
  currentPhase?: string;
  dueDate?: string;
  fiscalYearEnd?: string;
  team?: Array<{
    userId: string;
    role: string;
    user?: {
      id: string;
      fullName: string;
    };
  }>;
}

interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
}


const mapStatusToEntityStatus = (status: string): EntityStatus => {
  const normalized = status.toUpperCase();
  if (normalized === "APPROVED" || normalized === "COMPLETED") return "APPROVED";
  if (normalized === "REVIEWED" || normalized === "PENDING_REVIEW") return "REVIEWED";
  if (normalized === "PREPARED" || normalized === "IN_PROGRESS" || normalized === "ACTIVE") return "PREPARED";
  return "DRAFT";
};

const mapStatusToSectionStatus = (status: string): SectionStatus => {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED" || normalized === "APPROVED") return "COMPLETE";
  if (normalized === "IN_PROGRESS" || normalized === "ACTIVE" || normalized === "PREPARED") return "IN_PROGRESS";
  if (normalized === "BLOCKED") return "BLOCKED";
  return "NOT_STARTED";
};

const getStatusBadge = (status: string) => {
  const entityStatus = mapStatusToEntityStatus(status);
  return <StatusBadge status={entityStatus} showTooltip={false} size="sm" />;
};

const getRoleBadge = (role: string) => {
  switch (role.toLowerCase()) {
    case "partner":
      return <Badge className="bg-purple-100 text-purple-700 border-0">Partner</Badge>;
    case "manager":
      return <Badge className="bg-blue-100 text-blue-700 border-0">Manager</Badge>;
    case "reviewer":
    case "eqcr":
      return <Badge className="bg-orange-100 text-orange-700 border-0">Reviewer</Badge>;
    case "team":
    case "staff":
    case "senior":
      return <Badge className="bg-green-100 text-green-700 border-0">Team</Badge>;
    default:
      return <Badge variant="secondary">{role}</Badge>;
  }
};


const getPhaseRoute = (engagementId: string, phase: string): string => {
  const phaseLower = phase?.toLowerCase() || "";
  if (phaseLower.includes("requisition") || phaseLower === "information_requisition") {
    return `/workspace/${engagementId}/requisition`;
  }
  if (phaseLower.includes("pre-planning") || phaseLower === "pre_planning" || phaseLower === "preplanning") {
    return `/workspace/${engagementId}/pre-planning`;
  }
  if (phaseLower.includes("review") || phaseLower.includes("mapping")) {
    return `/workspace/${engagementId}/requisition?tab=review-coa&subtab=mapping`;
  }
  if (phaseLower.includes("planning")) {
    return `/workspace/${engagementId}/planning`;
  }
  if (phaseLower.includes("execution") || phaseLower.includes("fieldwork")) {
    return `/workspace/${engagementId}/execution`;
  }
  if (phaseLower.includes("fs-head") || phaseLower.includes("fs_head")) {
    return `/workspace/${engagementId}/fs-heads`;
  }
  if (phaseLower.includes("evidence")) {
    return `/workspace/${engagementId}/evidence`;
  }
  if (phaseLower.includes("output")) {
    return `/workspace/${engagementId}/outputs`;
  }
  if (phaseLower.includes("finalization")) {
    return `/workspace/${engagementId}/finalization`;
  }
  if (phaseLower.includes("deliverable") || phaseLower.includes("reporting")) {
    return `/workspace/${engagementId}/deliverables`;
  }
  if (phaseLower.includes("quality") || phaseLower.includes("eqcr")) {
    return `/workspace/${engagementId}/eqcr`;
  }
  if (phaseLower.includes("inspection")) {
    return `/workspace/${engagementId}/inspection`;
  }
  return `/workspace/${engagementId}/pre-planning`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userRole = user?.role?.toLowerCase() || "staff";
  const isAdmin = userRole === "admin" || userRole === "partner";
  const isManager = userRole === "manager" || isAdmin;

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: engagements } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const stats = {
    totalClients: clients?.length || 0,
    activeEngagements: engagements?.filter((e) => 
      e.status === "ACTIVE" || e.status === "planning" || e.status === "fieldwork" || e.status === "in_progress"
    ).length || 0,
    inProgressEngagements: engagements?.filter((e) => 
      e.status === "ACTIVE" || e.status === "in_progress"
    ).length || 0,
    pendingReviews: engagements?.filter((e) => e.status === "pending_review" || e.status === "PENDING_REVIEW").length || 0,
    completedEngagements: engagements?.filter((e) => e.status === "completed" || e.status === "COMPLETED").length || 0,
  };

  const myAssignments = engagements?.filter((e) => {
    if (!user?.id) return false;
    return e.team?.some((t) => t.userId === user.id || t.user?.id === user.id);
  }).map((e) => {
    const myTeamMember = e.team?.find((t) => t.userId === user?.id || t.user?.id === user?.id);
    return {
      id: e.id,
      engagementName: e.engagementCode || `${e.client?.name || e.clientName} Audit`,
      clientId: e.client?.id,
      clientName: e.client?.name || e.clientName || "Unknown Client",
      myRole: myTeamMember?.role || "Team",
      currentPhase: e.currentPhase || "Planning",
      dueDate: e.fiscalYearEnd ? new Date(e.fiscalYearEnd).toLocaleDateString() : "TBD",
      status: e.status?.toLowerCase() === "active" ? "in_progress" : e.status?.toLowerCase() || "not_started",
    };
  }) || [];

  const handleKPIClick = (route: string) => {
    setLocation(route);
  };

  const handleEngagementRowClick = (engagementId: string, phase: string, status: string) => {
    const route = getPhaseRoute(engagementId, phase);
    setLocation(route);
  };

  const handleClientCellClick = (e: React.MouseEvent, clientId?: string) => {
    e.stopPropagation();
    if (clientId) {
      setLocation(`/clients/${clientId}`);
    }
  };

  const handleOpenWorkspace = () => {
    if (myAssignments.length === 0) {
      toast({
        title: "No Assignments",
        description: "You have no engagements assigned. Please contact your manager.",
        variant: "destructive",
      });
      return;
    }
    const firstAssignment = myAssignments[0];
    const route = getPhaseRoute(firstAssignment.id, firstAssignment.currentPhase);
    setLocation(route);
  };

  const handleViewPendingReviews = () => {
    setLocation("/engagements?status=pending_review");
  };

  const handleAllocateEngagement = () => {
    setLocation("/allocation");
  };

  return (
    <div className="page-container pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {user?.fullName || "User"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenWorkspace} className="gap-2">
            <Briefcase className="h-4 w-4" />
            Open Workspace
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Clients", value: stats.totalClients, icon: Building2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", route: "/clients" },
          { label: "Active Engagements", value: stats.activeEngagements, icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", route: "/engagements?status=active" },
          { label: "In Progress", value: stats.inProgressEngagements, icon: PlayCircle, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20", route: "/engagements?status=in_progress" },
          { label: "Pending Reviews", value: stats.pendingReviews, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", route: "/engagements?status=pending_review" },
          { label: "Completed", value: stats.completedEngagements, icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20", route: "/engagements?status=completed" },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer hover:shadow-md transition-all border-border/60"
            onClick={() => handleKPIClick(kpi.route)}
          >
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className={`${kpi.bg} p-2 rounded-lg`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && (
          <CreateClientDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Add Client
              </Button>
            }
          />
        )}
        {isManager && (
          <Link href="/engagement/new">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-3.5 w-3.5" />
              New Engagement
            </Button>
          </Link>
        )}
        {isManager && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleAllocateEngagement}>
            <UserCheck className="h-3.5 w-3.5" />
            Allocate Team
          </Button>
        )}
        {(isAdmin || isManager) && stats.pendingReviews > 0 && (
          <Button variant="outline" size="sm" className="gap-2 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300" onClick={handleViewPendingReviews}>
            <Eye className="h-3.5 w-3.5" />
            {stats.pendingReviews} Pending Reviews
          </Button>
        )}
      </div>

      {/* My Assignments Table */}
      <Card className="shadow-sm">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">My Assignments</h2>
            {myAssignments.length > 0 && (
              <Badge variant="secondary" className="text-xs">{myAssignments.length}</Badge>
            )}
          </div>
          <Link href="/engagements">
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm">No assignments found</p>
                      <p className="text-xs text-muted-foreground">Engagements assigned to you will appear here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                myAssignments.map((assignment) => (
                  <TableRow 
                    key={assignment.id} 
                    className="cursor-pointer"
                    onClick={() => handleEngagementRowClick(assignment.id, assignment.currentPhase, assignment.status)}
                  >
                    <TableCell className="font-medium font-mono text-sm">
                      <EngagementLink
                        engagementId={assignment.id}
                        engagementCode={assignment.engagementName}
                        clientId={assignment.clientId}
                      />
                    </TableCell>
                    <TableCell>
                      <span 
                        className="hover:text-primary hover:underline cursor-pointer text-sm"
                        onClick={(e) => handleClientCellClick(e, assignment.clientId)}
                      >
                        {assignment.clientName}
                      </span>
                    </TableCell>
                    <TableCell>{getRoleBadge(assignment.myRole)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{assignment.currentPhase}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{assignment.dueDate}</TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent Activity</h2>
        </div>
        <CardContent className="py-2">
          <div className="flex flex-col items-center justify-center text-center">
            <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Activity tracking will appear here as you work</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

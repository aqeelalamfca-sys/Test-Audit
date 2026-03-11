import { useQuery } from "@tanstack/react-query";
import { EngagementLink } from "@/components/engagement-link";
import { CreateClientDialog } from "@/components/create-client-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  SectionIndicator,
  type EntityStatus,
  type SectionStatus,
} from "@/components/ui/visual-indicators";
import {
  Building2,
  FileText,
  Users,
  UserCheck,
  Plus,
  Search,
  Eye,
  Edit,
  FolderOpen,
  PlusCircle,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  PlayCircle,
  ClipboardCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
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
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.fullName || "User"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleKPIClick("/clients")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalClients}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleKPIClick("/engagements?status=active")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Engagements</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeEngagements}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-xl">
                <Briefcase className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleKPIClick("/engagements?status=in_progress")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold text-purple-600">{stats.inProgressEngagements}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-xl">
                <PlayCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleKPIClick("/engagements?status=pending_review")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingReviews}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-xl">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleKPIClick("/engagements?status=completed")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed (FY)</p>
                <p className="text-3xl font-bold text-teal-600">{stats.completedEngagements}</p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/20 p-2.5 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isAdmin && (
          <CreateClientDialog
            trigger={
              <Card className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border h-full">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
                    <Plus className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Add Client</h3>
                    <p className="text-sm text-muted-foreground">Create new client record</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            }
          />
        )}

        {isManager && (
          <Link href="/engagement/new">
            <Card className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border h-full">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-xl">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Create Engagement</h3>
                  <p className="text-sm text-muted-foreground">Start new audit engagement</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {isManager && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border h-full"
            onClick={handleAllocateEngagement}
          >
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-xl">
                <UserCheck className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Allocate Engagement</h3>
                <p className="text-sm text-muted-foreground">Assign team members</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border h-full"
          onClick={handleOpenWorkspace}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-xl">
              <Briefcase className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Open Workspace</h3>
              <p className="text-sm text-muted-foreground">Continue audit work</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        {(isAdmin || isManager) && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border h-full"
            onClick={handleViewPendingReviews}
          >
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-red-50 dark:bg-red-900/20 p-2.5 rounded-xl">
                <Eye className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">View Pending Reviews</h3>
                <p className="text-sm text-muted-foreground">{stats.pendingReviews} items awaiting</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                My Assignments
              </CardTitle>
              <CardDescription>Engagements assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>My Role</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No assignments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myAssignments.map((assignment) => (
                      <TableRow 
                        key={assignment.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEngagementRowClick(assignment.id, assignment.currentPhase, assignment.status)}
                      >
                        <TableCell className="font-medium font-mono">
                          <EngagementLink
                            engagementId={assignment.id}
                            engagementCode={assignment.engagementName}
                            clientId={assignment.clientId}
                          />
                        </TableCell>
                        <TableCell>
                          <span 
                            className="hover:text-primary hover:underline cursor-pointer"
                            onClick={(e) => handleClientCellClick(e, assignment.clientId)}
                          >
                            {assignment.clientName}
                          </span>
                        </TableCell>
                        <TableCell>{getRoleBadge(assignment.myRole)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{assignment.currentPhase}</Badge>
                        </TableCell>
                        <TableCell>{assignment.dueDate}</TableCell>
                        <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Activity tracking will appear here as you work</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

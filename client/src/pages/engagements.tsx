import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Search, Eye, Edit, Filter, Loader2, Play, Download } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { EngagementLink } from "@/components/engagement-link";
import { CreateEngagementDialog, EditEngagementDialog } from "@/components/create-engagement-dialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getSmartWorkspaceRoute, getButtonLabel, type PhaseProgress } from "@/lib/navigation";
import * as XLSX from "xlsx";

interface Engagement {
  id: string;
  engagementCode: string;
  engagementType: string;
  status: string;
  currentPhase: string;
  clientId?: string;
  onboardingLocked?: boolean;
  planningLocked?: boolean;
  executionLocked?: boolean;
  finalizationLocked?: boolean;
  startedAt?: string | null;
  lastRoute?: string | null;
  client?: {
    id: string;
    name: string;
  };
  fiscalYearEnd?: string;
  periodStart?: string;
  periodEnd?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  shareCapital?: number;
  numberOfEmployees?: number;
  lastYearRevenue?: number;
  previousYearRevenue?: number;
  companyCategory?: string;
  priorAuditor?: string;
  priorAuditorEmail?: string;
  priorAuditorPhone?: string;
  priorAuditorAddress?: string;
  priorAuditOpinion?: string;
  udin?: string;
  eqcrRequired?: boolean;
  team?: Array<{
    role: string;
    user?: {
      fullName: string;
    };
  }>;
  phases?: PhaseProgress[];
}

const COMPANY_CATEGORY_LABELS: Record<string, string> = {
  listed: "Listed Company",
  public_interest: "Public Interest Company",
  public_unlisted: "Public Unlisted Company",
  large_sized: "Large Sized Company",
  medium_sized: "Medium Sized Company",
  small_sized: "Small Sized Company (SSC)",
  single_member: "Single Member Company",
  private_limited: "Private Limited Company",
  npo: "NPO",
  trust: "Trust",
  cooperative: "Cooperative Society",
  association: "Association / Body of Persons",
  government: "Government Entity",
  statutory_body: "Statutory Body",
  other: "Other",
};

const formatCurrency = (val?: number | null) => {
  if (val == null) return "-";
  return new Intl.NumberFormat("en-PK").format(val);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "-";
  }
};

export default function Engagements() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlStatus = urlParams.get("status");
  
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [startingEngagement, setStartingEngagement] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = ["admin", "partner", "firm_admin", "manager"].includes(user?.role?.toLowerCase() || "");

  const handleStartEngagement = async (engagement: Engagement) => {
    const buttonInfo = getButtonLabel(engagement);
    
    if (buttonInfo.label === "Resume") {
      navigate(getSmartWorkspaceRoute(engagement));
      return;
    }
    
    setStartingEngagement(engagement.id);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagement.id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: data.alreadyStarted ? "Resuming engagement" : "Engagement started",
          description: data.alreadyStarted ? "Continuing from where you left off" : "Workspace initialized successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
        navigate(data.resumeRoute);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to start engagement",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start engagement",
        variant: "destructive",
      });
    } finally {
      setStartingEngagement(null);
    }
  };
  
  useEffect(() => {
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);

  const { data: engagements, refetch } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
  });

  const filteredEngagements = engagements?.filter((eng) => {
    const matchesSearch = (eng.client?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eng.engagementCode || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = statusFilter === "all";
    if (!matchesStatus) {
      const engStatus = eng.status?.toLowerCase() || "";
      const filterLower = statusFilter.toLowerCase().replace(/-/g, "_");
      if (filterLower === "active" || filterLower === "in_progress") {
        matchesStatus = engStatus === "active" || engStatus === "in_progress";
      } else if (filterLower === "pending_review" || filterLower === "pending") {
        matchesStatus = engStatus === "pending_review" || engStatus === "pending";
      } else if (filterLower === "completed") {
        matchesStatus = engStatus === "completed";
      } else {
        matchesStatus = engStatus === filterLower;
      }
    }
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "in_progress":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">{status?.toLowerCase() === "in_progress" ? "In Progress" : "Active"}</Badge>;
      case "pending_review":
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending Review</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 border-0">Draft</Badge>;
      case "completed":
        return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0">Completed</Badge>;
      case "archived":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPartner = (team?: Engagement["team"]) => {
    const partner = team?.find(t => t.role === "Partner" || t.role === "Engagement Partner");
    return partner?.user?.fullName || "-";
  };

  const getManager = (team?: Engagement["team"]) => {
    const manager = team?.find(t => t.role === "Manager" || t.role === "Engagement Manager");
    return manager?.user?.fullName || "-";
  };

  const getSenior = (team?: Engagement["team"]) => {
    const senior = team?.find(t => t.role === "Senior" || t.role === "Team Lead");
    return senior?.user?.fullName || "-";
  };

  const exportToExcel = () => {
    if (!filteredEngagements.length) return;
    const rows = filteredEngagements.map((e) => ({
      "Engagement Code": e.engagementCode || "",
      "Client": e.client?.name || "",
      "Type": e.engagementType?.replace(/_/g, " ") || "",
      "FY End": formatDate(e.fiscalYearEnd),
      "Period Start": formatDate(e.periodStart),
      "Period End": formatDate(e.periodEnd),
      "Company Category": e.companyCategory ? (COMPANY_CATEGORY_LABELS[e.companyCategory] || e.companyCategory) : "",
      "Authorized Capital": e.authorizedCapital ?? "",
      "Paid-up Capital": e.paidUpCapital ?? "",
      "Revenue (Last Year)": e.lastYearRevenue ?? "",
      "Revenue (Year Before)": e.previousYearRevenue ?? "",
      "No. of Employees": e.numberOfEmployees ?? "",
      "Partner": getPartner(e.team),
      "Manager": getManager(e.team),
      "Senior": getSenior(e.team),
      "Prior Auditor": e.priorAuditor || "",
      "Auditor Email": e.priorAuditorEmail || "",
      "Auditor Phone": e.priorAuditorPhone || "",
      "Prior Audit Opinion": e.priorAuditOpinion?.replace(/_/g, " ") || "",
      "Auditor Address": e.priorAuditorAddress || "",
      "UDIN": e.udin || "",
      "EQCR Required": e.eqcrRequired ? "Yes" : "No",
      "Phase": e.currentPhase?.replace(/_/g, " ") || "",
      "Status": e.status || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Engagements");
    XLSX.writeFile(wb, `Engagements_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Engagements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {engagements ? `${engagements.length} engagement${engagements.length !== 1 ? "s" : ""}` : "Manage audit engagements"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!filteredEngagements.length} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          {isAdmin && (
            <CreateEngagementDialog onSuccess={() => refetch()} />
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {filteredEngagements.length > 0 && (
          <span className="text-xs text-muted-foreground">{filteredEngagements.length} result{filteredEngagements.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>FY End</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEngagements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No engagements found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEngagements.map((eng) => (
                  <TableRow key={eng.id} className="cursor-pointer" onClick={() => handleStartEngagement(eng)}>
                    <TableCell className="font-mono text-xs">
                      <EngagementLink
                        engagementId={eng.id}
                        engagementCode={eng.engagementCode}
                        clientId={eng.clientId || eng.client?.id}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{eng.client?.name || "-"}</span>
                        {eng.engagementType && (
                          <p className="text-xs text-muted-foreground">{eng.engagementType.replace(/_/g, " ")}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(eng.fiscalYearEnd)}</TableCell>
                    <TableCell className="text-sm">{getPartner(eng.team)}</TableCell>
                    <TableCell className="text-sm">{getManager(eng.team)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{eng.currentPhase?.replace(/_/g, " ") || "-"}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(eng.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          size="sm" 
                          title={getButtonLabel(eng).tooltip}
                          className="gap-1 h-7 text-xs"
                          onClick={() => handleStartEngagement(eng)}
                          disabled={startingEngagement === eng.id}
                        >
                          {startingEngagement === eng.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {getButtonLabel(eng).label}
                        </Button>
                        <Link href={`/engagement/${eng.id}`}>
                          <Button variant="ghost" size="sm" title="View Details" className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <EditEngagementDialog 
                          engagementId={eng.id} 
                          onSuccess={() => refetch()}
                          trigger={
                            <Button variant="ghost" size="sm" title="Edit" className="h-7 w-7 p-0">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

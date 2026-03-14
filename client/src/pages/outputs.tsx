import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace } from "@/lib/workspace-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, Trash2, Package, FileText, Filter, Link2, Unlink, Calendar, CheckCircle2, Clock, Send, FileCheck, Shield, History, User } from "lucide-react";
import { DataQualityDashboard } from "@/components/data-quality-dashboard";
import { PhaseApprovalControl, PhaseLockIndicator } from "@/components/phase-approval-control";

interface EvidenceLink {
  id: string;
  evidenceId: string;
  linkType?: string;
  notes?: string;
  linkedAt: string;
  evidence: {
    id: string;
    fileName: string;
    fileReference: string;
    fileType: string;
    phase?: string;
    description?: string;
    fileSize?: number;
  };
  linkedBy?: { id: string; fullName: string };
}

interface OutputRecord {
  id: string;
  outputCode: string;
  outputName: string;
  phase: string;
  triggerButton?: string;
  sourceSheets: string[];
  fsHeadId?: string;
  isaTag?: string;
  templateFile?: string;
  outputFormat: string;
  status: string;
  preparedById?: string;
  preparedAt?: string;
  reviewedById?: string;
  reviewedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  version: number;
  filePath?: string;
  fileSize?: number;
  isDeliverable?: boolean;
  deliveryStatus?: string;
  deliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  preparedBy?: { id: string; fullName: string };
  reviewedBy?: { id: string; fullName: string };
  approvedBy?: { id: string; fullName: string };
  evidenceLinks?: EvidenceLink[];
}

interface EvidenceFile {
  id: string;
  fileName: string;
  fileReference: string;
  fileType: string;
  phase: string;
  description?: string;
  fileSize: number;
}

interface AuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  outputCode: string;
  outputName: string;
  performedBy: string;
}

const PHASES = [
  { value: "all", label: "All Phases" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "PRE_PLANNING", label: "Pre-Planning" },
  { value: "PLANNING", label: "Planning" },
  { value: "EXECUTION", label: "Execution" },
  { value: "FINALIZATION", label: "Finalization" },
  { value: "REPORTING", label: "Reporting" },
  { value: "EQCR", label: "EQCR" },
  { value: "INSPECTION", label: "Inspection" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Reviewed", label: "Reviewed" },
  { value: "Approved", label: "Approved" },
  { value: "Final", label: "Final" },
  { value: "Archived", label: "Archived" },
];

const DELIVERY_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Ready for Review", label: "Ready for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Delivered", label: "Delivered" },
];

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Approved":
    case "Final":
    case "Delivered":
      return "default";
    case "Reviewed":
    case "Ready for Review":
      return "secondary";
    case "Draft":
      return "outline";
    case "Archived":
      return "destructive";
    default:
      return "outline";
  }
}

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
}

export default function OutputsPage() {
  const { activeEngagement } = useWorkspace();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("outputs");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<OutputRecord | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [evidenceSearchTerm, setEvidenceSearchTerm] = useState("");

  const engagementId = activeEngagement?.id;

  const { data: outputs = [], isLoading } = useQuery<OutputRecord[]>({
    queryKey: ["/api/engagements", engagementId, "outputs", phaseFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (phaseFilter && phaseFilter !== "all") params.append("phase", phaseFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch outputs");
      return response.json();
    },
    enabled: !!engagementId,
  });

  const { data: auditTrailData = [], isLoading: auditTrailLoading } = useQuery<AuditTrailEntry[]>({
    queryKey: ["/api/engagements", engagementId, "outputs", "audit-trail"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs/audit-trail`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!engagementId && activeTab === "audit-trail",
  });

  const { data: deliverables = [], isLoading: deliverablesLoading } = useQuery<OutputRecord[]>({
    queryKey: ["/api/engagements", engagementId, "deliverables", deliveryStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deliveryStatusFilter && deliveryStatusFilter !== "all") params.append("status", deliveryStatusFilter);
      const response = await fetchWithAuth(`/api/deliverables/${engagementId}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch deliverables");
      return response.json();
    },
    enabled: !!engagementId && activeTab === "deliverables",
  });

  const { data: evidenceFiles = [] } = useQuery<EvidenceFile[]>({
    queryKey: ["/api/engagements", engagementId, "evidence-files-list"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/evidence/${engagementId}/files`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!engagementId && linkDialogOpen,
  });

  const { data: linkedEvidence = [] } = useQuery<EvidenceLink[]>({
    queryKey: ["/api/engagements", engagementId, "outputs", selectedOutput?.id, "linked-evidence"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs/${selectedOutput?.id}/linked-evidence`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!engagementId && !!selectedOutput?.id && linkDialogOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: async (outputId: string) => {
      await apiRequest("DELETE", `/api/engagements/${engagementId}/outputs/${outputId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "outputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "deliverables"] });
      toast({ title: "Output deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete output", description: error.message, variant: "destructive" });
    },
  });

  const linkEvidenceMutation = useMutation({
    mutationFn: async ({ outputId, evidenceId }: { outputId: string; evidenceId: string }) => {
      await apiRequest("POST", `/api/engagements/${engagementId}/outputs/${outputId}/link-evidence`, { evidenceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "outputs", selectedOutput?.id, "linked-evidence"] });
      toast({ title: "Evidence linked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to link evidence", description: error.message, variant: "destructive" });
    },
  });

  const unlinkEvidenceMutation = useMutation({
    mutationFn: async ({ outputId, evidenceId }: { outputId: string; evidenceId: string }) => {
      await apiRequest("DELETE", `/api/engagements/${engagementId}/outputs/${outputId}/unlink-evidence/${evidenceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "outputs", selectedOutput?.id, "linked-evidence"] });
      toast({ title: "Evidence unlinked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to unlink evidence", description: error.message, variant: "destructive" });
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async ({ outputId, isDeliverable, deliveryStatus, deliveryDate }: { outputId: string; isDeliverable?: boolean; deliveryStatus?: string; deliveryDate?: string }) => {
      await apiRequest("PATCH", `/api/engagements/${engagementId}/outputs/${outputId}/deliverable-status`, { isDeliverable, deliveryStatus, deliveryDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "outputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "deliverables"] });
      toast({ title: "Deliverable status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update deliverable", description: error.message, variant: "destructive" });
    },
  });

  const handleDownload = async (output: OutputRecord) => {
    if (!output.filePath) {
      toast({ title: "No file available", description: "This output has no associated file.", variant: "destructive" });
      return;
    }
    window.open(`/api/engagements/${engagementId}/outputs/${output.id}/download`, "_blank");
  };

  const handleOpenLinkDialog = (output: OutputRecord) => {
    setSelectedOutput(output);
    setSelectedEvidenceIds([]);
    setEvidenceSearchTerm("");
    setLinkDialogOpen(true);
  };

  const handleLinkEvidence = async (evidenceId: string) => {
    if (!selectedOutput) return;
    linkEvidenceMutation.mutate({ outputId: selectedOutput.id, evidenceId });
  };

  const handleUnlinkEvidence = async (evidenceId: string) => {
    if (!selectedOutput) return;
    unlinkEvidenceMutation.mutate({ outputId: selectedOutput.id, evidenceId });
  };

  const filteredEvidenceFiles = evidenceFiles.filter((ef) => {
    const alreadyLinked = linkedEvidence.some((le) => le.evidenceId === ef.id);
    if (alreadyLinked) return false;
    if (!evidenceSearchTerm) return true;
    const term = evidenceSearchTerm.toLowerCase();
    return ef.fileName.toLowerCase().includes(term) || ef.fileReference.toLowerCase().includes(term) || ef.description?.toLowerCase().includes(term);
  });

  const statusCounts = useMemo(() => {
    const counts = { Draft: 0, Reviewed: 0, Approved: 0, Final: 0 };
    outputs.forEach((o: OutputRecord) => {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    });
    return counts;
  }, [outputs]);

  if (!engagementId) {
    return (
      <div className="p-2.5">
        <Card>
          <CardContent className="p-2.5 text-center text-muted-foreground">
            Please select an engagement to view outputs.
          </CardContent>
        </Card>
      </div>
    );
  }

  const signoffTotal = statusCounts.Draft + statusCounts.Reviewed + statusCounts.Approved + statusCounts.Final;
  const signoffProgress = signoffTotal > 0
    ? {
        draft: Math.round((statusCounts.Draft / signoffTotal) * 100),
        reviewed: Math.round((statusCounts.Reviewed / signoffTotal) * 100),
        approved: Math.round((statusCounts.Approved / signoffTotal) * 100),
        final: Math.round((statusCounts.Final / signoffTotal) * 100),
      }
    : { draft: 0, reviewed: 0, approved: 0, final: 0 };

  return (
    <div className="page-container">
      <PhaseLockIndicator phase="FINALIZATION" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Outputs Registry</h1>
          <p className="text-muted-foreground">Central repository of all generated audit outputs and deliverables</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PhaseApprovalControl phase="FINALIZATION" inline />
          <Button variant="outline" data-testid="button-export-all">
            <Package className="h-4 w-4 mr-2" />
            Export All (ZIP)
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5" data-testid="summary-cards">
        <Card data-testid="card-total-outputs">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Outputs</p>
                <p className="text-xl font-semibold" data-testid="text-total-count">{outputs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-signoff-pipeline">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sign-off Pipeline</p>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted mb-2" data-testid="signoff-progress-bar">
              {signoffProgress.final > 0 && (
                <div className="bg-green-600 h-full" style={{ width: `${signoffProgress.final}%` }} data-testid="progress-final" />
              )}
              {signoffProgress.approved > 0 && (
                <div className="bg-blue-600 h-full" style={{ width: `${signoffProgress.approved}%` }} data-testid="progress-approved" />
              )}
              {signoffProgress.reviewed > 0 && (
                <div className="bg-amber-500 h-full" style={{ width: `${signoffProgress.reviewed}%` }} data-testid="progress-reviewed" />
              )}
              {signoffProgress.draft > 0 && (
                <div className="bg-muted-foreground/30 h-full" style={{ width: `${signoffProgress.draft}%` }} data-testid="progress-draft" />
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="flex items-center gap-1" data-testid="badge-draft-count">
                <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
                Draft: {statusCounts.Draft}
              </span>
              <span className="flex items-center gap-1" data-testid="badge-reviewed-count">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                Reviewed: {statusCounts.Reviewed}
              </span>
              <span className="flex items-center gap-1" data-testid="badge-approved-count">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                Approved: {statusCounts.Approved}
              </span>
              <span className="flex items-center gap-1" data-testid="badge-final-count">
                <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
                Final: {statusCounts.Final}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-isa-compliance">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">ISA Compliance</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap" data-testid="text-isa-note">
              <Badge variant="outline" data-testid="badge-isa-230">
                <Shield className="h-3 w-3 mr-1" />
                ISA 230 Documentation
              </Badge>
              <Badge variant="outline" data-testid="badge-isa-700">
                <FileCheck className="h-3 w-3 mr-1" />
                ISA 700 Reporting
              </Badge>
              <Badge variant="outline" data-testid="badge-isa-260">
                <Send className="h-3 w-3 mr-1" />
                ISA 260 Communication with TCWG
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="outputs" data-testid="tab-outputs">
            <FileText className="h-4 w-4 mr-2" />
            All Outputs
          </TabsTrigger>
          <TabsTrigger value="deliverables" data-testid="tab-deliverables">
            <FileCheck className="h-4 w-4 mr-2" />
            Deliverables
          </TabsTrigger>
          <TabsTrigger value="data-quality" data-testid="tab-data-quality">
            <Shield className="h-4 w-4 mr-2" />
            Data Quality
          </TabsTrigger>
          <TabsTrigger value="audit-trail" data-testid="tab-audit-trail">
            <History className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outputs" className="space-y-2.5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    All Outputs
                  </CardTitle>
                  <CardDescription>
                    {outputs.length} output{outputs.length !== 1 ? "s" : ""} found
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-40" data-testid="select-phase-filter">
                      <SelectValue placeholder="Filter by phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : outputs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2.5 opacity-50" />
                  <p>No outputs found matching the current filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>ISA Tag</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prepared By</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputs.map((output) => (
                      <TableRow key={output.id} data-testid={`row-output-${output.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={`text-output-code-${output.id}`}>
                          {output.outputCode}
                          {output.version > 1 && (
                            <span className="text-muted-foreground text-xs ml-1">v{output.version}</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-output-name-${output.id}`}>{output.outputName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatPhase(output.phase)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{output.isaTag || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{output.outputFormat}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(output.status)} data-testid={`badge-status-${output.id}`}>
                            {output.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`cell-prepared-${output.id}`}>
                          {output.preparedBy?.fullName ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span>{output.preparedBy.fullName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`cell-reviewed-${output.id}`}>
                          {output.reviewedBy?.fullName ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span>{output.reviewedBy.fullName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`cell-approved-${output.id}`}>
                          {output.approvedBy?.fullName ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span>{output.approvedBy.fullName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenLinkDialog(output)}
                              data-testid={`button-link-evidence-${output.id}`}
                              title="Link Evidence"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(output)}
                              disabled={!output.filePath}
                              data-testid={`button-download-${output.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-view-${output.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={output.isDeliverable ? "default" : "ghost"}
                              onClick={() => updateDeliverableMutation.mutate({ outputId: output.id, isDeliverable: !output.isDeliverable, deliveryStatus: output.isDeliverable ? undefined : "Draft" })}
                              data-testid={`button-deliverable-${output.id}`}
                              title={output.isDeliverable ? "Remove from Deliverables" : "Mark as Deliverable"}
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled={output.status === "Final" || output.status === "Approved"}
                                  data-testid={`button-delete-${output.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Output</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{output.outputCode}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(output.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-2.5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Deliverables
                  </CardTitle>
                  <CardDescription>
                    {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""} tracked.{" "}
                    <Link href={`/workspace/${engagementId}/deliverables`} className="text-primary hover:underline">
                      Go to Deliverables Register
                    </Link>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
                    <SelectTrigger className="w-48" data-testid="select-delivery-status-filter">
                      <SelectValue placeholder="Filter by delivery status" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deliverablesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : deliverables.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-2.5 opacity-50" />
                  <p>No deliverables found. Mark outputs as deliverables to track them here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Output Status</TableHead>
                      <TableHead>Delivery Status</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Linked Evidence</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliverables.map((output) => (
                      <TableRow key={output.id} data-testid={`row-deliverable-${output.id}`}>
                        <TableCell className="font-mono text-sm">
                          {output.outputCode}
                          {output.version > 1 && (
                            <span className="text-muted-foreground text-xs ml-1">v{output.version}</span>
                          )}
                        </TableCell>
                        <TableCell>{output.outputName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatPhase(output.phase)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(output.status)}>
                            {output.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={output.deliveryStatus || "Draft"}
                            onValueChange={(val) => updateDeliverableMutation.mutate({ outputId: output.id, deliveryStatus: val })}
                          >
                            <SelectTrigger className="w-40" data-testid={`select-delivery-status-${output.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Draft">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  Draft
                                </div>
                              </SelectItem>
                              <SelectItem value="Ready for Review">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-3 w-3" />
                                  Ready for Review
                                </div>
                              </SelectItem>
                              <SelectItem value="Approved">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approved
                                </div>
                              </SelectItem>
                              <SelectItem value="Delivered">
                                <div className="flex items-center gap-2">
                                  <Send className="h-3 w-3" />
                                  Delivered
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="date"
                              value={output.deliveryDate ? output.deliveryDate.split("T")[0] : ""}
                              onChange={(e) => updateDeliverableMutation.mutate({ outputId: output.id, deliveryDate: e.target.value })}
                              className="w-36"
                              data-testid={`input-delivery-date-${output.id}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {output.evidenceLinks?.length || 0} linked
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenLinkDialog(output)}
                              data-testid={`button-link-evidence-deliverable-${output.id}`}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(output)}
                              disabled={!output.filePath}
                              data-testid={`button-download-deliverable-${output.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateDeliverableMutation.mutate({ outputId: output.id, isDeliverable: false })}
                              data-testid={`button-remove-deliverable-${output.id}`}
                              title="Remove from Deliverables"
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-quality" className="space-y-2.5">
          {engagementId && <DataQualityDashboard engagementId={engagementId} />}
        </TabsContent>

        <TabsContent value="audit-trail" className="space-y-2.5">
          <Card data-testid="card-audit-trail">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete action history for all outputs in this engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outputs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3" data-testid="audit-trail-dates">
                  <Card>
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Last Prepared</p>
                      </div>
                      <p className="text-sm font-medium" data-testid="text-last-prepared">
                        {(() => {
                          const prepared = outputs.filter((o: OutputRecord) => o.preparedAt).sort((a: OutputRecord, b: OutputRecord) => new Date(b.preparedAt!).getTime() - new Date(a.preparedAt!).getTime());
                          return prepared.length > 0 ? `${formatDate(prepared[0].preparedAt)} - ${prepared[0].outputCode}` : "No records";
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Last Reviewed</p>
                      </div>
                      <p className="text-sm font-medium" data-testid="text-last-reviewed">
                        {(() => {
                          const reviewed = outputs.filter((o: OutputRecord) => o.reviewedAt).sort((a: OutputRecord, b: OutputRecord) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime());
                          return reviewed.length > 0 ? `${formatDate(reviewed[0].reviewedAt)} - ${reviewed[0].outputCode}` : "No records";
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Last Approved</p>
                      </div>
                      <p className="text-sm font-medium" data-testid="text-last-approved">
                        {(() => {
                          const approved = outputs.filter((o: OutputRecord) => o.approvedAt).sort((a: OutputRecord, b: OutputRecord) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime());
                          return approved.length > 0 ? `${formatDate(approved[0].approvedAt)} - ${approved[0].outputCode}` : "No records";
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
              {auditTrailLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : auditTrailData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2.5 opacity-50" />
                  <p>No audit trail entries found.</p>
                </div>
              ) : (
                <Table data-testid="table-audit-trail">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Output</TableHead>
                      <TableHead>Performed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditTrailData.map((entry: AuditTrailEntry, index: number) => (
                      <TableRow key={entry.id || index} data-testid={`row-audit-trail-${index}`}>
                        <TableCell className="text-sm" data-testid={`text-audit-timestamp-${index}`}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell data-testid={`text-audit-action-${index}`}>
                          <Badge variant="outline">{entry.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-audit-output-${index}`}>
                          <span className="font-mono">{entry.outputCode}</span>
                          {entry.outputName && <span className="text-muted-foreground ml-2">- {entry.outputName}</span>}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-audit-performer-${index}`}>
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            {entry.performedBy}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Evidence to Output
            </DialogTitle>
            <DialogDescription>
              {selectedOutput && (
                <>
                  Linking evidence to: <strong>{selectedOutput.outputCode}</strong> - {selectedOutput.outputName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5">
            {linkedEvidence.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Currently Linked Evidence</Label>
                <div className="border rounded-md divide-y">
                  {linkedEvidence.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{link.evidence.fileName}</p>
                          <p className="text-xs text-muted-foreground">{link.evidence.fileReference}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlinkEvidence(link.evidenceId)}
                        disabled={unlinkEvidenceMutation.isPending}
                        data-testid={`button-unlink-${link.evidenceId}`}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Available Evidence Files</Label>
              <Input
                placeholder="Search evidence files..."
                value={evidenceSearchTerm}
                onChange={(e) => setEvidenceSearchTerm(e.target.value)}
                data-testid="input-search-evidence"
              />
              <ScrollArea className="h-64 border rounded-md">
                {filteredEvidenceFiles.length === 0 ? (
                  <div className="p-2.5 text-center text-muted-foreground text-sm">
                    No available evidence files to link.
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEvidenceFiles.map((ef) => (
                      <div key={ef.id} className="flex items-center justify-between p-3 hover-elevate">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{ef.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {ef.fileReference} • {formatPhase(ef.phase)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLinkEvidence(ef.id)}
                          disabled={linkEvidenceMutation.isPending}
                          data-testid={`button-link-${ef.id}`}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} data-testid="button-close-link-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

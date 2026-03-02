import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  ArrowRight,
  Edit,
  MoreHorizontal,
  Play,
  CheckSquare,
  Eye,
  Layers,
  Filter,
  ExternalLink,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProcedureStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "REVIEWED" | "APPROVED" | "NOT_APPLICABLE";
type MatrixProcedureType = 
  | "TEST_OF_DETAILS"
  | "TEST_OF_CONTROLS"
  | "ANALYTICAL_PROCEDURE"
  | "INQUIRY"
  | "OBSERVATION"
  | "INSPECTION"
  | "RECALCULATION"
  | "REPERFORMANCE"
  | "CONFIRMATION";

interface ProcedureMatrixItem {
  id: string;
  engagementId: string;
  auditPlanId: string | null;
  riskAssessmentId: string | null;
  fsHeadKey: string | null;
  glCodeSet: string[];
  procedureLibraryCode: string | null;
  procedureName: string;
  procedureDescription: string | null;
  procedureType: MatrixProcedureType;
  assertions: string[];
  populationDefinition: Record<string, unknown> | null;
  populationFilters: Record<string, unknown> | null;
  evidenceRequiredChecklist: Record<string, unknown> | null;
  status: ProcedureStatus;
  assignedToId: string | null;
  dueDate: string | null;
  isaReference: string;
  preparedById: string | null;
  preparedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditPlan?: { id: string; versionNumber: number } | null;
  assignedTo?: { id: string; fullName: string } | null;
  preparedBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  samplingFrames?: Array<{ id: string }>;
}

interface AuditPlan {
  id: string;
  versionNumber: number;
  status: string;
}

interface RiskAssessment {
  id: string;
  fsHeadKey: string | null;
  riskTitle: string;
  riskLevel: string;
}

interface ProceduresMatrixPanelProps {
  engagementId: string;
  className?: string;
}

const PROCEDURE_TYPE_OPTIONS: { value: MatrixProcedureType; label: string }[] = [
  { value: "TEST_OF_DETAILS", label: "Test of Details" },
  { value: "TEST_OF_CONTROLS", label: "Test of Controls" },
  { value: "ANALYTICAL_PROCEDURE", label: "Analytical Procedure" },
  { value: "INQUIRY", label: "Inquiry" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "RECALCULATION", label: "Recalculation" },
  { value: "REPERFORMANCE", label: "Reperformance" },
  { value: "CONFIRMATION", label: "Confirmation" },
];

const ASSERTION_OPTIONS = [
  { value: "EXISTENCE", label: "Existence" },
  { value: "OCCURRENCE", label: "Occurrence" },
  { value: "COMPLETENESS", label: "Completeness" },
  { value: "ACCURACY", label: "Accuracy" },
  { value: "VALUATION", label: "Valuation" },
  { value: "RIGHTS_OBLIGATIONS", label: "Rights & Obligations" },
  { value: "CLASSIFICATION", label: "Classification" },
  { value: "CUTOFF", label: "Cut-off" },
  { value: "PRESENTATION", label: "Presentation & Disclosure" },
];

const STATUS_CONFIG: Record<ProcedureStatus, { label: string; color: string; icon: typeof Clock }> = {
  PLANNED: { label: "Planned", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Play },
  COMPLETED: { label: "Completed", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: CheckSquare },
  REVIEWED: { label: "Reviewed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Eye },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  NOT_APPLICABLE: { label: "N/A", color: "bg-muted text-muted-foreground", icon: AlertCircle },
};

const STATUS_WORKFLOW: ProcedureStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "REVIEWED", "APPROVED"];

const ROLE_HIERARCHY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  TEAM_LEAD: 3,
  MANAGER: 4,
  MANAGING_PARTNER: 5,
  PARTNER: 6,
  EQCR: 7,
  ADMIN: 8,
};

function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: ProcedureStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function StatusWorkflowIndicator({ currentStatus }: { currentStatus: ProcedureStatus }) {
  const steps = [
    { status: "PLANNED" as const, label: "Planned" },
    { status: "IN_PROGRESS" as const, label: "In Progress" },
    { status: "COMPLETED" as const, label: "Completed" },
    { status: "REVIEWED" as const, label: "Reviewed" },
    { status: "APPROVED" as const, label: "Approved" },
  ];
  
  const currentIndex = STATUS_WORKFLOW.indexOf(currentStatus);
  
  return (
    <div className="flex items-center gap-1 text-xs" data-testid="workflow-indicator">
      {steps.map((step, index) => {
        const isComplete = currentIndex > index;
        const isCurrent = step.status === currentStatus;
        
        return (
          <div key={step.status} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                isComplete && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                isCurrent && !isComplete && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                !isComplete && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isComplete && <CheckCircle2 className="h-3 w-3" />}
              {step.label}
            </div>
            {index < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

function ProcedureTypeBadge({ type }: { type: MatrixProcedureType }) {
  const option = PROCEDURE_TYPE_OPTIONS.find(o => o.value === type);
  return (
    <Badge variant="outline" className="text-xs" data-testid={`badge-type-${type.toLowerCase()}`}>
      {option?.label || type}
    </Badge>
  );
}

export function ProceduresMatrixPanel({ engagementId, className }: ProceduresMatrixPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<ProcedureMatrixItem | null>(null);
  
  const [filterFsHeadKey, setFilterFsHeadKey] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [procedureForm, setProcedureForm] = useState({
    auditPlanId: "",
    fsHeadKey: "",
    riskAssessmentId: "",
    procedureLibraryCode: "",
    procedureName: "",
    procedureDescription: "",
    procedureType: "TEST_OF_DETAILS" as MatrixProcedureType,
    assertions: [] as string[],
    populationDefinition: "",
    expectedResults: "",
    dueDate: "",
  });

  const [bulkSelectedRiskIds, setBulkSelectedRiskIds] = useState<string[]>([]);

  const { data: procedures, isLoading, error } = useQuery<ProcedureMatrixItem[]>({
    queryKey: ["/api/engagements", engagementId, "procedures-matrix"],
    enabled: !!engagementId,
  });

  const { data: auditPlans } = useQuery<AuditPlan[]>({
    queryKey: ["/api/engagements", engagementId, "audit-plans"],
    enabled: !!engagementId,
  });

  const { data: riskAssessments } = useQuery<RiskAssessment[]>({
    queryKey: ["/api/engagements", engagementId, "risk-assessments"],
    enabled: !!engagementId,
  });

  const approvedPlans = auditPlans?.filter(p => p.status === "APPROVED" || p.status === "LOCKED") || [];

  const uniqueFsHeadKeys = useMemo(() => {
    if (!procedures) return [];
    const keys = [...new Set(procedures.map(p => p.fsHeadKey).filter(Boolean))];
    return keys.sort() as string[];
  }, [procedures]);

  const filteredProcedures = useMemo(() => {
    if (!procedures) return [];
    return procedures.filter(p => {
      if (filterFsHeadKey !== "all" && p.fsHeadKey !== filterFsHeadKey) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [procedures, filterFsHeadKey, filterStatus]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof procedureForm) => {
      const payload = {
        auditPlanId: data.auditPlanId || undefined,
        fsHeadKey: data.fsHeadKey || undefined,
        riskAssessmentId: data.riskAssessmentId || undefined,
        procedureLibraryCode: data.procedureLibraryCode || undefined,
        procedureName: data.procedureName,
        procedureDescription: data.procedureDescription || undefined,
        procedureType: data.procedureType,
        assertions: data.assertions,
        populationDefinition: data.populationDefinition ? { definition: data.populationDefinition } : undefined,
        dueDate: data.dueDate || undefined,
      };
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/procedures-matrix`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Procedure created successfully" });
      setShowAddDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "procedures-matrix"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof procedureForm> }) => {
      const payload = {
        auditPlanId: data.auditPlanId || undefined,
        fsHeadKey: data.fsHeadKey || undefined,
        riskAssessmentId: data.riskAssessmentId || undefined,
        procedureLibraryCode: data.procedureLibraryCode || undefined,
        procedureName: data.procedureName,
        procedureDescription: data.procedureDescription || undefined,
        procedureType: data.procedureType,
        assertions: data.assertions,
        populationDefinition: data.populationDefinition ? { definition: data.populationDefinition } : undefined,
        dueDate: data.dueDate || undefined,
      };
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/procedures-matrix/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Procedure updated successfully" });
      setShowEditDialog(false);
      setEditingProcedure(null);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "procedures-matrix"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProcedureStatus }) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/procedures-matrix/${id}/status`, { status });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Success", description: `Status updated to ${STATUS_CONFIG[variables.status].label}` });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "procedures-matrix"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (riskIds: string[]) => {
      const procedures = riskIds.map(riskId => {
        const risk = riskAssessments?.find(r => r.id === riskId);
        return {
          riskAssessmentId: riskId,
          fsHeadKey: risk?.fsHeadKey || undefined,
          procedureName: `Test procedure for: ${risk?.riskTitle || "Unknown risk"}`,
          procedureType: "TEST_OF_DETAILS" as MatrixProcedureType,
          assertions: [],
        };
      });
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/procedures-matrix/bulk`, {
        riskAssessmentIds: riskIds,
        procedures,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Created ${data.created || bulkSelectedRiskIds.length} procedures from risk assessments` });
      setShowBulkDialog(false);
      setBulkSelectedRiskIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "procedures-matrix"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setProcedureForm({
      auditPlanId: "",
      fsHeadKey: "",
      riskAssessmentId: "",
      procedureLibraryCode: "",
      procedureName: "",
      procedureDescription: "",
      procedureType: "TEST_OF_DETAILS",
      assertions: [],
      populationDefinition: "",
      expectedResults: "",
      dueDate: "",
    });
  };

  const handleEdit = (procedure: ProcedureMatrixItem) => {
    setEditingProcedure(procedure);
    setProcedureForm({
      auditPlanId: procedure.auditPlanId || "",
      fsHeadKey: procedure.fsHeadKey || "",
      riskAssessmentId: procedure.riskAssessmentId || "",
      procedureLibraryCode: procedure.procedureLibraryCode || "",
      procedureName: procedure.procedureName,
      procedureDescription: procedure.procedureDescription || "",
      procedureType: procedure.procedureType,
      assertions: procedure.assertions || [],
      populationDefinition: (procedure.populationDefinition as any)?.definition || "",
      expectedResults: "",
      dueDate: procedure.dueDate ? procedure.dueDate.split("T")[0] : "",
    });
    setShowEditDialog(true);
  };

  const handleAssertionToggle = (assertion: string) => {
    setProcedureForm(prev => ({
      ...prev,
      assertions: prev.assertions.includes(assertion)
        ? prev.assertions.filter(a => a !== assertion)
        : [...prev.assertions, assertion],
    }));
  };

  const getNextStatus = (currentStatus: ProcedureStatus): ProcedureStatus | null => {
    const currentIndex = STATUS_WORKFLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_WORKFLOW.length - 1) return null;
    return STATUS_WORKFLOW[currentIndex + 1];
  };

  const canAdvanceStatus = (procedure: ProcedureMatrixItem): boolean => {
    const nextStatus = getNextStatus(procedure.status);
    if (!nextStatus) return false;
    if (nextStatus === "REVIEWED" || nextStatus === "APPROVED") {
      return hasMinRole(user?.role || "", "SENIOR");
    }
    return true;
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="procedures-matrix-panel-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="procedures-matrix-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Procedures Matrix (ISA 330)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load procedures data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Link to Audit Plan</Label>
          <Select
            value={procedureForm.auditPlanId || "__none__"}
            onValueChange={(v) => setProcedureForm(prev => ({ ...prev, auditPlanId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger data-testid="select-audit-plan">
              <SelectValue placeholder="Select audit plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {approvedPlans.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  v{p.versionNumber} - {p.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>FS Head Key</Label>
          <Input
            placeholder="e.g., REVENUE, INVENTORY"
            value={procedureForm.fsHeadKey}
            onChange={(e) => setProcedureForm(prev => ({ ...prev, fsHeadKey: e.target.value }))}
            data-testid="input-fs-head-key"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Risk Assessment Link</Label>
          <Select
            value={procedureForm.riskAssessmentId || "__none__"}
            onValueChange={(v) => setProcedureForm(prev => ({ ...prev, riskAssessmentId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger data-testid="select-risk-assessment">
              <SelectValue placeholder="Link to risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {riskAssessments?.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.riskTitle} ({r.riskLevel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Procedure Library Code</Label>
          <Input
            placeholder="e.g., AP-REV-001"
            value={procedureForm.procedureLibraryCode}
            onChange={(e) => setProcedureForm(prev => ({ ...prev, procedureLibraryCode: e.target.value }))}
            data-testid="input-procedure-code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Procedure Name *</Label>
        <Input
          placeholder="Enter procedure name"
          value={procedureForm.procedureName}
          onChange={(e) => setProcedureForm(prev => ({ ...prev, procedureName: e.target.value }))}
          data-testid="input-procedure-name"
        />
      </div>

      <div className="space-y-2">
        <Label>Procedure Description</Label>
        <Textarea
          placeholder="Describe the audit procedure in detail..."
          value={procedureForm.procedureDescription}
          onChange={(e) => setProcedureForm(prev => ({ ...prev, procedureDescription: e.target.value }))}
          rows={3}
          data-testid="input-procedure-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Procedure Type</Label>
          <Select
            value={procedureForm.procedureType}
            onValueChange={(v: MatrixProcedureType) => setProcedureForm(prev => ({ ...prev, procedureType: v }))}
          >
            <SelectTrigger data-testid="select-procedure-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROCEDURE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={procedureForm.dueDate}
            onChange={(e) => setProcedureForm(prev => ({ ...prev, dueDate: e.target.value }))}
            data-testid="input-due-date"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Assertions (Multi-select)</Label>
        <div className="grid grid-cols-3 gap-3">
          {ASSERTION_OPTIONS.map(assertion => (
            <div key={assertion.value} className="flex items-center space-x-2">
              <Checkbox
                id={`assertion-${assertion.value}`}
                checked={procedureForm.assertions.includes(assertion.value)}
                onCheckedChange={() => handleAssertionToggle(assertion.value)}
                data-testid={`checkbox-assertion-${assertion.value.toLowerCase()}`}
              />
              <Label
                htmlFor={`assertion-${assertion.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {assertion.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Population Definition</Label>
        <Textarea
          placeholder="Define the population to be tested (e.g., All sales transactions > $10,000)..."
          value={procedureForm.populationDefinition}
          onChange={(e) => setProcedureForm(prev => ({ ...prev, populationDefinition: e.target.value }))}
          rows={2}
          data-testid="input-population-definition"
        />
      </div>

      <div className="space-y-2">
        <Label>Expected Results</Label>
        <Textarea
          placeholder="Describe the expected results of this procedure..."
          value={procedureForm.expectedResults}
          onChange={(e) => setProcedureForm(prev => ({ ...prev, expectedResults: e.target.value }))}
          rows={2}
          data-testid="input-expected-results"
        />
      </div>
    </div>
  );

  return (
    <Card className={className} data-testid="procedures-matrix-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Procedures Matrix (ISA 330)
              {procedures && procedures.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {procedures.length} procedures
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Audit procedures linked to risk assessments and assertions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-bulk-create">
                  <Layers className="h-4 w-4 mr-1" />
                  Bulk Create
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Bulk Create from Risk Assessments</DialogTitle>
                  <DialogDescription>
                    Select risk assessments to automatically generate audit procedures.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="space-y-2 py-4">
                    {riskAssessments && riskAssessments.length > 0 ? (
                      riskAssessments.map(risk => (
                        <div key={risk.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            id={`risk-${risk.id}`}
                            checked={bulkSelectedRiskIds.includes(risk.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBulkSelectedRiskIds(prev => [...prev, risk.id]);
                              } else {
                                setBulkSelectedRiskIds(prev => prev.filter(id => id !== risk.id));
                              }
                            }}
                            data-testid={`checkbox-risk-${risk.id}`}
                          />
                          <Label htmlFor={`risk-${risk.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium text-sm">{risk.riskTitle}</div>
                            <div className="text-xs text-muted-foreground">
                              {risk.fsHeadKey} • {risk.riskLevel}
                            </div>
                          </Label>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No risk assessments available
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => bulkCreateMutation.mutate(bulkSelectedRiskIds)}
                    disabled={bulkCreateMutation.isPending || bulkSelectedRiskIds.length === 0}
                    data-testid="button-confirm-bulk-create"
                  >
                    {bulkCreateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create {bulkSelectedRiskIds.length} Procedures
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-procedure">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Procedure
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Procedure</DialogTitle>
                  <DialogDescription>
                    Create a new audit procedure per ISA 330 requirements.
                  </DialogDescription>
                </DialogHeader>
                <FormContent />
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(procedureForm)}
                    disabled={createMutation.isPending || !procedureForm.procedureName}
                    data-testid="button-create-procedure"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Procedure
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterFsHeadKey} onValueChange={setFilterFsHeadKey}>
              <SelectTrigger className="w-[160px]" data-testid="filter-fs-head-key">
                <SelectValue placeholder="FS Head" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All FS Heads</SelectItem>
                {uniqueFsHeadKeys.map(key => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterFsHeadKey !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterFsHeadKey("all"); setFilterStatus("all"); }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {filteredProcedures.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No procedures found</p>
            <p className="text-xs mt-1">Add procedures or adjust your filters</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">FS Head</TableHead>
                  <TableHead className="w-[100px]">Risk Link</TableHead>
                  <TableHead>Procedure Name</TableHead>
                  <TableHead className="w-[140px]">Type</TableHead>
                  <TableHead className="w-[180px]">Assertions</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px]">Samples</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcedures.map((procedure) => (
                  <TableRow key={procedure.id} data-testid={`row-procedure-${procedure.id}`}>
                    <TableCell className="font-medium">
                      {procedure.fsHeadKey || "-"}
                    </TableCell>
                    <TableCell>
                      {procedure.riskAssessmentId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          data-testid={`link-risk-${procedure.id}`}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{procedure.procedureName}</div>
                        {procedure.procedureLibraryCode && (
                          <div className="text-xs text-muted-foreground">
                            {procedure.procedureLibraryCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ProcedureTypeBadge type={procedure.procedureType} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {procedure.assertions.length > 0 ? (
                          procedure.assertions.slice(0, 3).map(assertion => (
                            <Badge
                              key={assertion}
                              variant="secondary"
                              className="text-xs"
                              data-testid={`badge-assertion-${assertion.toLowerCase()}`}
                            >
                              {assertion.slice(0, 3)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {procedure.assertions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{procedure.assertions.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={procedure.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {procedure.samplingFrames?.length || 0}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${procedure.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(procedure)} data-testid={`action-edit-${procedure.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {canAdvanceStatus(procedure) && getNextStatus(procedure.status) && (
                            <DropdownMenuItem
                              onClick={() => {
                                const nextStatus = getNextStatus(procedure.status);
                                if (nextStatus) statusMutation.mutate({ id: procedure.id, status: nextStatus });
                              }}
                              data-testid={`action-advance-${procedure.id}`}
                            >
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Move to {STATUS_CONFIG[getNextStatus(procedure.status)!].label}
                            </DropdownMenuItem>
                          )}
                          {procedure.status !== "NOT_APPLICABLE" && (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: procedure.id, status: "NOT_APPLICABLE" })}
                              data-testid={`action-na-${procedure.id}`}
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Mark as N/A
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {procedures && procedures.length > 0 && (
          <>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Total Procedures</div>
                <div className="text-lg font-semibold" data-testid="stat-total">
                  {procedures.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">In Progress</div>
                <div className="text-lg font-semibold" data-testid="stat-in-progress">
                  {procedures.filter(p => p.status === "IN_PROGRESS").length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Completed</div>
                <div className="text-lg font-semibold" data-testid="stat-completed">
                  {procedures.filter(p => p.status === "COMPLETED" || p.status === "REVIEWED" || p.status === "APPROVED").length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Approved</div>
                <div className="text-lg font-semibold text-green-600" data-testid="stat-approved">
                  {procedures.filter(p => p.status === "APPROVED").length}
                </div>
              </div>
            </div>
          </>
        )}

        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setEditingProcedure(null); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Procedure</DialogTitle>
              <DialogDescription>
                Update the audit procedure details.
              </DialogDescription>
            </DialogHeader>
            {editingProcedure && (
              <>
                <div className="mb-4">
                  <StatusWorkflowIndicator currentStatus={editingProcedure.status} />
                </div>
                <FormContent isEdit />
                <div className="border-t pt-4 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Reviewer/Approver Tracking</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3" />
                      <span>Reviewed by:</span>
                      <span className="font-medium">
                        {editingProcedure.reviewedBy?.fullName || "-"}
                        {editingProcedure.reviewedAt && ` (${formatDate(editingProcedure.reviewedAt)})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Approved by:</span>
                      <span className="font-medium">
                        {editingProcedure.approvedBy?.fullName || "-"}
                        {editingProcedure.approvedAt && ` (${formatDate(editingProcedure.approvedAt)})`}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingProcedure(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingProcedure) {
                    updateMutation.mutate({ id: editingProcedure.id, data: procedureForm });
                  }
                }}
                disabled={updateMutation.isPending || !procedureForm.procedureName}
                data-testid="button-update-procedure"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

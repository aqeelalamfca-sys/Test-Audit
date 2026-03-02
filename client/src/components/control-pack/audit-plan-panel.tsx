import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ClipboardList,
  Plus,
  Send,
  CheckCircle2,
  Lock,
  History,
  ChevronDown,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  Users,
  Target,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuditPlanStatus = "DRAFT" | "PENDING_REVIEW" | "PENDING_APPROVAL" | "APPROVED" | "LOCKED";
type AuditApproachType = "SUBSTANTIVE_ONLY" | "CONTROLS_AND_SUBSTANTIVE" | "COMBINED";
type AuditTimingType = "INTERIM" | "FINAL" | "BOTH";

interface MaterialitySet {
  id: string;
  versionId: number;
  status: string;
  overallMateriality: string | number;
}

interface AuditPlan {
  id: string;
  engagementId: string;
  materialitySetId: string | null;
  mappingVersionId: string | null;
  versionNumber: number;
  status: AuditPlanStatus;
  auditApproach: AuditApproachType;
  auditTiming: AuditTimingType;
  scopeDescription: string | null;
  staffingPlan: Record<string, unknown> | null;
  relianceOnControls: boolean;
  relianceOnInternalAudit: boolean;
  relianceOnExperts: boolean;
  relianceOnIT: boolean;
  relianceDetails: Record<string, unknown> | null;
  interimStartDate: string | null;
  interimEndDate: string | null;
  finalStartDate: string | null;
  finalEndDate: string | null;
  reportDeadline: string | null;
  milestoneDates: Record<string, unknown> | null;
  isaReference: string;
  preparedById: string | null;
  preparedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  lockedById: string | null;
  createdAt: string;
  updatedAt: string;
  materialitySet?: { id: string; versionId: number; overallMateriality: string | number } | null;
  preparedBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  lockedBy?: { id: string; fullName: string } | null;
}

interface AuditPlanPanelProps {
  engagementId: string;
  className?: string;
}

const APPROACH_OPTIONS: { value: AuditApproachType; label: string }[] = [
  { value: "SUBSTANTIVE_ONLY", label: "Substantive Only" },
  { value: "CONTROLS_AND_SUBSTANTIVE", label: "Controls & Substantive" },
  { value: "COMBINED", label: "Combined Approach" },
];

const TIMING_OPTIONS: { value: AuditTimingType; label: string }[] = [
  { value: "INTERIM", label: "Interim" },
  { value: "FINAL", label: "Final" },
  { value: "BOTH", label: "Both (Interim + Final)" },
];

const STATUS_CONFIG: Record<AuditPlanStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: AlertCircle },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  LOCKED: { label: "Locked", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Lock },
};

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

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: AuditPlanStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function StatusWorkflowIndicator({ currentStatus }: { currentStatus: AuditPlanStatus }) {
  const steps = [
    { status: "DRAFT" as const, label: "Draft" },
    { status: "PENDING_REVIEW" as const, label: "Review" },
    { status: "APPROVED" as const, label: "Approved" },
    { status: "LOCKED" as const, label: "Locked" },
  ];
  
  const statusOrder = ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "LOCKED"];
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  return (
    <div className="flex items-center gap-1 text-xs" data-testid="workflow-indicator">
      {steps.map((step, index) => {
        const stepIndex = statusOrder.indexOf(step.status);
        const isComplete = currentIndex > stepIndex;
        const isCurrent = step.status === currentStatus || 
          (currentStatus === "PENDING_APPROVAL" && step.status === "PENDING_REVIEW");
        
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

export function AuditPlanPanel({ engagementId, className }: AuditPlanPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AuditPlan | null>(null);
  
  const [newPlanForm, setNewPlanForm] = useState({
    materialitySetId: "",
    auditApproach: "SUBSTANTIVE_ONLY" as AuditApproachType,
    auditTiming: "FINAL" as AuditTimingType,
    scopeDescription: "",
    relianceOnControls: false,
    relianceOnInternalAudit: false,
    relianceOnExperts: false,
    relianceOnIT: false,
    interimStartDate: "",
    interimEndDate: "",
    finalStartDate: "",
    finalEndDate: "",
    reportDeadline: "",
  });

  const { data: auditPlans, isLoading, error } = useQuery<AuditPlan[]>({
    queryKey: ["/api/engagements", engagementId, "audit-plans"],
    enabled: !!engagementId,
  });

  const { data: materialitySets } = useQuery<MaterialitySet[]>({
    queryKey: ["/api/engagements", engagementId, "materiality-sets"],
    enabled: !!engagementId,
  });

  const approvedMaterialitySets = materialitySets?.filter(m => m.status === "APPROVED") || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof newPlanForm) => {
      const payload = {
        materialitySetId: data.materialitySetId || undefined,
        auditApproach: data.auditApproach,
        auditTiming: data.auditTiming,
        scopeDescription: data.scopeDescription || undefined,
        relianceOnControls: data.relianceOnControls,
        relianceOnInternalAudit: data.relianceOnInternalAudit,
        relianceOnExperts: data.relianceOnExperts,
        relianceOnIT: data.relianceOnIT,
        interimStartDate: data.interimStartDate || undefined,
        interimEndDate: data.interimEndDate || undefined,
        finalStartDate: data.finalStartDate || undefined,
        finalEndDate: data.finalEndDate || undefined,
        reportDeadline: data.reportDeadline || undefined,
      };
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/audit-plans`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "New audit plan created" });
      setShowNewPlanDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "audit-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newPlanForm> }) => {
      const payload = {
        ...data,
        materialitySetId: data.materialitySetId || undefined,
        interimStartDate: data.interimStartDate || undefined,
        interimEndDate: data.interimEndDate || undefined,
        finalStartDate: data.finalStartDate || undefined,
        finalEndDate: data.finalEndDate || undefined,
        reportDeadline: data.reportDeadline || undefined,
      };
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/audit-plans/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Audit plan updated" });
      setShowEditDialog(false);
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "audit-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/audit-plans/${id}/submit`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Submitted for review" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "audit-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/audit-plans/${id}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Audit plan approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "audit-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/audit-plans/${id}/lock`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Audit plan locked" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "audit-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewPlanForm({
      materialitySetId: "",
      auditApproach: "SUBSTANTIVE_ONLY",
      auditTiming: "FINAL",
      scopeDescription: "",
      relianceOnControls: false,
      relianceOnInternalAudit: false,
      relianceOnExperts: false,
      relianceOnIT: false,
      interimStartDate: "",
      interimEndDate: "",
      finalStartDate: "",
      finalEndDate: "",
      reportDeadline: "",
    });
  };

  const handleEdit = (plan: AuditPlan) => {
    setEditingPlan(plan);
    setNewPlanForm({
      materialitySetId: plan.materialitySetId || "",
      auditApproach: plan.auditApproach,
      auditTiming: plan.auditTiming,
      scopeDescription: plan.scopeDescription || "",
      relianceOnControls: plan.relianceOnControls,
      relianceOnInternalAudit: plan.relianceOnInternalAudit,
      relianceOnExperts: plan.relianceOnExperts,
      relianceOnIT: plan.relianceOnIT,
      interimStartDate: plan.interimStartDate ? plan.interimStartDate.split("T")[0] : "",
      interimEndDate: plan.interimEndDate ? plan.interimEndDate.split("T")[0] : "",
      finalStartDate: plan.finalStartDate ? plan.finalStartDate.split("T")[0] : "",
      finalEndDate: plan.finalEndDate ? plan.finalEndDate.split("T")[0] : "",
      reportDeadline: plan.reportDeadline ? plan.reportDeadline.split("T")[0] : "",
    });
    setShowEditDialog(true);
  };

  const activePlan = auditPlans?.find(p => p.status !== "LOCKED") || auditPlans?.[0];
  const lockedPlan = auditPlans?.find(p => p.isLocked);
  const displayPlan = lockedPlan || activePlan;
  
  const canSubmit = displayPlan && displayPlan.status === "DRAFT" && !displayPlan.isLocked;
  const canApprove = displayPlan && (displayPlan.status === "PENDING_REVIEW" || displayPlan.status === "PENDING_APPROVAL") 
    && hasMinRole(user?.role || "", "MANAGER") && !displayPlan.isLocked;
  const canLock = displayPlan && displayPlan.status === "APPROVED" && hasMinRole(user?.role || "", "PARTNER") && !displayPlan.isLocked;
  const canEdit = displayPlan && displayPlan.status === "DRAFT" && !displayPlan.isLocked;

  if (isLoading) {
    return (
      <Card className={className} data-testid="audit-plan-panel-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="audit-plan-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Audit Plan (ISA 300)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load audit plan data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Link to Materiality Set</Label>
        <Select
          value={newPlanForm.materialitySetId || "__none__"}
          onValueChange={(v) => setNewPlanForm(prev => ({ ...prev, materialitySetId: v === "__none__" ? "" : v }))}
        >
          <SelectTrigger data-testid="select-materiality-set">
            <SelectValue placeholder="Select approved materiality set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {approvedMaterialitySets.map(m => (
              <SelectItem key={m.id} value={m.id}>
                v{m.versionId} - OM: {formatCurrency(m.overallMateriality)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Audit Approach</Label>
          <Select
            value={newPlanForm.auditApproach}
            onValueChange={(v: AuditApproachType) => setNewPlanForm(prev => ({ ...prev, auditApproach: v }))}
          >
            <SelectTrigger data-testid="select-audit-approach">
              <SelectValue placeholder="Select approach" />
            </SelectTrigger>
            <SelectContent>
              {APPROACH_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Audit Timing</Label>
          <Select
            value={newPlanForm.auditTiming}
            onValueChange={(v: AuditTimingType) => setNewPlanForm(prev => ({ ...prev, auditTiming: v }))}
          >
            <SelectTrigger data-testid="select-audit-timing">
              <SelectValue placeholder="Select timing" />
            </SelectTrigger>
            <SelectContent>
              {TIMING_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Scope Description</Label>
        <Textarea
          placeholder="Describe the scope of the audit engagement..."
          value={newPlanForm.scopeDescription}
          onChange={(e) => setNewPlanForm(prev => ({ ...prev, scopeDescription: e.target.value }))}
          rows={3}
          data-testid="input-scope-description"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Reliance Assessment</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="reliance-controls" className="text-sm font-normal">
              Reliance on Controls
            </Label>
            <Switch
              id="reliance-controls"
              checked={newPlanForm.relianceOnControls}
              onCheckedChange={(v) => setNewPlanForm(prev => ({ ...prev, relianceOnControls: v }))}
              data-testid="switch-reliance-controls"
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="reliance-internal-audit" className="text-sm font-normal">
              Reliance on Internal Audit
            </Label>
            <Switch
              id="reliance-internal-audit"
              checked={newPlanForm.relianceOnInternalAudit}
              onCheckedChange={(v) => setNewPlanForm(prev => ({ ...prev, relianceOnInternalAudit: v }))}
              data-testid="switch-reliance-internal-audit"
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="reliance-experts" className="text-sm font-normal">
              Reliance on Experts
            </Label>
            <Switch
              id="reliance-experts"
              checked={newPlanForm.relianceOnExperts}
              onCheckedChange={(v) => setNewPlanForm(prev => ({ ...prev, relianceOnExperts: v }))}
              data-testid="switch-reliance-experts"
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="reliance-it" className="text-sm font-normal">
              Reliance on IT
            </Label>
            <Switch
              id="reliance-it"
              checked={newPlanForm.relianceOnIT}
              onCheckedChange={(v) => setNewPlanForm(prev => ({ ...prev, relianceOnIT: v }))}
              data-testid="switch-reliance-it"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Key Dates</Label>
        {(newPlanForm.auditTiming === "INTERIM" || newPlanForm.auditTiming === "BOTH") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-normal">Interim Start</Label>
              <Input
                type="date"
                value={newPlanForm.interimStartDate}
                onChange={(e) => setNewPlanForm(prev => ({ ...prev, interimStartDate: e.target.value }))}
                data-testid="input-interim-start"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-normal">Interim End</Label>
              <Input
                type="date"
                value={newPlanForm.interimEndDate}
                onChange={(e) => setNewPlanForm(prev => ({ ...prev, interimEndDate: e.target.value }))}
                data-testid="input-interim-end"
              />
            </div>
          </div>
        )}
        {(newPlanForm.auditTiming === "FINAL" || newPlanForm.auditTiming === "BOTH") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-normal">Final Start</Label>
              <Input
                type="date"
                value={newPlanForm.finalStartDate}
                onChange={(e) => setNewPlanForm(prev => ({ ...prev, finalStartDate: e.target.value }))}
                data-testid="input-final-start"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-normal">Final End</Label>
              <Input
                type="date"
                value={newPlanForm.finalEndDate}
                onChange={(e) => setNewPlanForm(prev => ({ ...prev, finalEndDate: e.target.value }))}
                data-testid="input-final-end"
              />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-sm font-normal">Report Deadline</Label>
          <Input
            type="date"
            value={newPlanForm.reportDeadline}
            onChange={(e) => setNewPlanForm(prev => ({ ...prev, reportDeadline: e.target.value }))}
            data-testid="input-report-deadline"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Card className={className} data-testid="audit-plan-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Audit Plan (ISA 300)
              {displayPlan && (
                <Badge variant="outline" className="ml-2">
                  v{displayPlan.versionNumber}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Audit strategy, approach, timing, and key milestones
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {auditPlans && auditPlans.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                data-testid="button-toggle-history"
              >
                <History className="h-4 w-4 mr-1" />
                History ({auditPlans.length})
              </Button>
            )}
            <Dialog open={showNewPlanDialog} onOpenChange={setShowNewPlanDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-plan">
                  <Plus className="h-4 w-4 mr-1" />
                  New Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Audit Plan</DialogTitle>
                  <DialogDescription>
                    Define audit strategy and approach per ISA 300.
                  </DialogDescription>
                </DialogHeader>
                <FormContent />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewPlanDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(newPlanForm)}
                    disabled={createMutation.isPending}
                    data-testid="button-create-plan"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Plan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {displayPlan ? (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusWorkflowIndicator currentStatus={displayPlan.status} />
              <div className="flex items-center gap-2">
                <StatusBadge status={displayPlan.status} />
                {displayPlan.isLocked && (
                  <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Audit Approach
                </div>
                <div className="text-sm font-medium" data-testid="text-audit-approach">
                  {APPROACH_OPTIONS.find(a => a.value === displayPlan.auditApproach)?.label || displayPlan.auditApproach}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Audit Timing
                </div>
                <div className="text-sm font-medium" data-testid="text-audit-timing">
                  {TIMING_OPTIONS.find(t => t.value === displayPlan.auditTiming)?.label || displayPlan.auditTiming}
                </div>
              </div>
            </div>

            {displayPlan.materialitySet && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Linked Materiality Set</div>
                <div className="text-sm font-medium" data-testid="text-linked-materiality">
                  v{displayPlan.materialitySet.versionId} - Overall Materiality: {formatCurrency(displayPlan.materialitySet.overallMateriality)}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {displayPlan.relianceOnControls && (
                <Badge variant="secondary" className="text-xs">Controls</Badge>
              )}
              {displayPlan.relianceOnInternalAudit && (
                <Badge variant="secondary" className="text-xs">Internal Audit</Badge>
              )}
              {displayPlan.relianceOnExperts && (
                <Badge variant="secondary" className="text-xs">Experts</Badge>
              )}
              {displayPlan.relianceOnIT && (
                <Badge variant="secondary" className="text-xs">IT</Badge>
              )}
            </div>

            {(displayPlan.finalStartDate || displayPlan.interimStartDate || displayPlan.reportDeadline) && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                {displayPlan.interimStartDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Interim Period</div>
                    <div>{formatDate(displayPlan.interimStartDate)} - {formatDate(displayPlan.interimEndDate)}</div>
                  </div>
                )}
                {displayPlan.finalStartDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Final Period</div>
                    <div>{formatDate(displayPlan.finalStartDate)} - {formatDate(displayPlan.finalEndDate)}</div>
                  </div>
                )}
                {displayPlan.reportDeadline && (
                  <div>
                    <div className="text-xs text-muted-foreground">Report Deadline</div>
                    <div>{formatDate(displayPlan.reportDeadline)}</div>
                  </div>
                )}
              </div>
            )}

            {displayPlan.scopeDescription && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4" />
                  View Scope Description
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap" data-testid="text-scope">
                    {displayPlan.scopeDescription}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground space-y-1">
                {displayPlan.preparedBy && (
                  <div>Prepared by: {displayPlan.preparedBy.fullName} ({formatDateTime(displayPlan.preparedAt)})</div>
                )}
                {displayPlan.approvedBy && (
                  <div>Approved by: {displayPlan.approvedBy.fullName} ({formatDateTime(displayPlan.approvedAt)})</div>
                )}
                {displayPlan.lockedBy && (
                  <div>Locked by: {displayPlan.lockedBy.fullName} ({formatDateTime(displayPlan.lockedAt)})</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(displayPlan)}
                    data-testid="button-edit-plan"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {canSubmit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => submitMutation.mutate(displayPlan.id)}
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-review"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Submit for Review
                  </Button>
                )}
                {canApprove && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => approveMutation.mutate(displayPlan.id)}
                    disabled={approveMutation.isPending}
                    data-testid="button-approve"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                )}
                {canLock && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => lockMutation.mutate(displayPlan.id)}
                    disabled={lockMutation.isPending}
                    data-testid="button-lock"
                  >
                    {lockMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4 mr-1" />
                    )}
                    Lock
                  </Button>
                )}
              </div>
            </div>

            {showHistoryPanel && auditPlans && auditPlans.length > 1 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Version History</div>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {auditPlans.map(plan => (
                        <div
                          key={plan.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg text-sm",
                            plan.id === displayPlan.id ? "bg-muted" : "bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">v{plan.versionNumber}</Badge>
                            <StatusBadge status={plan.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(plan.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No audit plan created yet</p>
            <p className="text-xs mt-1">Click "New Plan" to create the first version</p>
          </div>
        )}

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Audit Plan</DialogTitle>
              <DialogDescription>
                Update audit strategy and approach.
              </DialogDescription>
            </DialogHeader>
            <FormContent isEdit />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingPlan(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => editingPlan && updateMutation.mutate({ id: editingPlan.id, data: newPlanForm })}
                disabled={updateMutation.isPending}
                data-testid="button-save-plan"
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

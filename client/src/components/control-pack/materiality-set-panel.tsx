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
  Calculator,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type MaterialitySetStatus = "DRAFT" | "PENDING_REVIEW" | "PENDING_APPROVAL" | "APPROVED" | "LOCKED" | "SUPERSEDED";

interface MaterialitySet {
  id: string;
  engagementId: string;
  versionId: number;
  previousVersionId: string | null;
  status: MaterialitySetStatus;
  benchmarkType: string;
  benchmarkAmount: string | number;
  percentApplied: string | number;
  overallMateriality: string | number;
  performanceMateriality: string | number;
  trivialThreshold: string | number;
  specificMateriality: Record<string, unknown> | null;
  rationale: string | null;
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
  preparedBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  lockedBy?: { id: string; fullName: string } | null;
}

interface MaterialitySetPanelProps {
  engagementId: string;
  className?: string;
}

const BENCHMARK_OPTIONS = [
  { value: "REVENUE", label: "Total Revenue" },
  { value: "TOTAL_ASSETS", label: "Total Assets" },
  { value: "PROFIT_BEFORE_TAX", label: "Profit Before Tax" },
  { value: "GROSS_PROFIT", label: "Gross Profit" },
  { value: "NET_ASSETS", label: "Net Assets / Equity" },
  { value: "TOTAL_EXPENSES", label: "Total Expenses" },
  { value: "CUSTOM", label: "Custom Benchmark" },
];

const STATUS_CONFIG: Record<MaterialitySetStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: AlertCircle },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  LOCKED: { label: "Locked", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Lock },
  SUPERSEDED: { label: "Superseded", color: "bg-muted text-muted-foreground", icon: History },
};

const ROLE_HIERARCHY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: MaterialitySetStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function StatusWorkflowIndicator({ currentStatus }: { currentStatus: MaterialitySetStatus }) {
  const steps = [
    { status: "DRAFT" as const, label: "Draft" },
    { status: "PENDING_REVIEW" as const, label: "Review" },
    { status: "APPROVED" as const, label: "Approved" },
  ];
  
  const currentIndex = steps.findIndex(s => s.status === currentStatus);
  
  return (
    <div className="flex items-center gap-1 text-xs" data-testid="workflow-indicator">
      {steps.map((step, index) => {
        const isComplete = currentIndex > index || (currentStatus === "APPROVED" && index <= 2);
        const isCurrent = step.status === currentStatus || (currentStatus === "PENDING_APPROVAL" && step.status === "PENDING_REVIEW");
        
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

export function MaterialitySetPanel({ engagementId, className }: MaterialitySetPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  const [newVersionForm, setNewVersionForm] = useState({
    benchmarkType: "PROFIT_BEFORE_TAX",
    benchmarkAmount: "",
    percentApplied: "5",
    overallMateriality: "",
    performanceMateriality: "",
    trivialThreshold: "",
    rationale: "",
    notes: "",
  });

  const { data: materialitySets, isLoading, error } = useQuery<MaterialitySet[]>({
    queryKey: ["/api/engagements", engagementId, "materiality-sets"],
    enabled: !!engagementId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newVersionForm) => {
      const overallMateriality = parseFloat(data.overallMateriality);
      const payload = {
        benchmarkType: data.benchmarkType,
        benchmarkAmount: parseFloat(data.benchmarkAmount),
        percentApplied: parseFloat(data.percentApplied),
        overallMateriality,
        performanceMateriality: data.performanceMateriality ? parseFloat(data.performanceMateriality) : overallMateriality * 0.75,
        trivialThreshold: data.trivialThreshold ? parseFloat(data.trivialThreshold) : overallMateriality * 0.05,
        rationale: data.rationale + (data.notes ? `\n\nNotes: ${data.notes}` : ""),
      };
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/materiality-sets`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "New materiality version created" });
      setShowNewVersionDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "materiality-sets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/materiality-sets/${id}/submit`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Submitted for review" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "materiality-sets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/materiality-sets/${id}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Materiality set approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "materiality-sets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/materiality-sets/${id}/lock`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Materiality set locked" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "materiality-sets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewVersionForm({
      benchmarkType: "PROFIT_BEFORE_TAX",
      benchmarkAmount: "",
      percentApplied: "5",
      overallMateriality: "",
      performanceMateriality: "",
      trivialThreshold: "",
      rationale: "",
      notes: "",
    });
  };

  const handleBenchmarkChange = (benchmarkAmount: string, percentApplied: string) => {
    const amount = parseFloat(benchmarkAmount) || 0;
    const percent = parseFloat(percentApplied) || 0;
    const overallMateriality = amount * (percent / 100);
    
    setNewVersionForm(prev => ({
      ...prev,
      benchmarkAmount,
      percentApplied,
      overallMateriality: overallMateriality > 0 ? Math.round(overallMateriality).toString() : "",
      performanceMateriality: overallMateriality > 0 ? Math.round(overallMateriality * 0.75).toString() : "",
      trivialThreshold: overallMateriality > 0 ? Math.round(overallMateriality * 0.05).toString() : "",
    }));
  };

  const activeSet = materialitySets?.find(m => m.status !== "SUPERSEDED" && !m.isLocked) 
    || materialitySets?.find(m => m.status === "APPROVED")
    || materialitySets?.[0];
  
  const lockedSet = materialitySets?.find(m => m.isLocked);
  const displaySet = lockedSet || activeSet;
  
  const canSubmit = displaySet && displaySet.status === "DRAFT" && !displaySet.isLocked;
  const canApprove = displaySet && (displaySet.status === "PENDING_REVIEW" || displaySet.status === "PENDING_APPROVAL") 
    && hasMinRole(user?.role || "", "MANAGER") && !displaySet.isLocked;
  const canLock = displaySet && displaySet.status === "APPROVED" && hasMinRole(user?.role || "", "PARTNER") && !displaySet.isLocked;

  if (isLoading) {
    return (
      <Card className={className} data-testid="materiality-set-panel-loading">
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
      <Card className={className} data-testid="materiality-set-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5" />
            Materiality (ISA 320)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load materiality data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="materiality-set-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-5 w-5" />
              Materiality (ISA 320)
              {displaySet && (
                <Badge variant="outline" className="ml-2">
                  v{displaySet.versionId}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Overall, performance, and trivial threshold materiality levels
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {materialitySets && materialitySets.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                data-testid="button-toggle-history"
              >
                <History className="h-4 w-4 mr-1" />
                History ({materialitySets.length})
              </Button>
            )}
            <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-version">
                  <Plus className="h-4 w-4 mr-1" />
                  New Version
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Materiality Version</DialogTitle>
                  <DialogDescription>
                    Define materiality levels per ISA 320. Previous versions will be superseded.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Benchmark Type (Basis)</Label>
                    <Select
                      value={newVersionForm.benchmarkType}
                      onValueChange={(v) => setNewVersionForm(prev => ({ ...prev, benchmarkType: v }))}
                    >
                      <SelectTrigger data-testid="select-benchmark-type">
                        <SelectValue placeholder="Select benchmark" />
                      </SelectTrigger>
                      <SelectContent>
                        {BENCHMARK_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Benchmark Amount (Basis Value)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 10,000,000"
                        value={newVersionForm.benchmarkAmount}
                        onChange={(e) => handleBenchmarkChange(e.target.value, newVersionForm.percentApplied)}
                        data-testid="input-benchmark-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Percentage Applied (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        placeholder="e.g., 5"
                        value={newVersionForm.percentApplied}
                        onChange={(e) => handleBenchmarkChange(newVersionForm.benchmarkAmount, e.target.value)}
                        data-testid="input-percent-applied"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Overall Materiality</Label>
                      <Input
                        type="number"
                        placeholder="Calculated"
                        value={newVersionForm.overallMateriality}
                        onChange={(e) => setNewVersionForm(prev => ({ ...prev, overallMateriality: e.target.value }))}
                        data-testid="input-overall-materiality"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Performance Materiality</Label>
                      <Input
                        type="number"
                        placeholder="~75%"
                        value={newVersionForm.performanceMateriality}
                        onChange={(e) => setNewVersionForm(prev => ({ ...prev, performanceMateriality: e.target.value }))}
                        data-testid="input-performance-materiality"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Trivial Threshold</Label>
                      <Input
                        type="number"
                        placeholder="~5%"
                        value={newVersionForm.trivialThreshold}
                        onChange={(e) => setNewVersionForm(prev => ({ ...prev, trivialThreshold: e.target.value }))}
                        data-testid="input-trivial-threshold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Rationale (ISA 320.10)</Label>
                    <Textarea
                      placeholder="Explain the basis for materiality determination..."
                      value={newVersionForm.rationale}
                      onChange={(e) => setNewVersionForm(prev => ({ ...prev, rationale: e.target.value }))}
                      rows={3}
                      data-testid="input-rationale"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional notes or comments..."
                      value={newVersionForm.notes}
                      onChange={(e) => setNewVersionForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      data-testid="input-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewVersionDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(newVersionForm)}
                    disabled={createMutation.isPending || !newVersionForm.benchmarkAmount || !newVersionForm.overallMateriality}
                    data-testid="button-create-version"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Version
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {displaySet ? (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusWorkflowIndicator currentStatus={displaySet.status} />
              <div className="flex items-center gap-2">
                <StatusBadge status={displaySet.status} />
                {displaySet.isLocked && (
                  <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Overall Materiality</div>
                <div className="text-lg font-semibold" data-testid="text-overall-materiality">
                  {formatCurrency(displaySet.overallMateriality)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Performance Materiality</div>
                <div className="text-lg font-semibold" data-testid="text-performance-materiality">
                  {formatCurrency(displaySet.performanceMateriality)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Trivial Threshold</div>
                <div className="text-lg font-semibold" data-testid="text-trivial-threshold">
                  {formatCurrency(displaySet.trivialThreshold)}
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Benchmark:</span>{" "}
              {BENCHMARK_OPTIONS.find(b => b.value === displaySet.benchmarkType)?.label || displaySet.benchmarkType}
              {" @ "}{formatCurrency(displaySet.benchmarkAmount)} × {displaySet.percentApplied}%
            </div>

            {displaySet.rationale && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4" />
                  View Rationale
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap" data-testid="text-rationale">
                    {displaySet.rationale}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {displaySet.preparedBy && (
                  <span>Prepared by {displaySet.preparedBy.fullName} on {formatDate(displaySet.preparedAt)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canSubmit && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => submitMutation.mutate(displaySet.id)}
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-review"
                  >
                    {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Send className="h-4 w-4 mr-1" />
                    Submit for Review
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => approveMutation.mutate(displaySet.id)}
                    disabled={approveMutation.isPending}
                    data-testid="button-approve"
                  >
                    {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                )}
                {canLock && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => lockMutation.mutate(displaySet.id)}
                    disabled={lockMutation.isPending}
                    data-testid="button-lock"
                  >
                    {lockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Lock className="h-4 w-4 mr-1" />
                    Lock
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No materiality set defined yet
            </p>
            <Button
              size="sm"
              onClick={() => setShowNewVersionDialog(true)}
              data-testid="button-create-first"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create First Version
            </Button>
          </div>
        )}

        {showHistoryPanel && materialitySets && materialitySets.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Version History</div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {materialitySets.map((set) => (
                    <div
                      key={set.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        set.id === displaySet?.id && "border-primary bg-primary/5"
                      )}
                      data-testid={`history-item-${set.versionId}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{set.versionId}</Badge>
                          <StatusBadge status={set.status} />
                          {set.isLocked && (
                            <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              <Lock className="h-3 w-3" />
                              Locked
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(set.createdAt)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Overall:</span>{" "}
                        <span className="font-medium">{formatCurrency(set.overallMateriality)}</span>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">Performance:</span>{" "}
                        <span className="font-medium">{formatCurrency(set.performanceMateriality)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MaterialitySetPanel;
